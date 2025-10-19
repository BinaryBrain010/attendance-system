import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import LeaveAllocService from "../services/leaveAlloc.service";
import { LeaveAllocation } from "../types/leave";

class LeaveAllocController extends BaseController<LeaveAllocService> {
  protected service = new LeaveAllocService();
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

  async getAllLeaveAllocations(req: Request, res: Response) {
  const operation = () => this.service.getAllLeaveAllocations();
  const successMessage = "Leave allocations retrieved successfully!";
  const errorMessage = "Error retrieving leave allocations:";
  const activityLog = `Fetched all leave allocations`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getLeaveAllocations(req: Request, res: Response) {
  const { page, pageSize } = req.body;
  const operation = () => this.service.getLeaveAllocations(page, pageSize);
  const successMessage = "Leave allocations retrieved successfully!";
  const errorMessage = "Error retrieving leave allocations:";
  const activityLog = `Fetched leave allocations (page: ${page}, pageSize: ${pageSize})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getLeaveAllocationsByEmployeeId(req: Request, res: Response) {
  const { employeeId } = req.body;
  const operation = () => this.service.getLeaveAllocationsByEmployeeId(employeeId);
  const successMessage = "Leave allocations for the employee retrieved successfully!";
  const errorMessage = "Error retrieving leave allocations for the employee:";
  const activityLog = `Fetched leave allocations by employeeId (employeeId: ${employeeId})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req, employeeId);
  }

  async getDeletedLeaveAllocations(req: Request, res: Response) {
  const { page, pageSize } = req.body;
  const operation = () => this.service.getDeletedLeaveAllocations(page, pageSize);
  const successMessage = "Deleted leave allocations retrieved successfully!";
  const errorMessage = "Error retrieving deleted leave allocations:";
  const activityLog = `Fetched deleted leave allocations (page: ${page}, pageSize: ${pageSize})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async searchLeaveAllocations(req: Request, res: Response) {
  const { searchTerm, page, pageSize } = req.body;
  const operation = () => this.service.searchLeaveAllocations(searchTerm, page, pageSize);
  const successMessage = "Leave allocations retrieved successfully!";
  const errorMessage = "Error retrieving leave allocations:";
  const activityLog = `Searched leave allocations (searchTerm: ${searchTerm}, page: ${page}, pageSize: ${pageSize})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getTotalLeaveAllocations(req: Request, res: Response) {
  const operation = () => this.service.getTotalLeaveAllocations();
  const successMessage = "Total leave allocations count retrieved successfully!";
  const errorMessage = "Error retrieving total leave allocations count:";
  const activityLog = `Fetched total leave allocations count`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async createLeaveAllocation(req: Request, res: Response) {
  const leaveAllocData: LeaveAllocation = req.body;
  const operation = () => this.service.createLeaveAllocation(leaveAllocData);
  const successMessage = "Leave allocation created successfully!";
  const errorMessage = "Error creating leave allocation:";
  const activityLog = `Created leave allocation (employeeId: ${leaveAllocData?.employeeId || ''})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req, leaveAllocData?.employeeId);
  }

  async updateLeaveAllocation(req: Request, res: Response) {
  const { id, data } = req.body;
  const operation = () => this.service.updateLeaveAllocation(id, data);
  const successMessage = "Leave allocation updated successfully!";
  const errorMessage = "Error updating leave allocation:";
  const activityLog = `Updated leave allocation (id: ${id})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async deleteLeaveAllocation(req: Request, res: Response) {
  const { id } = req.body;
  const operation = () => this.service.deleteLeaveAllocation(id);
  const successMessage = "Leave allocation deleted successfully!";
  const errorMessage = "Error deleting leave allocation:";
  const activityLog = `Deleted leave allocation (id: ${id})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async restoreLeaveAllocation(req: Request, res: Response) {
  const { allocId } = req.body;
  const operation = () => this.service.restoreLeaveAllocation(allocId);
  const successMessage = "Leave allocation restored successfully!";
  const errorMessage = "Error restoring leave allocation:";
  const activityLog = `Restored leave allocation (id: ${allocId})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req, allocId);
  }

  async getLeaveAllocationById(req: Request, res: Response) {
  const { allocId } = req.body;
  const operation = () => this.service.getLeaveAllocationById(allocId);
  const successMessage = "Leave allocation retrieved successfully!";
  const errorMessage = "Error retrieving leave allocation:";
  const activityLog = `Fetched leave allocation by id (id: ${allocId})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req, allocId);
  }

  async getLeaveAllocationByEmployeeId(req: Request, res: Response) {
  const { employeeId } = req.body;
  const operation = () => this.service.getLeaveAllocationByEmployeeId(employeeId);
  const successMessage = "Leave allocation retrieved successfully!";
  const errorMessage = "Error retrieving leave allocation:";
  const activityLog = `Fetched leave allocation by employeeId (employeeId: ${employeeId})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req, employeeId);
  }
}

export default LeaveAllocController;
