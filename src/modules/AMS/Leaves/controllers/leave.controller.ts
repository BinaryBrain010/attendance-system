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
    const errorMessage = "Error creating leave configuration:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async updateLeaveConfiguration(req: Request, res: Response) {
    const { id, leaveConfigData } = req.body;
    const operation = () =>
      this.service.updateLeaveConfiguration(id, leaveConfigData);
    const successMessage = "Leave configuration updated successfully!";
    const errorMessage = "Error updating leave configuration:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async deleteLeaveConfiguration(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.deleteLeaveConfiguration(id);
    const successMessage = "Leave configuration deleted successfully!";
    const errorMessage = "Error deleting leave configuration:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async restoreLeaveConfiguration(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.restoreLeaveConfiguration(id);
    const successMessage = "Leave configuration restored successfully!";
    const errorMessage = "Error restoring leave configuration:";
    await this.handleRequest(operation, res, { successMessage });
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
