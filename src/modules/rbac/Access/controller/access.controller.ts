import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import AccessService from "../service/access.service";
import AuthHelper from "../../../../Auth/helper/auth.helper";
import jwt from "jsonwebtoken";
import { secretKey } from "../../../../environment/environment";
import BlackListedTokenService from "../../Token/service/token.service";


class AccessController extends BaseController<AccessService> {
  protected service = new AccessService();

  async getUserGroup(req: Request, res: Response) {
    let id = AuthHelper.getUserIdFromHeader(req);
    if (id) {
      const operation = () => this.service.getUserGroup(id);
      const successMessage = "User groups retrieved successfully!";
      const errorMessage = "Error retrieving user groups:";
      await this.handleRequest(operation, res, { successMessage });
    }
  }

  async getUserRole(req: Request, res: Response) {
    let id = AuthHelper.getUserIdFromHeader(req);
    if (id) {
      const operation = () => this.service.getUserRole(id);
      const successMessage = "User role retrieved successfully!";
      const errorMessage = "Error retrieving user role:";
      await this.handleRequest(operation, res, { successMessage });
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
  //     await this.handleRequest(operation, successMessage, errorMessage, res);
  //   }
  // }

  async getPermission(req: Request, res: Response) {
    const { id, feature } = req.body;
    if (id) {
      const operation = () => this.service.getPermission(id, feature);
      const successMessage = "Role permission retrieved successfully!";
      const errorMessage = "Error retrieving role permission:";
      await this.handleRequest(operation, res, { successMessage });
    }
  }

  // async getGroupPermission(req: Request, res: Response) {
  //   const {id, feature, permission } = req.body;

  //   if (id) {
  //     const operation = () =>
  //       this.service.getGroupPermission(id, feature, permission);
  //     const successMessage = "Group permission retrieved successfully!";
  //     const errorMessage = "Error retrieving group permission:";
  //     await this.handleRequest(operation, successMessage, errorMessage, res);
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
      await this.handleRequest(operation, res, { successMessage });
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
      await this.handleRequest(operation, res, { successMessage });
    }
  }

  async getPermissionsByToken(req: Request, res: Response) {
    try {
      // Get token from body, query, or header
      const token = req.body.token || req.query.token || AuthHelper.getTokenFromHeader(req);
      
      if (!token) {
        return res.status(400).json({
          success: false,
          message: "Token is required",
          statusCode: 400
        });
      }

      // Decode token to get userId
      let userId: string;
      try {
        const decoded: any = jwt.verify(token, secretKey || "");
        userId = decoded.userId;
      } catch (error: any) {
        return res.status(401).json({
          success: false,
          message: "Invalid or expired token",
          statusCode: 401
        });
      }

      // Verify token is not blacklisted
      const blackListedTokenService = new BlackListedTokenService();
      const isBlacklisted = await blackListedTokenService.isAuthenticatedToken(token);
      
      if (isBlacklisted) {
        return res.status(401).json({
          success: false,
          message: "Token has been revoked",
          statusCode: 401
        });
      }

      // Get all allowed features for the user
      const operation = () => this.service.getAllowedFeaturesForUser(userId);
      const successMessage = "Permissions retrieved successfully!";
      await this.handleRequest(operation, res, { successMessage });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: "Error retrieving permissions",
        error: error.message,
        statusCode: 500
      });
    }
  }
}

export default AccessController;
