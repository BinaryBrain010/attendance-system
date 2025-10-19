import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import AccessService from "../service/access.service";
import AuthHelper from "../../../../Auth/helper/auth.helper";


class AccessController extends BaseController<AccessService> {
  protected service = new AccessService();
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

  async getUserGroup(req: Request, res: Response) {
    let id = AuthHelper.getUserIdFromHeader(req);
    if (id) {
      const operation = () => this.service.getUserGroup(id);
      const successMessage = "User groups retrieved successfully!";
      const errorMessage = "Error retrieving user groups:";
      const activityLog = `Fetched user groups for user ID: ${id}`;
      await this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
    }
  }

  async getUserRole(req: Request, res: Response) {
    let id = AuthHelper.getUserIdFromHeader(req);
    if (id) {
      const operation = () => this.service.getUserRole(id);
      const successMessage = "User role retrieved successfully!";
      const errorMessage = "Error retrieving user role:";
        const activityLog = `Fetched user role for user ID: ${id}`;
        await this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
    }
  }

  // async getUserPermission(req: Request, res: Response) {
  //   const { feature, permission } = req.body;
  //   let id = AuthHelper.getUserIdFromHeader(req);
  //   if (id) {
  //     const operation = () =>
  //       this.service.getUserPermission(id, feature, permission);
  //     const successMessage = "User permission retrieved successfully!";
  //     const errorMessage = "Error retrieving user permission:";
  //     await this.handle(operation, successMessage, errorMessage, res);
  //   }
  // }

  async getPermission(req: Request, res: Response) {
    const { id, feature } = req.body;
    if (id) {
      const operation = () => this.service.getPermission(id, feature);
      const successMessage = "Role permission retrieved successfully!";
      const errorMessage = "Error retrieving role permission:";
        const activityLog = `Fetched permission for role ID: ${id}, feature: ${feature}`;
        await this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
    }
  }

  // async getGroupPermission(req: Request, res: Response) {
  //   const {id, feature, permission } = req.body;

  //   if (id) {
  //     const operation = () =>
  //       this.service.getGroupPermission(id, feature, permission);
  //     const successMessage = "Group permission retrieved successfully!";
  //     const errorMessage = "Error retrieving group permission:";
  //     await this.handle(operation, successMessage, errorMessage, res);
  //   }
  // }

  async checkPermission(req: Request, res: Response) {
    const { feature } = req.body;
    let id = AuthHelper.getUserIdFromHeader(req);
    // let companyId = AuthHelper.getCompanyIdFromHeader(req);
    if (id) {
      const operation = () => this.service.checkPermission(id, feature);
      const successMessage = "Permission checked successfully!";
      const errorMessage = "Error checking permission:";
        const activityLog = `Checked permission for user ID: ${id}, feature: ${feature}`;
        await this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
    }
  }

  async checkPermissions(req: Request, res: Response) {
    const { features } = req.body;
    let id = AuthHelper.getUserIdFromHeader(req);
    // let companyId = AuthHelper.getCompanyIdFromHeader(req);
    if (id) {
      const operation = () => this.service.checkPermissions(id, features);
      const successMessage = "Permission checked successfully!";
      const errorMessage = "Error checking permission:";
        const activityLog = `Checked permissions for user ID: ${id}, features: ${features}`;
        await this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
    }
  }
}

export default AccessController;
