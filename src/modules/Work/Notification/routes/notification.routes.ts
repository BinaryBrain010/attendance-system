import { Router } from "express";
import NotificationController from "../controllers/notification.controller";

/** Mounts at /notification. Personal — every method is own-user only (token access). */
class NotificationRoutes {
  private router: Router;
  private controller: NotificationController;
  constructor() {
    this.router = Router();
    this.controller = new NotificationController();
    this.initializeRoutes();
  }
  private initializeRoutes(): void {
    this.router.post("/get", this.controller.list.bind(this.controller));
    this.router.get("/unreadCount", this.controller.unreadCount.bind(this.controller));
    this.router.post("/markRead", this.controller.markRead.bind(this.controller));
  }
  public getRouter(): Router { return this.router; }
}

export default NotificationRoutes;
