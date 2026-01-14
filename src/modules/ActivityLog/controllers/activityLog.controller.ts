import { Request, Response } from "express";
import BaseController from "../../../core/controllers/base.controller";
import ActivityLogService from "../services/activityLog.service";
import { ActivityLogQuery } from "../types/activityLog";

class ActivityLogController extends BaseController<ActivityLogService> {
  protected service = new ActivityLogService();

  async getAllActivityLogs(req: Request, res: Response) {
    const query: ActivityLogQuery = {
      userId: req.query.userId as string,
      action: req.query.action as string,
      entityType: req.query.entityType as string,
      entityId: req.query.entityId as string,
      from: req.query.from ? new Date(req.query.from as string) : undefined,
      to: req.query.to ? new Date(req.query.to as string) : undefined,
    };

    const operation = () => this.service.getAllActivityLogs(query);
    await this.handleRequest(operation, res, { successMessage: "Activity logs retrieved successfully!" });
  }

  async getActivityLogs(req: Request, res: Response) {
    const { page, pageSize, userId, action, entityType, entityId, from, to } = req.body;
    
    const query: ActivityLogQuery = {
      page: page || 1,
      pageSize: pageSize || 10,
      userId,
      action,
      entityType,
      entityId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    };

    const operation = () => this.service.getActivityLogs(query);
    await this.handleRequest(operation, res, { successMessage: "Activity logs retrieved successfully!" });
  }

  async getActivityLogById(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.getActivityLogById(id);
    await this.handleRequest(operation, res, { successMessage: "Activity log retrieved successfully!" });
  }

  async getActivityLogCount(req: Request, res: Response) {
    const query: ActivityLogQuery = {
      userId: req.query.userId as string,
      action: req.query.action as string,
      entityType: req.query.entityType as string,
      entityId: req.query.entityId as string,
      from: req.query.from ? new Date(req.query.from as string) : undefined,
      to: req.query.to ? new Date(req.query.to as string) : undefined,
    };

    const operation = () => this.service.getActivityLogCount(query);
    await this.handleRequest(operation, res, { successMessage: "Activity log count retrieved successfully!" });
  }

  async getActivityLogsByUser(req: Request, res: Response) {
    const { userId, page, pageSize, action, entityType, from, to } = req.body;
    
    const query: Omit<ActivityLogQuery, 'userId'> = {
      page: page || 1,
      pageSize: pageSize || 10,
      action,
      entityType,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    };

    const operation = () => this.service.getActivityLogsByUser(userId, query);
    await this.handleRequest(operation, res, { successMessage: "User activity logs retrieved successfully!" });
  }

  async getActivityLogsByEntity(req: Request, res: Response) {
    const { entityType, entityId, page, pageSize, userId, action, from, to } = req.body;
    
    const query: Omit<ActivityLogQuery, 'entityType' | 'entityId'> = {
      page: page || 1,
      pageSize: pageSize || 10,
      userId,
      action,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    };

    const operation = () => this.service.getActivityLogsByEntity(entityType, entityId, query);
    await this.handleRequest(operation, res, { successMessage: "Entity activity logs retrieved successfully!" });
  }

  async getActivityLogsByUnit(req: Request, res: Response) {
    const { unitId, page, pageSize, action, entityType, entityId, from, to } = req.body;
    
    if (!unitId) {
      return res.status(400).json({ 
        success: false,
        message: "Unit ID is required",
        statusCode: 400
      });
    }
    
    const query: Omit<ActivityLogQuery, 'userId'> = {
      page: page || 1,
      pageSize: pageSize || 10,
      action,
      entityType,
      entityId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    };

    const operation = () => this.service.getActivityLogsByUnit(unitId, query);
    await this.handleRequest(operation, res, { successMessage: "Unit activity logs retrieved successfully!" });
  }

  async getMyActivityLogs(req: Request, res: Response) {
    const userId = (req as Request & { userId?: string }).userId;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false,
        message: "User not authenticated",
        statusCode: 401
      });
    }

    // Support both GET (query params) and POST (body) for flexibility
    const page = req.body?.page || parseInt(req.query.page as string) || 1;
    const pageSize = req.body?.pageSize || parseInt(req.query.pageSize as string) || 10;
    const action = req.body?.action || req.query.action as string;
    const entityType = req.body?.entityType || req.query.entityType as string;
    const from = req.body?.from || req.query.from ? new Date(req.body?.from || req.query.from as string) : undefined;
    const to = req.body?.to || req.query.to ? new Date(req.body?.to || req.query.to as string) : undefined;
    
    const query: Omit<ActivityLogQuery, 'userId'> = {
      page,
      pageSize,
      action,
      entityType,
      from,
      to,
    };

    const operation = () => this.service.getActivityLogsByUser(userId, query);
    await this.handleRequest(operation, res, { successMessage: "Your activity logs retrieved successfully!" });
  }
}

export default ActivityLogController;
