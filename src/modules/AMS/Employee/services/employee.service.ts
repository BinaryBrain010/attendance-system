import employeeModel from "../models/employee.model";
import { Employee } from "../types/employee";
import { paginatedData } from "../../../../types/paginatedData";
import { EmployeeFaceRecognitionData } from "../types/employee";
import prisma from "../../../../core/models/base.model";
import { AttendanceStatus, LeaveStatus } from "@prisma/client";

class EmployeeService {
  async getAllEmployees(): Promise<Employee[]> {
    return await employeeModel.employee.gpFindMany();
  }

  async getEmployees(page: number, pageSize: number): Promise<paginatedData> {
    return await employeeModel.employee.gpPgFindMany(page, pageSize);
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
    dateField?: string
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
      dateField
    );
  }

  async getFilterEmployees(): Promise<any[]> {
    return await employeeModel.employee.gpFindFilterMany();
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
    return await employeeModel.employee.gpCreate(employeeData);
  }

  async updateEmployee(
    employeeId: string,
    employeeData: Employee
  ): Promise<any> {
    return await employeeModel.employee.gpUpdate(employeeId, employeeData);
  }

  async deleteEmployee(employeeId: string): Promise<void> {
    await employeeModel.employee.gpSoftDelete(employeeId);
  }

  async restoreEmployee(employeeId: string): Promise<void> {
    await employeeModel.employee.gpRestore(employeeId);
  }

  async getEmployeeById(employeeId: string): Promise<Employee | null> {
    return await employeeModel.employee.gpFindById(employeeId);
  }

  async getEmployeeByCode(code: string){
    return await employeeModel.employee.gpFindByCode(code);
  }

  async getTotalEmployees(): Promise<number> {
    return await employeeModel.employee.gpCount();
  }

  async searchEmployee(
    searchTerm: string | string[],
    page: number,
    pageSize: number
  ): Promise<paginatedData> {
    const columns: string[] = ['name','surname','address','bloodGroup','code','designation','department','contactNo','martialStatus'];
    return await employeeModel.employee.gpSearch(
      searchTerm,
      columns,
      page,
      pageSize
    );
  }

  async getTotal() {
    return await employeeModel.employee.gpCount();
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
