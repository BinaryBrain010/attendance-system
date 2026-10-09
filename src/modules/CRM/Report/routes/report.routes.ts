import { Router } from "express";
import ReportController from "../controllers/report.controller";

/** Mounts at /crmReport. All read-only; margin + export are cost-gated in the controller. */
class CrmReportRoutes {
  private router: Router;
  private controller: ReportController;

  constructor() {
    this.router = Router();
    this.controller = new ReportController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post("/dashboard", this.controller.dashboard.bind(this.controller));
    this.router.post("/agentPerformance", this.controller.agentPerformance.bind(this.controller));
    this.router.post("/funnel", this.controller.funnel.bind(this.controller));
    this.router.post("/pipeline", this.controller.pipeline.bind(this.controller));
    this.router.post("/sales", this.controller.sales.bind(this.controller));
    this.router.post("/lostReasons", this.controller.lostReasons.bind(this.controller));
    this.router.post("/returns", this.controller.returns.bind(this.controller));
    this.router.post("/leadAging", this.controller.leadAging.bind(this.controller));
    this.router.post("/repeatCustomers", this.controller.repeatCustomers.bind(this.controller));
    this.router.post("/dailySummary", this.controller.dailySummary.bind(this.controller));
    this.router.post("/margin", this.controller.margin.bind(this.controller));
    this.router.post("/export", this.controller.export.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default CrmReportRoutes;
