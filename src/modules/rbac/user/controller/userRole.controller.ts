import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import UserRoleService from "../service/userRole.service";
import { UserRole} from "../types/user";
import AuthHelper from "../../../../Auth/helper/auth.helper";

class UserRoleController extends BaseController<UserRoleService> {
  protected service = new UserRoleService();
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

  async getAllUserRoles(req: Request, res: Response) {
    let operation = () => this.service.getAllUserRoles();
    let successMessage = "User roles retrieved successfully!";
    let errorMessage = "Error retrieving user roles:";
    let activityLog = `Fetched all user roles`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getUserRoleById(req: Request, res: Response) {
    // const userId = AuthHelper.getUserIdFromHeader(req);
    // if (userId) {
      let { id } = req.body;
      let operation = () => this.service.getById(id);
      let successMessage = "User role retrieved successfully!";
      let errorMessage = "Error retrieving user role:";
        let activityLog = `Fetched user role with ID: ${id}`;
        this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
    // }
  }



  async getUserRoleByUserId(req: Request, res: Response) {
    let { id } = req.body;
    let operation = () => this.service.getByUserId(id);
    let successMessage = "User role retrieved successfully!";
    let errorMessage = "Error retrieving user role:";
     let activityLog = `Fetched user roles for user ID: ${id}`;
     this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async createUserRole(req: Request, res: Response) {
    let userRoleData: UserRole | UserRole[] = req.body;
    let operation = () => this.service.createUserRole(userRoleData);
    let successMessage = "User role created successfully!";
    let errorMessage = "Error creating user role:";
     let activityLog = `Created user role(s)`;
     this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async updateUserRole(req: Request, res: Response) {
    let { id, data } = req.body;
    let operation = () => this.service.updateUserRole(id, data);
    let successMessage = "User role updated successfully!";
    let errorMessage = "Error updating user role:";
     let activityLog = `Updated user role with ID: ${id}`;
     this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async deleteUserRole(req: Request, res: Response) {
    let { id } = req.body;
    let operation = () => this.service.deleteUserRole(id);
    let successMessage = "User role deleted successfully!";
    let errorMessage = "Error deleting user role:";
     let activityLog = `Deleted user role with ID: ${id}`;
     this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async restoreUserRole(req: Request, res: Response) {
    let { id } = req.body;
    let operation = () => this.service.restoreUserRole(id);
    let successMessage = "User role restored successfully!";
    let errorMessage = "Error restoring user role:";
     let activityLog = `Restored user role with ID: ${id}`;
     this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }
}

export default UserRoleController;
