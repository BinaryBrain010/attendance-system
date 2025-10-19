import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import LeaveReqService from "../services/leaveReq.service";
import { LeaveRequest } from "../types/leave";

class LeaveReqController extends BaseController<LeaveReqService> {
  protected service = new LeaveReqService();
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

  async getAllLeaveRequests(req: Request, res: Response) {
  const operation = () => this.service.getAllLeaveRequests();
  const successMessage = "Leave requests retrieved successfully!";
  const errorMessage = "Error retrieving leave requests:";
  const activityLog = `Fetched all leave requests`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getLeaveRequests(req: Request, res: Response) {
  const { page, pageSize } = req.body;
  const operation = () => this.service.getLeaveRequests(page, pageSize);
  const successMessage = "Leave requests retrieved successfully!";
  const errorMessage = "Error retrieving leave requests:";
  const activityLog = `Fetched leave requests (page: ${page}, pageSize: ${pageSize})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getLeaveRequestsByEmployeeId(req: Request, res: Response) {
  const { employeeId } = req.body;
  const operation = () => this.service.getLeaveRequestsByEmployeeId(employeeId);
  const successMessage = "Leave requests for the employee retrieved successfully!";
  const errorMessage = "Error retrieving leave requests for the employee:";
  const activityLog = `Fetched leave requests by employeeId (employeeId: ${employeeId})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req, employeeId);
  }

  async getDeletedLeaveRequests(req: Request, res: Response) {
  const { page, pageSize } = req.body;
  const operation = () => this.service.getDeletedLeaveRequests(page, pageSize);
  const successMessage = "Deleted leave requests retrieved successfully!";
  const errorMessage = "Error retrieving deleted leave requests:";
  const activityLog = `Fetched deleted leave requests (page: ${page}, pageSize: ${pageSize})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async searchLeaveRequests(req: Request, res: Response) {
  const { searchTerm, page, pageSize } = req.body;
  const operation = () => this.service.searchLeaveRequests(searchTerm, page, pageSize);
  const successMessage = "Leave requests retrieved successfully!";
  const errorMessage = "Error retrieving leave requests:";
  const activityLog = `Searched leave requests (searchTerm: ${searchTerm}, page: ${page}, pageSize: ${pageSize})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getTotalLeaveRequests(req: Request, res: Response) {
  const operation = () => this.service.getTotalLeaveRequests();
  const successMessage = "Total leave requests count retrieved successfully!";
  const errorMessage = "Error retrieving total leave requests count:";
  const activityLog = `Fetched total leave requests count`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async createLeaveRequest(req: Request, res: Response) {
  const leaveRequestData: LeaveRequest = req.body;
  const operation = () => this.service.createLeaveRequest(leaveRequestData);
  const successMessage = "Leave request created successfully!";
  const errorMessage = "Error creating leave request:";
  const activityLog = `Created leave request (employeeId: ${leaveRequestData?.employeeId || ''})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req, leaveRequestData?.employeeId);
  }

  async updateLeaveRequest(req: Request, res: Response) {
  const { id, data } = req.body;
  const operation = () => this.service.updateLeaveRequest(id, data);
  const successMessage = "Leave request updated successfully!";
  const errorMessage = "Error updating leave request:";
  const activityLog = `Updated leave request (id: ${id})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async deleteLeaveRequest(req: Request, res: Response) {
  const { id } = req.body;
  const operation = () => this.service.deleteLeaveRequest(id);
  const successMessage = "Leave request deleted successfully!";
  const errorMessage = "Error deleting leave request:";
  const activityLog = `Deleted leave request (id: ${id})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async restoreLeaveRequest(req: Request, res: Response) {
  const { requestId } = req.body;
  const operation = () => this.service.restoreLeaveRequest(requestId);
  const successMessage = "Leave request restored successfully!";
  const errorMessage = "Error restoring leave request:";
  const activityLog = `Restored leave request (id: ${requestId})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req, requestId);
  }

  async getLeaveRequestById(req: Request, res: Response) {
  const { requestId } = req.body;
  const operation = () => this.service.getLeaveRequestById(requestId);
  const successMessage = "Leave request retrieved successfully!";
  const errorMessage = "Error retrieving leave request:";
  const activityLog = `Fetched leave request by id (id: ${requestId})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req, requestId);
  }

  async updateLeaveRequestStatus(req: Request, res: Response) {
  const { id, status } = req.body;
  const operation = () => this.service.updateLeaveRequestStatus(id, status);
  const successMessage = "Leave request status updated successfully!";
  const errorMessage = "Error updating leave request status:";
  const activityLog = `Updated leave request status (id: ${id}, status: ${status})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }
}

export default LeaveReqController;
