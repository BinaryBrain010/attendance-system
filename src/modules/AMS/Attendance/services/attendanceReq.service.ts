import attendanceRequestModel from "../models/attendanceReq.model";
import { AttendanceRequest } from "../types/AttendanceRequest";
import { paginatedData } from "../../../../types/paginatedData";
import { LeaveStatus } from "@prisma/client";

class LeaveReqService {
  // Get all leave requests
  async getAllAttendanceRequests(): Promise<AttendanceRequest[]> {
    return await attendanceRequestModel.attendanceRequest.gpFindMany();
  }

  // Get paginated leave requests
  async getAttendanceRequests(
    page: number,
    pageSize: number
  ): Promise<paginatedData> {
    return await attendanceRequestModel.attendanceRequest.gpPgFindMany(page, pageSize);
  }


  // Create new leave request(s)
  async createAttendanceRequest(
    AttendanceRequestData: AttendanceRequest | AttendanceRequest[]
  ): Promise<AttendanceRequest | AttendanceRequest[]> {
    return await attendanceRequestModel.attendanceRequest.gpCreate(AttendanceRequestData);
  }

  // Update an existing leave request
  async updateAttendanceRequest(
    requestId: string,
    AttendanceRequestData: AttendanceRequest
  ): Promise<any> {
    return await attendanceRequestModel.attendanceRequest.gpUpdate(requestId, AttendanceRequestData);
  }

  // Soft delete a leave request
  async deleteAttendanceRequest(requestId: string): Promise<void> {
    await attendanceRequestModel.attendanceRequest.gpSoftDelete(requestId);
  }

  // Restore a deleted leave request
  async restoreAttendanceRequest(requestId: string): Promise<void> {
    await attendanceRequestModel.attendanceRequest.gpRestore(requestId);
  }

  // Get a leave request by ID
  async getAttendanceRequestById(requestId: string): Promise<AttendanceRequest | null> {
    return await attendanceRequestModel.attendanceRequest.gpFindById(requestId);
  }

  // Get leave requests by employee ID
  async getAttendanceRequestsByEmployeeId(
    employeeId: string
  ): Promise<any[]> {
    return await attendanceRequestModel.attendanceRequest.gpFindManyByEmployeeId(employeeId);
  }

  // Get soft-deleted leave requests
  async getDeletedAttendanceRequests(
    page: number,
    pageSize: number
  ): Promise<paginatedData> {
    return await attendanceRequestModel.attendanceRequest.gpPgFindDeletedMany(page, pageSize);
  }

  // Search leave requests by term
  async searchAttendanceRequests(
    searchTerm: string | string[],
    page: number,
    pageSize: number
  ): Promise<paginatedData> {
    const columns: string[] = ['reason', 'status', 'location']; // Specify searchable fields
    return await attendanceRequestModel.attendanceRequest.gpSearch(
      searchTerm,
      columns,
      page,
      pageSize
    );
  }

  // Update leave request status
  async updateAttendanceRequestStatus(
    requestId: string,
    status: LeaveStatus,
    approvedBy?: string
  ): Promise<void> {
    await attendanceRequestModel.attendanceRequest.gpUpdateStatus(requestId, status, approvedBy);
  }

  // Get total number of leave requests
  async getTotalAttendanceRequests(): Promise<number> {
    return await attendanceRequestModel.attendanceRequest.gpCount();
  }
}

export default LeaveReqService;
