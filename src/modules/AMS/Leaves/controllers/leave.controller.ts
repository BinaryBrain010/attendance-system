import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import LeaveService from "../services/leave.service";
import { LeaveConfiguration } from "../types/leave";

class LeaveController extends BaseController<LeaveService> {
  protected service = new LeaveService();

  async getAllLeaveConfigurations(req: Request, res: Response) {
    const operation = () => this.service.getAllLeaveConfigurations();
    const successMessage = "Leave configurations retrieved successfully!";
    const errorMessage = "Error retrieving leave configurations:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getLeaveConfigurations(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    const operation = () => this.service.getLeaveConfigurations(page, pageSize);
    const successMessage = "Leave configurations retrieved successfully!";
    const errorMessage = "Error retrieving leave configurations:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async createLeaveConfiguration(req: Request, res: Response) {
    const leaveConfigData: LeaveConfiguration | LeaveConfiguration[] = req.body;
    const operation = () =>
      this.service.createLeaveConfiguration(leaveConfigData);
    const successMessage = "Leave configuration created successfully!";
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "CREATE",
        entityType: "LeaveConfiguration",
        entityId: (result: any) => Array.isArray(result) ? result[0]?.id : result?.id || result?.data?.id,
        description: Array.isArray(leaveConfigData) 
          ? `Bulk leave configurations created: ${leaveConfigData.length} item(s)`
          : `Leave configuration created: ${leaveConfigData.name || 'N/A'}`,
        metadata: {
          isBulk: Array.isArray(leaveConfigData),
          count: Array.isArray(leaveConfigData) ? leaveConfigData.length : 1
        }
      },
      req
    });
  }

  async updateLeaveConfiguration(req: Request, res: Response) {
    const { id, leaveConfigData } = req.body;
    const operation = () =>
      this.service.updateLeaveConfiguration(id, leaveConfigData);
    const successMessage = "Leave configuration updated successfully!";
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "UPDATE",
        entityType: "LeaveConfiguration",
        entityId: id,
        description: `Leave configuration updated: ${leaveConfigData.name || 'N/A'}`,
        metadata: {
          changes: leaveConfigData,
          leaveConfigId: id
        }
      },
      req
    });
  }

  async deleteLeaveConfiguration(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.deleteLeaveConfiguration(id);
    const successMessage = "Leave configuration deleted successfully!";
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "DELETE",
        entityType: "LeaveConfiguration",
        entityId: id,
        description: "Leave configuration deleted"
      },
      req
    });
  }

  async restoreLeaveConfiguration(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.restoreLeaveConfiguration(id);
    const successMessage = "Leave configuration restored successfully!";
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "RESTORE",
        entityType: "LeaveConfiguration",
        entityId: id,
        description: "Leave configuration restored"
      },
      req
    });
  }

  async getLeaveConfigurationById(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () =>
      this.service.getLeaveConfigurationById(id);
    const successMessage = "Leave configuration retrieved successfully!";
    const errorMessage = "Error retrieving leave configuration:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getDeletedLeaveConfigurations(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    const operation = () =>
      this.service.getDeletedLeaveConfigurations(page, pageSize);
    const successMessage =
      "Deleted leave configurations retrieved successfully!";
    const errorMessage = "Error retrieving deleted leave configurations:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async searchLeaveConfigurations(req: Request, res: Response) {
    const { searchTerm, page, pageSize } = req.body;
    const operation = () =>
      this.service.searchLeaveConfigurations(searchTerm, page, pageSize);
    const successMessage = "Leave configurations retrieved successfully!";
    const errorMessage = "Error searching leave configurations:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getTotalLeaveConfigurations(req: Request, res: Response) {
    const operation = () => this.service.getTotalLeaveConfigurations();
    const successMessage =
      "Total count of leave configurations retrieved successfully!";
    const errorMessage = "Error retrieving total count of leave configurations:";
    await this.handleRequest(operation, res, { successMessage });
  }
}

export default LeaveController;
