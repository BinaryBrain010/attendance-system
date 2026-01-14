import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import GroupService from "../service/group.service";
import { Group } from "../types/group";
import { createGroup } from "../types/group";
import AuthHelper from "../../../../Auth/helper/auth.helper";

class GroupController extends BaseController<GroupService> {
  protected service = new GroupService();

  async getAllGroups(req: Request, res: Response) {
    let operation = () => this.service.getAllGroups();
    let successMessage = "Groups retrieved successfully!";
    let errorMessage = "Error retrieving groups:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getAllGroupsWithFilters(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';
    const filter = req.query.filter as string;
    const search = req.query.search as string;

    const operation = async () => {
      return await this.service.getGroupsWithPagination(
        page,
        pageSize,
        sortBy,
        sortOrder,
        filter,
        search
      );
    };

    await this.handleRequest(operation, res, { successMessage: "Groups retrieved successfully!" });
  }

  async getGroups(req: Request, res: Response) {
    let id = AuthHelper.getUserIdFromHeader(req);
    if (id) {
      let { page, pageSize } = req.body;
      let operation = () => this.service.getGroups(page, pageSize, id);
      let successMessage = "Groups retrieved successfully!";
      let errorMessage = "Error retrieving Groups:";
      await this.handleRequest(operation, res, { successMessage });
    }
  }

  async getGroupByGroupId(req: Request, res: Response) {
    let { id } = req.body;
    let operation = () => this.service.getDetailedGroupById(id);
    let successMessage = "Group retrieved successfully!";
    let errorMessage = "Error retrieving Group:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getTotalGroups(req: Request, res: Response) {
    // const id = AuthHelper.getUserIdFromHeader(req);
    // if (id) {
      let operation = () => this.service.totalGroups();
      let successMessage = "Groups retrieved successfully!";
      let errorMessage = "Error retrieving groups:";
      await this.handleRequest(operation, res, { successMessage });
    // }
  }

  async createGroup(req: Request, res: Response) {
    let groupData: createGroup = req.body;
    let operation = () => this.service.createGroup(groupData);
    let successMessage = "Group created successfully!";
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "CREATE",
        entityType: "Group",
        entityId: (result: any) => result?.id || result?.data?.id,
        description: `Group created: ${groupData.name || 'N/A'}`,
        metadata: {
          name: groupData.name
        }
      },
      req
    });
  }

  async updateGroup(req: Request, res: Response) {
    let { id, data } = req.body;
    let operation = () => this.service.updateGroup(id, data);
    let successMessage = "Group updated successfully!";
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "UPDATE",
        entityType: "Group",
        entityId: id,
        description: `Group updated: ${data.name || 'N/A'}`,
        metadata: {
          changes: data,
          groupId: id
        }
      },
      req
    });
  }

  async deleteGroup(req: Request, res: Response) {
    let { id } = req.body;
    let operation = () => this.service.deleteGroup(id);
    let successMessage = "Group deleted successfully!";
    let errorMessage = "Error deleting group:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async restoreGroup(req: Request, res: Response) {
    let { id } = req.body;
    let operation = () => this.service.restoreGroup(id);
    let successMessage = "Group restored successfully!";
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "RESTORE",
        entityType: "Group",
        entityId: id,
        description: "Group restored"
      },
      req
    });
  }

  async getGroupById(req: Request, res: Response) {
    // const userId = AuthHelper.getUserIdFromHeader(req);
    // if (userId) {
      let { id } = req.body;
      let operation = () => this.service.getById(id);
      let successMessage = "Group retrieved successfully!";
      let errorMessage = "Error retrieving group:";
      await this.handleRequest(operation, res, { successMessage });
    // }
  }

  async getGroupByName(req: Request, res: Response) {
    let { name } = req.body;
    let operation = () => this.service.getByName(name);
    let successMessage = "Group retrieved successfully!";
    let errorMessage = "Error retrieving group:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async searchGroups(req: Request, res: Response) {
    // let id = AuthHelper.getUserIdFromHeader(req);
    // if (id) {
      let { searchTerm, page, pageSize } = req.body;
      let operation = () =>
        this.service.searchGroups(searchTerm, page, pageSize);
      let successMessage = "Search results retrieved successfully!";
      let errorMessage = "Error retrieving search results:";
      await this.handleRequest(operation, res, { successMessage });
    }
//   }
}

export default GroupController;
