import { Router } from "express";
import WorkReportController from "../controllers/workReport.controller";

/** Mounts at /workReport. All read-only. */
class WorkReportRoutes {
  private router: Router;
  private controller: WorkReportController;
  constructor() {
    this.router = Router();
    this.controller = new WorkReportController();
    this.initializeRoutes();
  }
  private initializeRoutes(): void {
    this.router.post("/completion", this.controller.completion.bind(this.controller));
    this.router.post("/overdue", this.controller.overdue.bind(this.controller));
    this.router.post("/timeToComplete", this.controller.timeToComplete.bind(this.controller));
    this.router.post("/workload", this.controller.workload.bind(this.controller));
    this.router.post("/compliance", this.controller.compliance.bind(this.controller));
    this.router.post("/hours", this.controller.hours.bind(this.controller));
    this.router.post("/export", this.controller.export.bind(this.controller));
  }
  public getRouter(): Router { return this.router; }
}

export default WorkReportRoutes;
