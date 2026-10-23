import employeeModel from "../models/employee.model";
import { Employee } from "../types/employee";
import { paginatedData } from "../../../../types/paginatedData";
import { EmployeeFaceRecognitionData } from "../types/employee";
import prisma from "../../../../core/models/base.model";
import { AttendanceStatus, LeaveStatus } from "@prisma/client";
import { compressImageDataUrl, makeThumbnailDataUrl } from "../../../../core/utils/imageCompression";
import userModel from "../../../rbac/user/models/user.model";
import { getActorId } from "../../../../core/context/requestContext";
import { logActivity } from "../../../ActivityLog/helper/activityLog.helper";
import { getAccessibleEmployeeIds, canAccessEmployee } from "../../Unit/helper/unitAccess.helper";
import { AppError } from "../../../../core/errors/app.error";

// Phase 3c: employee states that terminate access. REJOINED stays active (and never auto-reactivates).
const TERMINAL_EMPLOYEE_STATUSES = new Set(["RESIGNED", "FIRE"]);

// HOTFIX: filter a list of {id} rows to the caller's accessible employees (null scope = all).
async function scopeRows<T extends { id?: string }>(rows: T[], userId?: string): Promise<T[]> {
  if (!userId) return rows;
  const ids = await getAccessibleEmployeeIds(userId);
  if (ids === null) return rows;
  const set = new Set(ids);
  return rows.filter((r) => r.id && set.has(r.id));
}

class EmployeeService {
  async getAllEmployees(): Promise<Employee[]> {
    return await employeeModel.employee.gpFindMany();
  }

  async getEmployees(page: number, pageSize: number, userId?: string): Promise<paginatedData> {
    // HOTFIX unit scoping: route the POST list through the unit-aware paginator so it is scoped by
    // the caller's accessible units (ams.viewAll.unit bypasses; no unit = self), same as GET /get.
    return await employeeModel.employee.gpPgFindManyWithSortAndFilter(
      page, pageSize, 'createdAt', 'desc', undefined, undefined, undefined, undefined, undefined, userId
    );
  }

  async getEmployeesWithPagination(
    page: number,
    pageSize: number,
    sortBy: string,
    sortOrder: 'asc' | 'desc',
    filter?: string,
    search?: string,
    from?: string,
    to?: string,
    dateField?: string,
    userId?: string
  ): Promise<paginatedData> {
    return await employeeModel.employee.gpPgFindManyWithSortAndFilter(
      page,
      pageSize,
      sortBy,
      sortOrder,
      filter,
      search,
      from,
      to,
      dateField,
      userId
    );
  }

  async getFilterEmployees(userId?: string): Promise<any[]> {
    return await scopeRows(await employeeModel.employee.gpFindFilterMany(), userId);
  }

  // 6a: employees currently present (checked in today, not yet checked out) — the source for the
  // Frontdesk "Referred To" suggestions.
  async getPresentTodayEmployees(userId?: string): Promise<any[]> {
    return await scopeRows(await employeeModel.employee.gpFindPresentToday(), userId);
  }

  async getEmployeeByUserId(userId:string){
return await employeeModel.employee.gpFindEmployeeByUserId(userId);
  }

  async updateFilePaths(employeeId:string, updatedFilePaths:string[]){
    await employeeModel.employee.updateFilePaths(employeeId,updatedFilePaths);
  }

  async deleteFiles(id:string,fileName:string){
    return await employeeModel.employee.deleteFiles(id,fileName);
  }

  async getFiles(id:string){
    return await employeeModel.employee.getFiles(id);
  }

  async getDeletedEmployees(
    page: number,
    pageSize: number
  ): Promise<paginatedData> {
    return await employeeModel.employee.gpPgFindDeletedMany(page, pageSize);
  }

  async createEmployee(
    employeeData: Employee | Employee[]
  ): Promise<Employee | Employee[]> {
    // Compress the photo on upload (max 800px, JPEG ~80%) so a single row can't grow to multiple MB.
    const compressed = Array.isArray(employeeData)
      ? await Promise.all(employeeData.map((e) => this.withCompressedImage(e)))
      : await this.withCompressedImage(employeeData);
    return await employeeModel.employee.gpCreate(compressed);
  }

  async updateEmployee(
    employeeId: string,
    employeeData: Employee
  ): Promise<any> {
    const compressed = await this.withCompressedImage(employeeData);
    const result = await employeeModel.employee.gpUpdate(employeeId, compressed);
    // Phase 3c: when an employee becomes resigned/terminated, auto-suspend their linked user.
    if ((employeeData as any)?.status && TERMINAL_EMPLOYEE_STATUSES.has(String((employeeData as any).status))) {
      const u = await this.linkedUser(employeeId);
      await this.autoSuspendUser(u, `employee status ${(employeeData as any).status}`);
    }
    return result;
  }

  /** The user linked to an employee (active, not already suspended) — null otherwise. */
  private async linkedUser(employeeId: string): Promise<{ id: string } | null> {
    const user = await prisma.user.findFirst({ where: { employeeId, isDeleted: null, suspendedAt: null }, select: { id: true } });
    return user ?? null;
  }

  /** Suspend a pre-resolved linked user (Phase 3c auto-suspend). Audited; never auto-reactivates. */
  private async autoSuspendUser(user: { id: string } | null, reason: string): Promise<void> {
    if (!user) return;
    try {
      await userModel.user.gpSuspend(user.id, getActorId());
      await logActivity({ userId: getActorId(), action: "AUTO_SUSPEND", entityType: "User", entityId: user.id, description: `Auto-suspended: ${reason}` } as any);
    } catch (e: any) {
      console.warn("[autoSuspend] failed:", e?.message || e);
    }
  }

  /** Compress `image` + generate `imageThumb` (5g) on save (no-op if absent/unprocessable). */
  private async withCompressedImage<T extends { image?: any; imageThumb?: any }>(data: T): Promise<T> {
    if (!data || data.image == null) return data;
    const image = await compressImageDataUrl(data.image);
    const imageThumb = await makeThumbnailDataUrl(image);
    return { ...data, image, ...(imageThumb ? { imageThumb } : {}) };
  }

  /** 5g: serve an employee photo (thumb or full) as decoded bytes for the /employee/photo endpoint. */
  async getPhoto(id: string, size: "thumb" | "full", userId?: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    if (userId && !(await canAccessEmployee(userId, id))) throw new AppError(403, "This employee is outside your units");
    const emp = await prisma.employee.findUnique({ where: { id }, select: { image: true, imageThumb: true } });
    if (!emp) return null;
    const dataUrl = size === "thumb" ? (emp.imageThumb || emp.image) : (emp.image || emp.imageThumb);
    if (!dataUrl) return null;
    const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,/.exec(dataUrl);
    const contentType = m ? m[1] : "image/jpeg";
    const base64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
    try { return { buffer: Buffer.from(base64, "base64"), contentType }; } catch { return null; }
  }

  async deleteEmployee(employeeId: string): Promise<void> {
    // Resolve the linked user BEFORE the soft-delete (which detaches/soft-deletes the user link).
    const u = await this.linkedUser(employeeId);
    await employeeModel.employee.gpSoftDelete(employeeId);
    // Phase 3c: a deleted employee's linked user is auto-suspended too.
    await this.autoSuspendUser(u, "employee deleted");
  }

  async restoreEmployee(employeeId: string): Promise<void> {
    await employeeModel.employee.gpRestore(employeeId);
  }

  async getEmployeeById(employeeId: string, userId?: string): Promise<Employee | null> {
    if (userId && !(await canAccessEmployee(userId, employeeId))) throw new AppError(403, "This employee is outside your units");
    const employee = await employeeModel.employee.gpFindById(employeeId);
    if (employee && employee.emergencyContactNo === null) {
      employee.emergencyContactNo = undefined as unknown as string;
    }
    return employee as Employee | null;
  }

  async getEmployeeByCode(code: string, userId?: string){
    const emp: any = await employeeModel.employee.gpFindByCode(code);
    if (emp?.id && userId && !(await canAccessEmployee(userId, emp.id))) throw new AppError(403, "This employee is outside your units");
    return emp;
  }

  async getEmployeeLinkedUser(employeeId: string, userId?: string): Promise<any> {
    if (userId && !(await canAccessEmployee(userId, employeeId))) throw new AppError(403, "This employee is outside your units");
    return await employeeModel.employee.gpGetLinkedUser(employeeId);
  }

  async getTotalEmployees(): Promise<number> {
    return await employeeModel.employee.gpCount();
  }

  async searchEmployee(
    searchTerm: string | string[],
    page: number,
    pageSize: number,
    userId?: string
  ): Promise<paginatedData> {
    const columns: string[] = ['name','surname','address','bloodGroup','code','designation','department','contactNo','martialStatus'];
    const res: any = await employeeModel.employee.gpSearch(searchTerm, columns, page, pageSize);
    // HOTFIX: restrict the page to the caller's accessible employees.
    if (userId && res && Array.isArray(res.data)) {
      const ids = await getAccessibleEmployeeIds(userId);
      if (ids !== null) {
        const set = new Set(ids);
        res.data = res.data.filter((r: any) => r.id && set.has(r.id));
        res.totalSize = res.data.length;
      }
    }
    return res;
  }

  async getTotal() {
    return await employeeModel.employee.gpCount();
  }

  /** 4b: employee detail overview — linked user (+roles/last login/status), teams + team lead,
   *  assigned tasks, linked sales agent, recent daily reports. All server-computed, null-safe. */
  async getOverview(employeeId: string, userId?: string): Promise<any> {
    if (userId && !(await canAccessEmployee(userId, employeeId))) throw new AppError(403, "This employee is outside your units");
    const [linkedUser, teamMemberships, taskAssignees, agent, reports] = await Promise.all([
      prisma.user.findFirst({ where: { employeeId, isDeleted: null }, select: { id: true, username: true, suspendedAt: true, userRoles: { where: { isDeleted: null }, select: { role: { select: { name: true } } } } } }),
      prisma.teamMember.findMany({ where: { employeeId, isDeleted: null }, select: { team: { select: { id: true, name: true, lead: { select: { name: true, surname: true } } } } } }),
      prisma.taskAssignee.findMany({ where: { employeeId }, take: 10, select: { task: { select: { id: true, code: true, title: true, status: true, dueDate: true } } } }),
      prisma.salesAgent.findFirst({ where: { employeeId, isDeleted: null }, select: { id: true, agentCode: true, scope: true, isActive: true } }),
      prisma.dailyReport.findMany({ where: { employeeId }, orderBy: { date: "desc" }, take: 5, select: { id: true, date: true, whatIDid: true, hours: true, late: true } }),
    ]);
    let lastLogin: Date | null = null;
    if (linkedUser) {
      const s = await prisma.loggedInUsers.findFirst({ where: { userId: linkedUser.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
      lastLogin = s?.createdAt ?? null;
    }
    return {
      linkedUser: linkedUser ? {
        id: linkedUser.id, username: linkedUser.username,
        roles: (linkedUser.userRoles || []).map((r: any) => r.role?.name).filter(Boolean),
        status: linkedUser.suspendedAt ? "SUSPENDED" : "ACTIVE", lastLogin,
      } : null,
      teams: (teamMemberships || []).map((t: any) => ({ id: t.team?.id, name: t.team?.name, lead: t.team?.lead ? `${t.team.lead.name || ""} ${t.team.lead.surname || ""}`.trim() : null })).filter((t: any) => t.id),
      tasks: (taskAssignees || []).map((a: any) => a.task).filter(Boolean),
      salesAgent: agent ?? null,
      recentReports: reports || [],
    };
  }

  /** 4g: distinct existing designations + departments (for the Create/Edit Staff comboboxes). */
  async getDistinctFields(): Promise<{ designations: string[]; departments: string[] }> {
    const [desig, dept] = await Promise.all([
      prisma.employee.findMany({ where: { isDeleted: null, designation: { not: "" } }, select: { designation: true }, distinct: ["designation"], orderBy: { designation: "asc" } }),
      prisma.employee.findMany({ where: { isDeleted: null, department: { not: "" } }, select: { department: true }, distinct: ["department"], orderBy: { department: "asc" } }),
    ]);
    return {
      designations: desig.map((d) => d.designation).filter((x): x is string => !!x),
      departments: dept.map((d) => d.department).filter((x): x is string => !!x),
    };
  }

  async getEmployeesForFaceRecognition(): Promise<EmployeeFaceRecognitionData[]> {
    const employees = await employeeModel.employee.gpFindMany({
      
      select: {
        id: true,
        faceDescriptor: true,
      },
    });
    return employees;
  }

  async getHistoryById(employeeId: string, filter?: boolean, date?: string): Promise<any> {
    return await employeeModel.employee.getHistoryById(employeeId, filter, date);
  }

  async getEmployeeStats(employeeId: string, from?: string, to?: string): Promise<any> {
    // Validate employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId, isDeleted: null },
    });

    if (!employee) {
      throw new Error(`Employee with ID ${employeeId} not found.`);
    }

    // Set date range - default to current month if not provided
    const now = new Date();
    const fromDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const toDate = to ? new Date(to) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    // Set to start/end of day
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    // Calculate date ranges for trends
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
    const weekEnd = new Date(today);
    weekEnd.setHours(23, 59, 59, 999);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    // Get all stats in parallel
    const [
      // Attendance stats - overall
      attendanceByStatus,
      totalAttendance,
      todayAttendance,
      weekAttendance,
      monthAttendance,
      
      // Attendance trends - daily for last 30 days
      dailyAttendanceTrend,
      
      // Leave Request stats
      leaveRequestsByStatus,
      totalLeaveRequests,
      approvedLeaveRequests,
      approvedLeaveRequestsInRange,
      pendingLeaveRequests,
      rejectedLeaveRequests,
      
      // Leave Allocation stats
      leaveAllocations,
      monthlyLeaveTrend,
    ] = await Promise.all([
      // Attendance by status (overall period)
      prisma.attendance.groupBy({
        by: ['status'],
        where: {
          employeeId,
          date: { gte: fromDate, lte: toDate },
          isDeleted: null,
        },
        _count: { status: true },
      }),
      
      // Total attendance count
      prisma.attendance.count({
        where: {
          employeeId,
          date: { gte: fromDate, lte: toDate },
          isDeleted: null,
        },
      }),
      
      // Today's attendance
      prisma.attendance.findFirst({
        where: {
          employeeId,
          date: { gte: today, lte: todayEnd },
          isDeleted: null,
        },
      }),
      
      // Week attendance count
      prisma.attendance.count({
        where: {
          employeeId,
          date: { gte: weekStart, lte: weekEnd },
          isDeleted: null,
        },
      }),
      
      // Month attendance count
      prisma.attendance.count({
        where: {
          employeeId,
          date: { gte: monthStart, lte: monthEnd },
          isDeleted: null,
        },
      }),
      
      // Daily attendance trend (last 30 days)
      this.getDailyAttendanceTrend(employeeId, 30),
      
      // Leave requests by status
      prisma.leaveRequest.groupBy({
        by: ['status'],
        where: {
          employeeId,
          createdAt: { gte: fromDate, lte: toDate },
          isDeleted: null,
        },
        _count: { status: true },
      }),
      
      // Total leave requests
      prisma.leaveRequest.count({
        where: {
          employeeId,
          createdAt: { gte: fromDate, lte: toDate },
          isDeleted: null,
        },
      }),
      
      // Approved leave requests (for calculating used days)
      prisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: LeaveStatus.APPROVED,
          isDeleted: null,
        },
        select: {
          startDate: true,
          endDate: true,
        },
      }),
      
      // Approved leave requests overlapping date range (for attendance stats)
      prisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: LeaveStatus.APPROVED,
          isDeleted: null,
          startDate: { lte: toDate },
          endDate: { gte: fromDate },
        },
        select: {
          startDate: true,
          endDate: true,
        },
      }),
      
      // Pending leave requests
      prisma.leaveRequest.count({
        where: {
          employeeId,
          status: LeaveStatus.PENDING,
          isDeleted: null,
        },
      }),
      
      // Rejected leave requests
      prisma.leaveRequest.count({
        where: {
          employeeId,
          status: LeaveStatus.REJECTED,
          isDeleted: null,
        },
      }),
      
      // Leave allocations
      prisma.leaveAllocation.findMany({
        where: {
          employeeId,
          isDeleted: null,
        },
        select: {
          assignedDays: true,
          allocationStartDate: true,
          allocationEndDate: true,
        },
      }),
      
      // Monthly leave trend
      this.getMonthlyLeaveTrend(employeeId, 12),
    ]);

    // Calculate attendance statistics
    const attendanceStats = {
      total: totalAttendance,
      byStatus: {
        PRESENT: 0,
        ABSENT: 0,
        LATE: 0,
        ON_LEAVE: 0,
        HALF_DAY: 0,
        HOLIDAYS: 0,
      },
      today: todayAttendance ? {
        status: todayAttendance.status,
        checkIn: todayAttendance.checkIn,
        checkOut: todayAttendance.checkOut,
      } : null,
      periods: {
        today: todayAttendance ? 1 : 0,
        week: weekAttendance,
        month: monthAttendance,
      },
      trends: {
        daily: dailyAttendanceTrend,
      },
    };

    // Populate attendance by status
    attendanceByStatus.forEach((item) => {
      attendanceStats.byStatus[item.status as keyof typeof attendanceStats.byStatus] = item._count.status;
    });

    // Calculate approved leave days within the requested date range
    let leaveDaysInRange = 0;
    approvedLeaveRequestsInRange.forEach((request) => {
      const requestStart = new Date(request.startDate);
      const requestEnd = new Date(request.endDate);
      const rangeStart = requestStart > fromDate ? requestStart : fromDate;
      const rangeEnd = requestEnd < toDate ? requestEnd : toDate;
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd.setHours(0, 0, 0, 0);
      if (rangeEnd >= rangeStart) {
        const diffTime = Math.abs(rangeEnd.getTime() - rangeStart.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        leaveDaysInRange += diffDays;
      }
    });

    // If leave requests are approved but attendance entries weren't created, reflect them in stats
    if (leaveDaysInRange > 0) {
      const recordedLeaveDays = attendanceStats.byStatus.ON_LEAVE || 0;
      const missingLeaveDays = Math.max(0, leaveDaysInRange - recordedLeaveDays);
      if (missingLeaveDays > 0) {
        attendanceStats.byStatus.ON_LEAVE += missingLeaveDays;
        attendanceStats.total += missingLeaveDays;
      }
    }

    // Calculate leave request statistics
    const leaveRequestStats = {
      total: totalLeaveRequests,
      byStatus: {
        PENDING: 0,
        APPROVED: 0,
        REJECTED: 0,
      },
      pending: pendingLeaveRequests,
      approved: approvedLeaveRequests.length,
      rejected: rejectedLeaveRequests,
    };

    // Populate leave requests by status
    leaveRequestsByStatus.forEach((item) => {
      leaveRequestStats.byStatus[item.status as keyof typeof leaveRequestStats.byStatus] = item._count.status;
    });

    // Calculate used leave days from approved requests
    let usedLeaveDays = 0;
    approvedLeaveRequests.forEach((request) => {
      const start = new Date(request.startDate);
      const end = new Date(request.endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
      usedLeaveDays += diffDays;
    });

    // Calculate leave allocation statistics
    const totalAllocated = leaveAllocations.reduce((sum, alloc) => sum + alloc.assignedDays, 0);
    const remainingDays = totalAllocated - usedLeaveDays;

    const leaveAllocationStats = {
      totalAllocated: totalAllocated,
      used: usedLeaveDays,
      remaining: remainingDays > 0 ? remainingDays : 0,
      allocations: leaveAllocations.map(alloc => ({
        assignedDays: alloc.assignedDays,
        allocationStartDate: alloc.allocationStartDate,
        allocationEndDate: alloc.allocationEndDate,
      })),
    };

    // Calculate leave trends
    const leaveTrends = {
      monthly: monthlyLeaveTrend,
    };

    return {
      employee: {
        id: employee.id,
        name: employee.name,
        surname: employee.surname,
        code: employee.code,
      },
      dateRange: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
      attendance: attendanceStats,
      leaveRequests: leaveRequestStats,
      leaveAllocations: leaveAllocationStats,
      leaveTrends: leaveTrends,
    };
  }

  // Helper method to get daily attendance trend
  private async getDailyAttendanceTrend(employeeId: string, days: number = 30): Promise<any[]> {
    const trends = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const dateEnd = new Date(date);
      dateEnd.setHours(23, 59, 59, 999);
      
      const attendance = await prisma.attendance.findFirst({
        where: {
          employeeId,
          date: { gte: date, lte: dateEnd },
          isDeleted: null,
        },
        select: {
          status: true,
          checkIn: true,
          checkOut: true,
        },
      });
      
      trends.push({
        date: date.toISOString().split('T')[0],
        status: attendance?.status || 'ABSENT',
        checkIn: attendance?.checkIn || null,
        checkOut: attendance?.checkOut || null,
      });
    }
    
    return trends;
  }

  // Helper method to get monthly leave trend
  private async getMonthlyLeaveTrend(employeeId: string, months: number = 12): Promise<any[]> {
    const trends = [];
    const today = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
      
      const [approved, pending, rejected] = await Promise.all([
        prisma.leaveRequest.count({
          where: {
            employeeId,
            status: LeaveStatus.APPROVED,
            createdAt: { gte: monthStart, lte: monthEnd },
            isDeleted: null,
          },
        }),
        prisma.leaveRequest.count({
          where: {
            employeeId,
            status: LeaveStatus.PENDING,
            createdAt: { gte: monthStart, lte: monthEnd },
            isDeleted: null,
          },
        }),
        prisma.leaveRequest.count({
          where: {
            employeeId,
            status: LeaveStatus.REJECTED,
            createdAt: { gte: monthStart, lte: monthEnd },
            isDeleted: null,
          },
        }),
      ]);
      
      trends.push({
        month: `${date.getFullYear()}-${monthNames[date.getMonth()]}`,
        approved,
        pending,
        rejected,
        total: approved + pending + rejected,
      });
    }
    
    return trends;
  }
}

export default EmployeeService;
