import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import AttendanceReqService from "../services/attendanceReq.service";
import { AttendanceRequest } from "../types/AttendanceRequest";

class AttendanceReqController extends BaseController<AttendanceReqService> {
  protected service = new AttendanceReqService();
  protected moduleName: string = "AMS";

  protected handle(operation: () => Promise<any>,
    successMessage: string,
    errorMessage: string,
    activityLog: string,
    res: Response,
    req: Request,
    entityId?: string
  ) {
    this.handleRequest(operation, successMessage, errorMessage, activityLog, res, req, this.moduleName, entityId);
  }

  async getAllAttendanceRequests(req: Request, res: Response) {
  const operation = () => this.service.getAllAttendanceRequests();
  const successMessage = "Attendance requests retrieved successfully!";
  const errorMessage = "Error retrieving attendance requests:";
  const activityLog = `Fetched all attendance requests`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getAttendanceRequests(req: Request, res: Response) {
  const { page, pageSize } = req.body;
  const operation = () => this.service.getAttendanceRequests(page, pageSize);
  const successMessage = "Attendance requests retrieved successfully!";
  const errorMessage = "Error retrieving attendance requests:";
  const activityLog = `Fetched attendance requests (page: ${page}, pageSize: ${pageSize})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async createAttendanceRequest(req: Request, res: Response) {
  const attendanceRequestData: AttendanceRequest = req.body;
  const operation = () => this.service.createAttendanceRequest(attendanceRequestData);
  const successMessage = "Attendance request created successfully!";
  const errorMessage = "Error creating attendance request:";
  const activityLog = `Created attendance request (employeeId: ${attendanceRequestData?.employeeId || ''})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req, attendanceRequestData?.employeeId);
  }

  async updateAttendanceRequest(req: Request, res: Response) {
  const { id, data } = req.body;
  const operation = () => this.service.updateAttendanceRequest(id, data);
  const successMessage = "Attendance request updated successfully!";
  const errorMessage = "Error updating attendance request:";
  const activityLog = `Updated attendance request (id: ${id})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async deleteAttendanceRequest(req: Request, res: Response) {
  const { id } = req.body;
  const operation = () => this.service.deleteAttendanceRequest(id);
  const successMessage = "Attendance request deleted successfully!";
  const errorMessage = "Error deleting attendance request:";
  const activityLog = `Deleted attendance request (id: ${id})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async restoreAttendanceRequest(req: Request, res: Response) {
  const { requestId } = req.body;
  const operation = () => this.service.restoreAttendanceRequest(requestId);
  const successMessage = "Attendance request restored successfully!";
  const errorMessage = "Error restoring attendance request:";
  const activityLog = `Restored attendance request (id: ${requestId})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req, requestId);
  }

  async getAttendanceRequestById(req: Request, res: Response) {
  const { id } = req.body;
  const operation = () => this.service.getAttendanceRequestById(id);
  const successMessage = "Attendance request retrieved successfully!";
  const errorMessage = "Error retrieving attendance request:";
  const activityLog = `Fetched attendance request by id (id: ${id})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async getAttendanceRequestsByEmployeeId(req: Request, res: Response) {
  const { employeeId } = req.body;
  const operation = () => this.service.getAttendanceRequestsByEmployeeId(employeeId);
  const successMessage = "Attendance requests for the employee retrieved successfully!";
  const errorMessage = "Error retrieving attendance requests for the employee:";
  const activityLog = `Fetched attendance requests by employeeId (employeeId: ${employeeId})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req, employeeId);
  }

  async getDeletedAttendanceRequests(req: Request, res: Response) {
  const { page, pageSize } = req.body;
  const operation = () => this.service.getDeletedAttendanceRequests(page, pageSize);
  const successMessage = "Deleted attendance requests retrieved successfully!";
  const errorMessage = "Error retrieving deleted attendance requests:";
  const activityLog = `Fetched deleted attendance requests (page: ${page}, pageSize: ${pageSize})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async searchAttendanceRequests(req: Request, res: Response) {
  const { searchTerm, page, pageSize } = req.body;
  const operation = () => this.service.searchAttendanceRequests(searchTerm, page, pageSize);
  const successMessage = "Attendance requests retrieved successfully!";
  const errorMessage = "Error retrieving attendance requests:";
  const activityLog = `Searched attendance requests (searchTerm: ${searchTerm}, page: ${page}, pageSize: ${pageSize})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getTotalAttendanceRequests(req: Request, res: Response) {
  const operation = () => this.service.getTotalAttendanceRequests();
  const successMessage = "Total attendance requests count retrieved successfully!";
  const errorMessage = "Error retrieving total attendance requests count:";
  const activityLog = `Fetched total attendance requests count`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async updateAttendanceRequestStatus(req: Request, res: Response) {
  const { id, status } = req.body;
  const operation = () => this.service.updateAttendanceRequestStatus(id, status);
  const successMessage = "Attendance request status updated successfully!";
  const errorMessage = "Error updating attendance request status:";
  const activityLog = `Updated attendance request status (id: ${id}, status: ${status})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }
}

export default AttendanceReqController;
