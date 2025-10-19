import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import LeaveService from "../services/leave.service";
import { LeaveConfiguration } from "../types/leave";

class LeaveController extends BaseController<LeaveService> {
  protected service = new LeaveService();
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

  async getAllLeaveConfigurations(req: Request, res: Response) {
  const operation = () => this.service.getAllLeaveConfigurations();
  const successMessage = "Leave configurations retrieved successfully!";
  const errorMessage = "Error retrieving leave configurations:";
  const activityLog = `Fetched all leave configurations`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getLeaveConfigurations(req: Request, res: Response) {
  const { page, pageSize } = req.body;
  const operation = () => this.service.getLeaveConfigurations(page, pageSize);
  const successMessage = "Leave configurations retrieved successfully!";
  const errorMessage = "Error retrieving leave configurations:";
  const activityLog = `Fetched leave configurations (page: ${page}, pageSize: ${pageSize})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async createLeaveConfiguration(req: Request, res: Response) {
    const leaveConfigData: LeaveConfiguration | LeaveConfiguration[] = req.body;
    const operation = () =>
      this.service.createLeaveConfiguration(leaveConfigData);
    const successMessage = "Leave configuration created successfully!";
    const errorMessage = "Error creating leave configuration:";
    const activityLog = `Created leave configuration(s)`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async updateLeaveConfiguration(req: Request, res: Response) {
    const { id, leaveConfigData } = req.body;
    const operation = () =>
      this.service.updateLeaveConfiguration(id, leaveConfigData);
    const successMessage = "Leave configuration updated successfully!";
    const errorMessage = "Error updating leave configuration:";
    const activityLog = `Updated leave configuration (id: ${id})`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async deleteLeaveConfiguration(req: Request, res: Response) {
  const { id } = req.body;
  const operation = () => this.service.deleteLeaveConfiguration(id);
  const successMessage = "Leave configuration deleted successfully!";
  const errorMessage = "Error deleting leave configuration:";
  const activityLog = `Deleted leave configuration (id: ${id})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async restoreLeaveConfiguration(req: Request, res: Response) {
  const { id } = req.body;
  const operation = () => this.service.restoreLeaveConfiguration(id);
  const successMessage = "Leave configuration restored successfully!";
  const errorMessage = "Error restoring leave configuration:";
  const activityLog = `Restored leave configuration (id: ${id})`;
  this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async getLeaveConfigurationById(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () =>
      this.service.getLeaveConfigurationById(id);
    const successMessage = "Leave configuration retrieved successfully!";
    const errorMessage = "Error retrieving leave configuration:";
    const activityLog = `Fetched leave configuration by id (id: ${id})`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async getDeletedLeaveConfigurations(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    const operation = () =>
      this.service.getDeletedLeaveConfigurations(page, pageSize);
    const successMessage =
      "Deleted leave configurations retrieved successfully!";
    const errorMessage = "Error retrieving deleted leave configurations:";
    const activityLog = `Fetched deleted leave configurations (page: ${page}, pageSize: ${pageSize})`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async searchLeaveConfigurations(req: Request, res: Response) {
    const { searchTerm, page, pageSize } = req.body;
    const operation = () =>
      this.service.searchLeaveConfigurations(searchTerm, page, pageSize);
    const successMessage = "Leave configurations retrieved successfully!";
    const errorMessage = "Error searching leave configurations:";
    const activityLog = `Searched leave configurations (searchTerm: ${searchTerm}, page: ${page}, pageSize: ${pageSize})`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getTotalLeaveConfigurations(req: Request, res: Response) {
    const operation = () => this.service.getTotalLeaveConfigurations();
    const successMessage =
      "Total count of leave configurations retrieved successfully!";
    const errorMessage = "Error retrieving total count of leave configurations:";
    const activityLog = `Fetched total count of leave configurations`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }
}

export default LeaveController;
