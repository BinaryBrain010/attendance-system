import attendanceModel from "../models/attendance.model";
import { Attendance } from "../types/Attendance";
import { paginatedData } from "../../../../types/paginatedData";
import { AttendanceStatus } from "@prisma/client";
import ExcelValidator from "../helper/excelValidator";
import accessModel from "../../../rbac/Access/models/access.model";
import attendanceRequestModel from "../models/attendanceReq.model";

class AttendanceService {
  async getAllattendances(userId?: string) {
    return await attendanceModel.attendance.gpFindMany(userId);
  }

  async getEmployeeAttendance(employeeId:string,from:Date,to:Date){
    return await attendanceModel.attendance.gpFindEmployeeAttendance(employeeId,from,to);
  }

  async getAttendances(page: number, pageSize: number, userId?: string): Promise<paginatedData> {
    return await attendanceModel.attendance.gpPgFindMany(page, pageSize, userId);
  }

  async getDatedAttendance(from:Date,to:Date, userId?: string){
    return await attendanceModel.attendance.gpFindDatedMany(from,to, userId);
  }

  async faceAttendance(image:string){
return await attendanceModel.attendance.markFaceAttendance(image);
  }

  async getDeletedAttendances(
    page: number,
    pageSize: number
  ): Promise<paginatedData> {
    return await attendanceModel.attendance.gpPgFindDeletedMany(page, pageSize);
  }

  async markAttendance(
    attendanceData: Attendance & { createLeaveRequest?: boolean; leaveType?: string; leaveReason?: string }
  ){
    return await attendanceModel.attendance.markAttendance(attendanceData);
  }

  async bulkMarkLeave(
    employeeIds: string[],
    date: Date,
    leaveType?: string,
    reason?: string,
    createLeaveRequest?: boolean,
    createdByUserId?: string
  ): Promise<any> {
    return await attendanceModel.attendance.bulkMarkLeave(
      employeeIds,
      date,
      leaveType,
      reason,
      createLeaveRequest,
      createdByUserId
    );
  }

  async checkAttendance(employeeId:string,attendanceStatus:AttendanceStatus,date:Date, userId?: string
  ){
    return await attendanceModel.attendance.checkAttendance(employeeId,attendanceStatus,date, userId);
  }

  async createAttendance(
    attendanceData: Attendance | Attendance[]
  ): Promise<Attendance | Attendance[]> {
    return await attendanceModel.attendance.gpCreate(attendanceData);
  }

  async updateAttendance(
    attendanceId: string,
    attendanceData: Attendance,
    userId?: string
  ): Promise<any> {
    // Check if user has permission to edit attendance directly
    let hasPermission = false;
    if (userId) {
      try {
        hasPermission = await accessModel.user.checkUserPermission(userId, "attendance.update.direct.*");
      } catch (error) {
        console.error("Error checking permission:", error);
        hasPermission = false;
      }
    }

    if (!hasPermission) {
      // User doesn't have permission, create an attendance request instead
      const attendanceRequestModel = (await import("../models/attendanceReq.model")).default;
      
      // Get current attendance to determine employeeId
      const currentAttendance = await attendanceModel.attendance.gpFindById(attendanceId);
      
      if (!currentAttendance) {
        throw new Error(`Attendance with ID ${attendanceId} not found.`);
      }

      // Create attendance request with proposed changes
      const attendanceRequestData: any = {
        employeeId: (currentAttendance as any).employeeId,
        attendanceId: attendanceId,
        reason: attendanceData.comment || "Attendance update request",
        status: "PENDING",
        proposedStatus: attendanceData.status,
        proposedCheckIn: attendanceData.checkIn,
        proposedCheckOut: attendanceData.checkOut,
        proposedComment: attendanceData.comment,
        proposedLocation: attendanceData.location,
        proposedDate: attendanceData.date,
        requestedBy: userId || null,
      };

      const request = await attendanceRequestModel.attendanceRequest.gpCreate(attendanceRequestData);
      
      return {
        success: false,
        requiresApproval: true,
        message: "Your attendance update has been submitted for approval. You don't have permission to edit attendance directly.",
        requestId: Array.isArray(request) ? request[0].id : request.id,
        data: request,
      };
    }

    // User has permission, update directly
    return await attendanceModel.attendance.gpUpdate(
      attendanceId,
      attendanceData
    );
  }

  async deleteAttendance(attendanceId: string): Promise<void> {
    await attendanceModel.attendance.gpSoftDelete(attendanceId);
  }

  async restoreAttendance(attendanceId: string): Promise<void> {
    await attendanceModel.attendance.gpRestore(attendanceId);
  }

  async getAttendanceById(attendanceId: string): Promise<Attendance | null> {
    return await attendanceModel.attendance.gpFindById(attendanceId);
  }

  async getSpecifcAttendances(type:any,employeeId:any) {
    return await attendanceModel.attendance.getSpecificAttendances(type,employeeId);
  }

  async getTotalAttendances(): Promise<number> {
    return await attendanceModel.attendance.gpCount();
  }

  async searchAttendance(
    searchTerm: string | string[],
    page: number,
    pageSize: number
  ): Promise<paginatedData> {
    const columns: string[] = [
      "name",
      "surname",
      "address",
      "bloodGroup",
      "code",
      "designation",
      "department",
      "contactNo",
      "martialStatus",
    ];
    return await attendanceModel.attendance.gpSearch(
      searchTerm,
      columns,
      page,
      pageSize
    );
  }

  async getTotal() {
    return await attendanceModel.attendance.gpCount();
  }

  async importAttendance(employeeId: string, month: string, file: Buffer): Promise<any> {
    const validator = new ExcelValidator();
    const validationResult = await validator.validateExcel(file, employeeId, month);

    if (!validationResult.isValid) {
      console.log(validationResult);
      throw new Error(validationResult.message);
    }

    const attendances: Attendance[] = validationResult.data.map((row: any) => ({
      employeeId,
      date: new Date(row.date),
      status: row.status as AttendanceStatus,
      checkIn: row.checkIn,
      checkOut: row.checkOut,
    }));

    console.log(attendances);

    return await this.createAttendance(attendances);
  }

  async getHistoryById(attendanceId: string, filter?: boolean, date?: string): Promise<any> {
    return await attendanceModel.attendance.getHistoryById(attendanceId, filter, date);
  }

  async getAttendanceRequestSummary(): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  }> {
    const prisma = (await import("../../../../core/models/base.model")).default;
    
    const [totalResult, pendingResult, approvedResult, rejectedResult] = await Promise.all([
      prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int AS count
        FROM "AttendanceRequest" ar
        WHERE ar."isDeleted" IS NULL
      `) as Promise<[{ count: number }]>,
      prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int AS count
        FROM "AttendanceRequest" ar
        WHERE ar."isDeleted" IS NULL AND ar.status = 'PENDING'
      `) as Promise<[{ count: number }]>,
      prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int AS count
        FROM "AttendanceRequest" ar
        WHERE ar."isDeleted" IS NULL AND ar.status = 'APPROVED'
      `) as Promise<[{ count: number }]>,
      prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int AS count
        FROM "AttendanceRequest" ar
        WHERE ar."isDeleted" IS NULL AND ar.status = 'REJECTED'
      `) as Promise<[{ count: number }]>
    ]);

    return {
      total: totalResult[0]?.count || 0,
      pending: pendingResult[0]?.count || 0,
      approved: approvedResult[0]?.count || 0,
      rejected: rejectedResult[0]?.count || 0,
    };
  }
  
}

export default AttendanceService;
