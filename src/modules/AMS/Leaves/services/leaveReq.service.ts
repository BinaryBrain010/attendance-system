import leaveReqModel from "../models/leaveReq.model";
import { LeaveRequest, LeaveStatus } from "../types/leave";
import { paginatedData } from "../../../../types/paginatedData";
import prisma from "../../../../core/models/base.model";

class LeaveReqService {
  // Get all leave requests
  async getAllLeaveRequests(userId?: string): Promise<LeaveRequest[]> {
    return await leaveReqModel.leaveRequest.gpFindMany(userId);
  }

  // Get paginated leave requests
  async getLeaveRequests(
    page: number,
    pageSize: number,
    userId?: string
  ): Promise<paginatedData> {
    return await leaveReqModel.leaveRequest.gpPgFindMany(page, pageSize, userId);
  }


  // Create new leave request(s)
  async createLeaveRequest(
    leaveRequestData: LeaveRequest | LeaveRequest[]
  ): Promise<LeaveRequest | LeaveRequest[]> {
    return await leaveReqModel.leaveRequest.gpCreate(leaveRequestData);
  }

  // Update an existing leave request
  async updateLeaveRequest(
    requestId: string,
    leaveRequestData: LeaveRequest
  ): Promise<any> {
    return await leaveReqModel.leaveRequest.gpUpdate(requestId, leaveRequestData);
  }

  // Soft delete a leave request
  async deleteLeaveRequest(requestId: string): Promise<void> {
    await leaveReqModel.leaveRequest.gpSoftDelete(requestId);
  }

  // Restore a deleted leave request
  async restoreLeaveRequest(requestId: string): Promise<void> {
    await leaveReqModel.leaveRequest.gpRestore(requestId);
  }

  // Get a leave request by ID
  async getLeaveRequestById(requestId: string): Promise<LeaveRequest | null> {
    return await leaveReqModel.leaveRequest.gpFindById(requestId);
  }

  // Get leave requests by employee ID
  async getLeaveRequestsByEmployeeId(
    employeeId: string
  ): Promise<any[]> {
    return await leaveReqModel.leaveRequest.gpFindManyByEmployeeId(employeeId);
  }

  // Get soft-deleted leave requests
  async getDeletedLeaveRequests(
    page: number,
    pageSize: number
  ): Promise<paginatedData> {
    return await leaveReqModel.leaveRequest.gpPgFindDeletedMany(page, pageSize);
  }

  // Search leave requests by term
  async searchLeaveRequests(
    searchTerm: string | string[],
    page: number,
    pageSize: number
  ): Promise<paginatedData> {
    const columns: string[] = ['reason', 'status', 'location']; // Specify searchable fields
    return await leaveReqModel.leaveRequest.gpSearch(
      searchTerm,
      columns,
      page,
      pageSize
    );
  }

  // Update leave request status
  async updateLeaveRequestStatus(
    requestId: string,
    status: LeaveStatus
  ): Promise<void> {
    await leaveReqModel.leaveRequest.gpUpdateStatus(requestId, status);
  }

  // Get total number of leave requests
  async getTotalLeaveRequests(): Promise<number> {
    return await leaveReqModel.leaveRequest.gpCount();
  }

  // Get leave overview for employee (allocations, requests, calendar)
  async getLeaveOverviewByEmployee(employeeId: string, from?: string, to?: string): Promise<any> {
    if (!employeeId) {
      throw new Error("Employee ID is required");
    }

    const now = new Date();
    const fromDate = from ? new Date(from) : new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date(now);

    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    const [allocations, requests] = await Promise.all([
      prisma.leaveAllocation.findMany({
        where: { employeeId, isDeleted: null },
        include: { leaveConfig: true },
      }),
      prisma.leaveRequest.findMany({
        where: {
          employeeId,
          isDeleted: null,
          startDate: { lte: toDate },
          endDate: { gte: fromDate },
        },
        include: {
          leaveAllocation: { include: { leaveConfig: true } },
        },
      }),
    ]);

    const allocationCards = allocations.map((allocation) => {
      const usedDays = allocation.usedDays ?? 0;
      const remainingDays = allocation.remainingDays ?? Math.max(allocation.assignedDays - usedDays, 0);
      return {
        id: allocation.id,
        type: allocation.leaveConfig?.name || "Leave",
        assignedDays: allocation.assignedDays,
        usedDays,
        remainingDays,
        allocationStartDate: allocation.allocationStartDate,
        allocationEndDate: allocation.allocationEndDate || null,
      };
    });

    const requestRows = requests.map((request: any) => {
      const leaveType =
        request.leaveAllocation?.leaveConfig?.name ||
        request.leaveType ||
        "CASUAL";
      const startDate = new Date(request.startDate);
      const endDate = new Date(request.endDate);
      const totalDays =
        Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return {
        id: request.id,
        leaveType,
        startDate: request.startDate,
        endDate: request.endDate,
        status: request.status,
        reason: request.reason || null,
        totalDays,
        createdAt: request.createdAt,
      };
    });

    const statusCounts = requestRows.reduce((acc: any, request: any) => {
      const key = (request.status || "UNKNOWN").toUpperCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const typeCounts = requestRows.reduce((acc: any, request: any) => {
      const key = (request.leaveType || "CASUAL").toString();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const calendarDays: Array<{
      date: string;
      status: string;
      leaveType: string;
      requestId: string;
    }> = [];

    requestRows.forEach((request: any) => {
      const start = new Date(request.startDate);
      const end = new Date(request.endDate);
      const rangeStart = start < fromDate ? fromDate : start;
      const rangeEnd = end > toDate ? toDate : end;

      const cursor = new Date(rangeStart);
      while (cursor <= rangeEnd) {
        calendarDays.push({
          date: cursor.toISOString().split("T")[0],
          status: request.status,
          leaveType: request.leaveType,
          requestId: request.id,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
    });

    return {
      range: {
        from: fromDate,
        to: toDate,
      },
      allocations: allocationCards,
      statusCounts,
      typeCounts,
      calendarDays,
      requests: requestRows,
    };
  }
}

export default LeaveReqService;
