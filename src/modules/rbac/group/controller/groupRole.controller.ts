import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import GroupRoleService from "../service/groupRole.service";
import { GroupRole } from "../types/group";
import AuthHelper from "../../../../Auth/helper/auth.helper";

class GroupController extends BaseController<GroupRoleService> {
  protected service = new GroupRoleService();

  async getAllGroupRoles(req: Request, res: Response) {
    let operation = () => this.service.getAllGroupRoles();
    let successMessage = "Groups retrieved successfully!";
    let errorMessage = "Error retrieving groups:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async createGroupRole(req: Request, res: Response) {
    let groupData: GroupRole | GroupRole[] = req.body;
    let operation = () => this.service.createGroupRole(groupData);
    let successMessage = "Group created successfully!";
    let errorMessage = "Error creating group:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async updateGroupRole(req: Request, res: Response) {
    let { id, data } = req.body;
    let operation = () => this.service.updateGroupRole(id, data);
    let successMessage = "Group updated successfully!";
    let errorMessage = "Error updating group:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async deleteGroupRole(req: Request, res: Response) {
    let { id } = req.body;
    let operation = () => this.service.deleteGroupRole(id);
    let successMessage = "Group deleted successfully!";
    let errorMessage = "Error deleting group:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async restoreGroupRole(req: Request, res: Response) {
    let { id } = req.body;
    let operation = () => this.service.restoreGroupRole(id);
    let successMessage = "Group restored successfully!";
    let errorMessage = "Error restoring group:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getGroupRoleById(req: Request, res: Response) {
    // const userId = AuthHelper.getUserIdFromHeader(req);
    // if (userId) {
      let { id } = req.body;
      let operation = () => this.service.getById(id);
      let successMessage = "Group retrieved successfully!";
      let errorMessage = "Error retrieving group:";
      await this.handleRequest(operation, res, { successMessage });
    // }
  }
}

export default GroupController;
