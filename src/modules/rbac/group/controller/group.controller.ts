import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import GroupService from "../service/group.service";
import { Group } from "../types/group";
import { createGroup } from "../types/group";
import AuthHelper from "../../../../Auth/helper/auth.helper";

class GroupController extends BaseController<GroupService> {
  protected service = new GroupService();
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

  async getAllGroups(req: Request, res: Response) {
    let operation = () => this.service.getAllGroups();
    let successMessage = "Groups retrieved successfully!";
    let errorMessage = "Error retrieving groups:";
    let activityLog = `Fetched all groups`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getGroups(req: Request, res: Response) {
    let id = AuthHelper.getUserIdFromHeader(req);
    if (id) {
      let { page, pageSize } = req.body;
      let operation = () => this.service.getGroups(page, pageSize, id);
      let successMessage = "Groups retrieved successfully!";
      let errorMessage = "Error retrieving Groups:";
      let activityLog = `Fetched groups for page ${page} with size ${pageSize}`;
      await this.handle(operation, successMessage, errorMessage, activityLog, res, req);
    }
  }

  async getGroupByGroupId(req: Request, res: Response) {
    let { id } = req.body;
    let operation = () => this.service.getDetailedGroupById(id);
    let successMessage = "Group retrieved successfully!";
    let errorMessage = "Error retrieving Group:";
    let activityLog = `Fetched detailed group with ID: ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async getTotalGroups(req: Request, res: Response) {
    // const id = AuthHelper.getUserIdFromHeader(req);
    // if (id) {
      let operation = () => this.service.totalGroups();
      let successMessage = "Groups retrieved successfully!";
      let errorMessage = "Error retrieving groups:";
      let activityLog = `Fetched total groups count`;
      this.handle(operation, successMessage, errorMessage, activityLog, res, req);
    // }
  }

  async createGroup(req: Request, res: Response) {
    let groupData: createGroup = req.body;
    let operation = () => this.service.createGroup(groupData);
    let successMessage = "Group created successfully!";
    let errorMessage = "Error creating group:";
    let activityLog = `Created group: ${groupData.name}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async updateGroup(req: Request, res: Response) {
    let { id, data } = req.body;
    let operation = () => this.service.updateGroup(id, data);
    let successMessage = "Group updated successfully!";
    let errorMessage = "Error updating group:";
    let activityLog = `Updated group with ID: ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async deleteGroup(req: Request, res: Response) {
    let { id } = req.body;
    let operation = () => this.service.deleteGroup(id);
    let successMessage = "Group deleted successfully!";
    let errorMessage = "Error deleting group:";
    let activityLog = `Deleted group with ID: ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async restoreGroup(req: Request, res: Response) {
    let { id } = req.body;
    let operation = () => this.service.restoreGroup(id);
    let successMessage = "Group restored successfully!";
    let errorMessage = "Error restoring group:";
    let activityLog = `Restored group with ID: ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async getGroupById(req: Request, res: Response) {
    // const userId = AuthHelper.getUserIdFromHeader(req);
    // if (userId) {
      let { id } = req.body;
      let operation = () => this.service.getById(id);
      let successMessage = "Group retrieved successfully!";
      let errorMessage = "Error retrieving group:";
      let activityLog = `Fetched group with ID: ${id}`;
      this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
    // }
  }

  async getGroupByName(req: Request, res: Response) {
    let { name } = req.body;
    let operation = () => this.service.getByName(name);
    let successMessage = "Group retrieved successfully!";
    let errorMessage = "Error retrieving group:";
    let activityLog = `Fetched group with name: ${name}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async searchGroups(req: Request, res: Response) {
    // let id = AuthHelper.getUserIdFromHeader(req);
    // if (id) {
      let { searchTerm, page, pageSize } = req.body;
      let operation = () =>
        this.service.searchGroups(searchTerm, page, pageSize);
      let successMessage = "Search results retrieved successfully!";
      let errorMessage = "Error retrieving search results:";
      let activityLog = `Searched groups with term "${searchTerm}" for page ${page} with size ${pageSize}`;
      await this.handle(operation, successMessage, errorMessage, activityLog, res, req);
    }
//   }
}

export default GroupController;
