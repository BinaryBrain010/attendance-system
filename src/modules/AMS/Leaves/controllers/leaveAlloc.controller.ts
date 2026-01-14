import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import LeaveAllocService from "../services/leaveAlloc.service";
import { LeaveAllocation } from "../types/leave";

class LeaveAllocController extends BaseController<LeaveAllocService> {
  protected service = new LeaveAllocService();

  async getAllLeaveAllocations(req: Request, res: Response) {
    const userId = (req as Request & { userId?: string }).userId;
    const operation = () => this.service.getAllLeaveAllocations(userId);
    const successMessage = "Leave allocations retrieved successfully!";
    const errorMessage = "Error retrieving leave allocations:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getLeaveAllocations(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    const userId = (req as Request & { userId?: string }).userId;
    const operation = () => this.service.getLeaveAllocations(page, pageSize, userId);
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
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "CREATE",
        entityType: "LeaveAllocation",
        entityId: (result: any) => result?.id || result?.data?.id,
        description: `Leave allocation created for employee ${leaveAllocData.employeeId}`,
        metadata: {
          employeeId: leaveAllocData.employeeId,
          leaveConfigId: leaveAllocData.leaveConfigId,
          allocatedDays: leaveAllocData.allocatedDays
        }
      },
      req
    });
  }

  async updateLeaveAllocation(req: Request, res: Response) {
    const { id, data } = req.body;
    const operation = () => this.service.updateLeaveAllocation(id, data);
    const successMessage = "Leave allocation updated successfully!";
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "UPDATE",
        entityType: "LeaveAllocation",
        entityId: id,
        description: `Leave allocation updated`,
        metadata: {
          changes: data,
          allocationId: id
        }
      },
      req
    });
  }

  async deleteLeaveAllocation(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.deleteLeaveAllocation(id);
    const successMessage = "Leave allocation deleted successfully!";
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "DELETE",
        entityType: "LeaveAllocation",
        entityId: id,
        description: "Leave allocation deleted"
      },
      req
    });
  }

  async restoreLeaveAllocation(req: Request, res: Response) {
    const { allocId } = req.body;
    const operation = () => this.service.restoreLeaveAllocation(allocId);
    const successMessage = "Leave allocation restored successfully!";
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "RESTORE",
        entityType: "LeaveAllocation",
        entityId: allocId,
        description: "Leave allocation restored"
      },
      req
    });
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

  async assignToAllEmployees(req: Request, res: Response) {
    const { leaveConfigId, assignedDays, allocationStartDate, allocationEndDate, note } = req.body;
    
    if (!leaveConfigId || !assignedDays || !allocationStartDate) {
      return res.status(400).json({ 
        message: "leaveConfigId, assignedDays, and allocationStartDate are required" 
      });
    }

    const startDate = new Date(allocationStartDate);
    const endDate = allocationEndDate ? new Date(allocationEndDate) : undefined;

    const operation = () => this.service.assignToAllEmployees(
      leaveConfigId,
      assignedDays,
      startDate,
      endDate,
      note
    );
    const successMessage = "Leave configuration assigned to all employees successfully!";
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "BULK_CREATE",
        entityType: "LeaveAllocation",
        description: `Leave configuration assigned to all employees`,
        metadata: {
          leaveConfigId,
          assignedDays,
          allocationStartDate: startDate,
          allocationEndDate: endDate,
          note
        }
      },
      req
    });
  }
}

export default LeaveAllocController;
