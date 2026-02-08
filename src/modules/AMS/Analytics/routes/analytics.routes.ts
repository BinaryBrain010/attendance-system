import { Router } from "express";
import AnalyticsController from "../controllers/analytics.controller";

class AnalyticsRoutes {
  private router: Router;
  private controller: typeof AnalyticsController;

  constructor() {
    this.router = Router();
    this.controller = AnalyticsController;
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get("/personalAttendance", this.controller.getPersonalAttendanceAnalytics.bind(this.controller));
    this.router.post("/personalAttendance", this.controller.getPersonalAttendanceAnalytics.bind(this.controller));
    this.router.get("/topAttendance", this.controller.getTopAttendanceUsers.bind(this.controller));
  }

  getRouter(): Router {
    return this.router;
  }
}

export default AnalyticsRoutes;
