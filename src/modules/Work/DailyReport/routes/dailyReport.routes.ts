import { Router } from "express";
import DailyReportController from "../controllers/dailyReport.controller";

/** Mounts at /dailyReport. */
class DailyReportRoutes {
  private router: Router;
  private controller: DailyReportController;
  constructor() {
    this.router = Router();
    this.controller = new DailyReportController();
    this.initializeRoutes();
  }
  private initializeRoutes(): void {
    this.router.post("/submit", this.controller.submit.bind(this.controller));
    this.router.post("/myToday", this.controller.myToday.bind(this.controller));
    this.router.post("/get", this.controller.get.bind(this.controller));
    this.router.post("/compliance", this.controller.compliance.bind(this.controller));
    this.router.post("/comment", this.controller.addComment.bind(this.controller));
  }
  public getRouter(): Router { return this.router; }
}

export default DailyReportRoutes;
