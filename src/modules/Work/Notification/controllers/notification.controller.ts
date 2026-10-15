import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import NotificationService from "../services/notification.service";

const uid = (req: Request) => (req as any).userId as string;

class NotificationController extends BaseController<NotificationService> {
  protected service = new NotificationService();

  async list(req: Request, res: Response) {
    const { page, pageSize, onlyUnread } = req.body;
    await this.handleRequest(() => this.service.list(uid(req), page, pageSize, !!onlyUnread), res, { successMessage: "Notifications retrieved!" });
  }
  async unreadCount(req: Request, res: Response) {
    await this.handleRequest(() => this.service.unreadCount(uid(req)), res, { successMessage: "Unread count retrieved!" });
  }
  async markRead(req: Request, res: Response) {
    await this.handleRequest(() => this.service.markRead(uid(req), req.body?.id), res, { successMessage: "Marked read!" });
  }
}

export default NotificationController;
