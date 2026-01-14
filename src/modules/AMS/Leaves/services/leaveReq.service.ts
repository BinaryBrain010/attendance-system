import leaveReqModel from "../models/leaveReq.model";
import { LeaveRequest, LeaveStatus } from "../types/leave";
import { paginatedData } from "../../../../types/paginatedData";

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
}

export default LeaveReqService;
