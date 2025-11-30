import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import AttendanceReqService from "../services/attendanceReq.service";
import { AttendanceRequest } from "../types/AttendanceRequest";

class AttendanceReqController extends BaseController<AttendanceReqService> {
  protected service = new AttendanceReqService();

  async getAllAttendanceRequests(req: Request, res: Response) {
    const operation = () => this.service.getAllAttendanceRequests();
    await this.handleRequest(operation, res, { successMessage: "Attendance requests retrieved successfully!" });
  }

  async getAttendanceRequests(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    const operation = () => this.service.getAttendanceRequests(page, pageSize);
    await this.handleRequest(operation, res, { successMessage: "Attendance requests retrieved successfully!" });
  }

  async createAttendanceRequest(req: Request, res: Response) {
    const attendanceRequestData: AttendanceRequest = req.body;
    const operation = () => this.service.createAttendanceRequest(attendanceRequestData);
    await this.handleRequest(operation, res, { successMessage: "Attendance request created successfully!" });
  }

  async updateAttendanceRequest(req: Request, res: Response) {
    const { id, data } = req.body;
    const operation = () => this.service.updateAttendanceRequest(id, data);
    await this.handleRequest(operation, res, { successMessage: "Attendance request updated successfully!" });
  }

  async deleteAttendanceRequest(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.deleteAttendanceRequest(id);
    await this.handleRequest(operation, res, { successMessage: "Attendance request deleted successfully!" });
  }

  async restoreAttendanceRequest(req: Request, res: Response) {
    const { requestId } = req.body;
    const operation = () => this.service.restoreAttendanceRequest(requestId);
    await this.handleRequest(operation, res, { successMessage: "Attendance request restored successfully!" });
  }

  async getAttendanceRequestById(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.getAttendanceRequestById(id);
    await this.handleRequest(operation, res, { successMessage: "Attendance request retrieved successfully!" });
  }

  async getAttendanceRequestsByEmployeeId(req: Request, res: Response) {
    const { employeeId } = req.body;
    const operation = () => this.service.getAttendanceRequestsByEmployeeId(employeeId);
    await this.handleRequest(operation, res, { successMessage: "Attendance requests for the employee retrieved successfully!" });
  }

  async getDeletedAttendanceRequests(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    const operation = () => this.service.getDeletedAttendanceRequests(page, pageSize);
    await this.handleRequest(operation, res, { successMessage: "Deleted attendance requests retrieved successfully!" });
  }

  async searchAttendanceRequests(req: Request, res: Response) {
    const { searchTerm, page, pageSize } = req.body;
    const operation = () => this.service.searchAttendanceRequests(searchTerm, page, pageSize);
    await this.handleRequest(operation, res, { successMessage: "Attendance requests retrieved successfully!" });
  }

  async getTotalAttendanceRequests(req: Request, res: Response) {
    const operation = () => this.service.getTotalAttendanceRequests();
    await this.handleRequest(operation, res, { successMessage: "Total attendance requests count retrieved successfully!" });
  }

  async updateAttendanceRequestStatus(req: Request, res: Response) {
    const { id, status } = req.body;
    const operation = () => this.service.updateAttendanceRequestStatus(id, status);
    await this.handleRequest(operation, res, { successMessage: "Attendance request status updated successfully!" });
  }
}

export default AttendanceReqController;
