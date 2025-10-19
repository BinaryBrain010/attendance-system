import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import UserGroupService from "../service/userGroup.service";
import { UserGroup } from "../types/group";
import AuthHelper from "../../../../Auth/helper/auth.helper";

class UserGroupController extends BaseController<UserGroupService> {
  protected service = new UserGroupService();
  protected moduleName: string = "RBAC";

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

  async getAllUserGroups(req: Request, res: Response) {
    let operation = () => this.service.getAllUserGroups();
    let successMessage = "User groups retrieved successfully!";
    let errorMessage = "Error retrieving user groups:";
    let activityLog = `Fetched all user groups`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getUserGroupById(res: Response, req: Request) {
    // const userId = AuthHelper.getUserIdFromHeader(req);
    // if (userId) {
      let { id } = req.body;
      let operation = () => this.service.getById(id);
      let successMessage = "User group retrieved successfully!";
      let errorMessage = "Error retrieving user group:";
      let activityLog = `Fetched user group with ID: ${id}`;
      this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
    // }
  }

  async getUserGroupByUserId(req: Request, res: Response) {
    let { id } = req.body;
    let operation = () => this.service.getByUserId(id);
    let successMessage = "User group retrieved successfully!";
    let errorMessage = "Error retrieving user group:";
    let activityLog = `Fetched user groups for user ID: ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async createUserGroup(req: Request, res: Response) {
    let userGroupData: UserGroup | UserGroup[] = req.body;
    let operation = () => this.service.createUserGroup(userGroupData);
    let successMessage = "User group created successfully!";
    let errorMessage = "Error creating user group:";
    let activityLog = `Created user group(s)`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async updateUserGroup(req: Request, res: Response) {
    let { id, data } = req.body;
    let operation = () => this.service.updateUserGroup(id, data);
    let successMessage = "User group updated successfully!";
    let errorMessage = "Error updating user group:";
    let activityLog = `Updated user group with ID: ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async deleteUserGroup(req: Request, res: Response) {
    let { id } = req.body;
    let operation = () => this.service.deleteUserGroup(id);
    let successMessage = "User group deleted successfully!";
    let errorMessage = "Error deleting user group:";
    let activityLog = `Deleted user group with ID: ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async restoreUserGroup(req: Request, res: Response) {
    let { id } = req.body;
    let operation = () => this.service.restoreUserGroup(id);
    let successMessage = "User group restored successfully!";
    let errorMessage = "Error restoring user group:";
    let activityLog = `Restored user group with ID: ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }
}

export default UserGroupController;
