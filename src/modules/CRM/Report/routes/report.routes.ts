import { Router } from "express";
import ReportController from "../controllers/report.controller";

/** Mounts at /crmReport. All read-only; margin + export are cost-gated. */
class CrmReportRoutes {
  private router: Router;
  private controller: ReportController;

  constructor() {
    this.router = Router();
    this.controller = new ReportController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post("/pipeline", this.controller.pipeline.bind(this.controller));
    this.router.post("/funnel", this.controller.funnel.bind(this.controller));
    this.router.post("/salesByOutlet", this.controller.salesByOutlet.bind(this.controller));
    this.router.post("/margin", this.controller.margin.bind(this.controller));
    this.router.post("/export", this.controller.exportExcel.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default CrmReportRoutes;
