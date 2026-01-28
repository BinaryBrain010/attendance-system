import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import UserRoleService from "../service/userRole.service";
import { UserRole} from "../types/user";
import AuthHelper from "../../../../Auth/helper/auth.helper";

class UserRoleController extends BaseController<UserRoleService> {
  protected service = new UserRoleService();

  async getAllUserRoles(req: Request, res: Response) {
    let operation = () => this.service.getAllUserRoles();
    let successMessage = "User roles retrieved successfully!";
    let errorMessage = "Error retrieving user roles:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getUserRoleById(req: Request, res: Response) {
    // const userId = AuthHelper.getUserIdFromHeader(req);
    // if (userId) {
      let { id } = req.body;
      let operation = () => this.service.getById(id);
      let successMessage = "User role retrieved successfully!";
      let errorMessage = "Error retrieving user role:";
      await this.handleRequest(operation, res, { successMessage });
    // }
  }



  async getUserRoleByUserId(req: Request, res: Response) {
    let { id } = req.body;
    let operation = () => this.service.getByUserId(id);
    let successMessage = "User role retrieved successfully!";
    let errorMessage = "Error retrieving user role:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async createUserRole(req: Request, res: Response) {
    let userRoleData: UserRole | UserRole[] = req.body;
    let operation = () => this.service.createUserRole(userRoleData);
    let successMessage = "User role created successfully!";
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "CREATE",
        entityType: "UserRole",
        entityId: (result: any) => Array.isArray(result) ? result[0]?.id : result?.id || result?.data?.id,
        description: Array.isArray(userRoleData) 
          ? `Bulk user roles created: ${userRoleData.length} item(s)`
          : `User role created`,
        metadata: {
          isBulk: Array.isArray(userRoleData),
          count: Array.isArray(userRoleData) ? userRoleData.length : 1
        }
      },
      req
    });
  }

  async updateUserRole(req: Request, res: Response) {
    let { id, data } = req.body;
    let operation = () => this.service.updateUserRole(id, data);
    let successMessage = "User role updated successfully!";
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "UPDATE",
        entityType: "UserRole",
        entityId: id,
        description: `User role updated`,
        metadata: {
          changes: data,
          userRoleId: id
        }
      },
      req
    });
  }

  async deleteUserRole(req: Request, res: Response) {
    let { id } = req.body;
    let operation = () => this.service.deleteUserRole(id);
    let successMessage = "User role deleted successfully!";
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "DELETE",
        entityType: "UserRole",
        entityId: id,
        description: "User role deleted"
      },
      req
    });
  }

  async restoreUserRole(req: Request, res: Response) {
    let { id } = req.body;
    let operation = () => this.service.restoreUserRole(id);
    let successMessage = "User role restored successfully!";
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "RESTORE",
        entityType: "UserRole",
        entityId: id,
        description: "User role restored"
      },
      req
    });
  }
}

export default UserRoleController;
