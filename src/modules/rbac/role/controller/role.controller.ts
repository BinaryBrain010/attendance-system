import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import RoleService from "../service/role.service";
import { Role } from "../types/role";
import AuthHelper from "../../../../Auth/helper/auth.helper";
import { createRole } from "../types/role";
class RoleController extends BaseController<RoleService> {
  protected service = new RoleService();
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

  async getAllRoles(req: Request, res: Response) {
    let operation = () => this.service.getAllRoles();
    let successMessage = "Roles retrieved successfully!";
    let errorMessage = "Error retrieving roles:";
    let activityLog = `Fetched all roles`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getRoles(req: Request, res: Response) {
    let id = AuthHelper.getUserIdFromHeader(req);
    if (id) {
      let { page, pageSize } = req.body;
      let operation = () => this.service.getRoles(page, pageSize, id);
      let successMessage = "Roles retrieved successfully!";
      let errorMessage = "Error retrieving Roles:";
      let activityLog = `Fetched roles for page ${page} with size ${pageSize}`;
      await this.handle(operation, successMessage, errorMessage, activityLog, res, req);
    }
  }

  async getTotalRoles(req: Request, res: Response) {
    const id = AuthHelper.getUserIdFromHeader(req);
    if (id) {
      let operation = () => this.service.totalRoles(id);
      let successMessage = "Roles retrieved successfully!";
      let errorMessage = "Error retrieving roles:";
      let activityLog = `Fetched total roles count`;
      this.handle(operation, successMessage, errorMessage, activityLog, res, req);
    }
  }

  async getRoleById(req: Request, res: Response) {
    const userId = AuthHelper.getUserIdFromHeader(req);
    if (userId) {
      let { id } = req.body;
      let operation = () => this.service.getById(id, userId);
      let successMessage = "Role retrieved successfully!";
      let errorMessage = "Error retrieving role:";
      let activityLog = `Fetched role with ID: ${id}`;
      this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
    }
  }

  async getDetailedRoleById(req: Request, res: Response) {
    let { id } = req.body;
    let operation = () => this.service.getDetailedRoleById(id);
    let successMessage = "Role retrieved successfully!";
    let errorMessage = "Error retrieving role:";
    let activityLog = `Fetched detailed role with ID: ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async getRoleByName(req: Request, res: Response) {
    let { name } = req.body;
    let operation = () => this.service.getByName(name);
    let successMessage = "Role retrieved successfully!";
    let errorMessage = "Error retrieving role:";
    let activityLog = `Fetched role with name: ${name}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async createRole(req: Request, res: Response) {
    let roleData: createRole = req.body;
    let operation = () => this.service.createRole(roleData);
    let successMessage = "Role created successfully!";
    let errorMessage = "Error creating role:";
    let activityLog = `Created role: ${roleData.name}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async updateRole(req: Request, res: Response) {
    let { id, data } = req.body;
    let operation = () => this.service.updateRole(id, data);
    let successMessage = "Role updated successfully!";
    let errorMessage = "Error updating role:";
    let activityLog = `Updated role with ID: ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async changeRole(req: Request, res: Response) {
    let { role } = req.body;
    const id = AuthHelper.getUserIdFromHeader(req);
    let operation = () => this.service.changeRole(id, role);
    let successMessage = "Role updated successfully!";
    let errorMessage = "Error updating role:";
    let activityLog = `Changed role to: ${role}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async deleteRole(req: Request, res: Response) {
    let { id } = req.body;
    let operation = () => this.service.deleteRole(id);
    let successMessage = "Role deleted successfully!";
    let errorMessage = "Error deleting role:";
    let activityLog = `Deleted role with ID: ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async restoreRole(req: Request, res: Response) {
    let { id } = req.body;
    let operation = () => this.service.restoreRole(id);
    let successMessage = "Role restored successfully!";
    let errorMessage = "Error restoring role:";
    let activityLog = `Restored role with ID: ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async searchRoles(req: Request, res: Response) {
    let id = AuthHelper.getUserIdFromHeader(req);
    if (id) {
      let { searchTerm, page, pageSize } = req.body;
      let operation = () =>
        this.service.searchRoles(searchTerm, page, pageSize, id);
      let successMessage = "Search results retrieved successfully!";
      let errorMessage = "Error retrieving search results:";
      let activityLog = `Searched roles with term "${searchTerm}" for page ${page} with size ${pageSize}`;
      this.handle(operation, successMessage, errorMessage, activityLog, res, req);
    }
  }
}

export default RoleController;
