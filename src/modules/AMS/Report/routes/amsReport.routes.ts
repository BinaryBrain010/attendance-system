import { Router, Request, Response } from "express";
import AmsReportController from "../controllers/amsReport.controller";

/**
 * Mounts at /amsReport. Read routes -> ams.report.read.*, export routes -> ams.report.export.*
 * (mapped explicitly in qa/featuremap2.ts). Everything is unit-scoped server-side.
 */
class AmsReportRoutes {
  private router: Router;
  private controller: AmsReportController;
  constructor() {
    this.router = Router();
    this.controller = new AmsReportController();
    this.initializeRoutes();
  }
  private simple(name: string) {
    return (req: Request, res: Response) => { (req.body ||= {}).report = name; return this.controller.simple(req, res); };
  }
  private initializeRoutes(): void {
    // Monthly employee report
    this.router.post("/monthly", this.controller.monthly.bind(this.controller));
    this.router.post("/monthly/excel", this.controller.monthlyExcel.bind(this.controller));
    this.router.post("/monthly/pdf", this.controller.monthlyPdf.bind(this.controller));
    this.router.post("/slip/pdf", this.controller.monthlySlip.bind(this.controller));
    this.router.post("/monthly/remark", this.controller.saveRemark.bind(this.controller));
    // Other reports (JSON)
    this.router.post("/daily", this.simple("daily"));
    this.router.post("/lateComers", this.simple("lateComers"));
    this.router.post("/absentees", this.simple("absentees"));
    this.router.post("/leaveBalance", this.simple("leaveBalance"));
    this.router.post("/byUnit", this.simple("byUnit"));
    this.router.post("/probation", this.simple("probation"));
    // Export (generic): CSV/Excel + landscape PDF
    this.router.post("/export", this.controller.export.bind(this.controller));
    this.router.post("/pdf", this.controller.pdf.bind(this.controller));
  }
  public getRouter(): Router { return this.router; }
}

export default AmsReportRoutes;
