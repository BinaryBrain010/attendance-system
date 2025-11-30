import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import LeaveAllocService from "../services/leaveAlloc.service";
import { LeaveAllocation } from "../types/leave";

class LeaveAllocController extends BaseController<LeaveAllocService> {
  protected service = new LeaveAllocService();

  async getAllLeaveAllocations(req: Request, res: Response) {
    const operation = () => this.service.getAllLeaveAllocations();
    const successMessage = "Leave allocations retrieved successfully!";
    const errorMessage = "Error retrieving leave allocations:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getLeaveAllocations(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    const operation = () => this.service.getLeaveAllocations(page, pageSize);
    const successMessage = "Leave allocations retrieved successfully!";
    const errorMessage = "Error retrieving leave allocations:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getLeaveAllocationsByEmployeeId(req: Request, res: Response) {
    const { employeeId } = req.body;
    const operation = () => this.service.getLeaveAllocationsByEmployeeId(employeeId);
    const successMessage = "Leave allocations for the employee retrieved successfully!";
    const errorMessage = "Error retrieving leave allocations for the employee:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getDeletedLeaveAllocations(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    const operation = () => this.service.getDeletedLeaveAllocations(page, pageSize);
    const successMessage = "Deleted leave allocations retrieved successfully!";
    const errorMessage = "Error retrieving deleted leave allocations:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async searchLeaveAllocations(req: Request, res: Response) {
    const { searchTerm, page, pageSize } = req.body;
    const operation = () => this.service.searchLeaveAllocations(searchTerm, page, pageSize);
    const successMessage = "Leave allocations retrieved successfully!";
    const errorMessage = "Error retrieving leave allocations:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getTotalLeaveAllocations(req: Request, res: Response) {
    const operation = () => this.service.getTotalLeaveAllocations();
    const successMessage = "Total leave allocations count retrieved successfully!";
    const errorMessage = "Error retrieving total leave allocations count:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async createLeaveAllocation(req: Request, res: Response) {
    const leaveAllocData: LeaveAllocation = req.body;
    const operation = () => this.service.createLeaveAllocation(leaveAllocData);
    const successMessage = "Leave allocation created successfully!";
    const errorMessage = "Error creating leave allocation:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async updateLeaveAllocation(req: Request, res: Response) {
    const { id, data } = req.body;
    const operation = () => this.service.updateLeaveAllocation(id, data);
    const successMessage = "Leave allocation updated successfully!";
    const errorMessage = "Error updating leave allocation:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async deleteLeaveAllocation(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.deleteLeaveAllocation(id);
    const successMessage = "Leave allocation deleted successfully!";
    const errorMessage = "Error deleting leave allocation:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async restoreLeaveAllocation(req: Request, res: Response) {
    const { allocId } = req.body;
    const operation = () => this.service.restoreLeaveAllocation(allocId);
    const successMessage = "Leave allocation restored successfully!";
    const errorMessage = "Error restoring leave allocation:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getLeaveAllocationById(req: Request, res: Response) {
    const { allocId } = req.body;
    const operation = () => this.service.getLeaveAllocationById(allocId);
    const successMessage = "Leave allocation retrieved successfully!";
    const errorMessage = "Error retrieving leave allocation:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getLeaveAllocationByEmployeeId(req: Request, res: Response) {
    const { employeeId } = req.body;
    const operation = () => this.service.getLeaveAllocationByEmployeeId(employeeId);
    const successMessage = "Leave allocation retrieved successfully!";
    const errorMessage = "Error retrieving leave allocation:";
    await this.handleRequest(operation, res, { successMessage });
  }
}

export default LeaveAllocController;
