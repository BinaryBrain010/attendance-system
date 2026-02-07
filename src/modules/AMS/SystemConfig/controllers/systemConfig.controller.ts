import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import SystemConfigService from "../services/systemConfig.service";
import { SystemConfigData } from "../types/systemConfig";

const READ_FEATURE = "systemConfig.read.*";
const UPDATE_FEATURE = "systemConfig.update.*";

class SystemConfigController extends BaseController<typeof SystemConfigService> {
  protected service = SystemConfigService;

  private async checkPermission(req: Request, feature: string): Promise<boolean> {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) return false;
    try {
      const accessModel = (await import("../../../rbac/Access/models/access.model")).default;
      return await accessModel.user.checkUserPermission(userId, feature);
    } catch {
      return false;
    }
  }

  async getConfig(req: Request, res: Response) {
    const hasPermission = await this.checkPermission(req, READ_FEATURE);
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to read system configuration.",
        statusCode: 403,
      });
    }
    const operation = () => this.service.getConfig();
    await this.handleRequest(operation, res, {
      successMessage: "System config retrieved successfully.",
    });
  }

  async updateConfig(req: Request, res: Response) {
    const hasPermission = await this.checkPermission(req, UPDATE_FEATURE);
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to update system configuration.",
        statusCode: 403,
      });
    }
    const updates: Partial<SystemConfigData> = req.body;
    const operation = () => this.service.updateConfig(updates);
    await this.handleRequest(operation, res, {
      successMessage: "System config updated successfully.",
      logActivity: {
        action: "UPDATE",
        entityType: "SystemConfig",
        entityId: "default",
        description: "System configuration updated",
        metadata: { keys: Object.keys(updates || {}) },
      },
      req,
    });
  }
}

export default new SystemConfigController();
