import { Request, Response } from "express";
import ExcelJS from "exceljs";
import BaseController from "../../../../core/controllers/base.controller";
import ReportService from "../services/report.service";
import { canSeeCost } from "../../shared/cost";
import { ForbiddenError } from "../../../../core/errors/app.error";

class ReportController extends BaseController<ReportService> {
  protected service = new ReportService();

  async pipeline(req: Request, res: Response) {
    await this.handleRequest(() => this.service.pipeline((req as any).userId, req.body || {}), res, { successMessage: "Pipeline report ready" });
  }
  async funnel(req: Request, res: Response) {
    await this.handleRequest(() => this.service.funnel((req as any).userId, req.body || {}), res, { successMessage: "Funnel report ready" });
  }
  async salesByOutlet(req: Request, res: Response) {
    await this.handleRequest(() => this.service.salesByOutlet((req as any).userId, req.body || {}), res, { successMessage: "Sales-by-outlet report ready" });
  }
  async margin(req: Request, res: Response) {
    await this.handleRequest(async () => {
      if (!(await canSeeCost((req as any).userId))) throw new ForbiddenError("crm.catalogue.cost.* required for margin");
      return this.service.margin((req as any).userId, req.body || {});
    }, res, { successMessage: "Margin report ready" });
  }

  /** Excel export. Honors scope; margin export requires the cost feature. */
  async exportExcel(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const { report = "salesByOutlet", ...filters } = req.body || {};
      if (report === "margin" && !(await canSeeCost(userId))) {
        return res.status(403).json({ success: false, message: "Forbidden: crm.catalogue.cost.* required for margin export" });
      }
      let rows: any[] = [];
      if (report === "pipeline") rows = (await this.service.pipeline(userId, filters)).byStage;
      else if (report === "funnel") rows = (await this.service.funnel(userId, filters)).byStage;
      else if (report === "margin") rows = [await this.service.margin(userId, filters)];
      else rows = (await this.service.salesByOutlet(userId, filters)).byOutlet;

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(report);
      if (rows.length) {
        ws.columns = Object.keys(rows[0]).map((k) => ({ header: k, key: k, width: 20 }));
        rows.forEach((r) => ws.addRow(r));
      }
      const buffer = await wb.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="crm_${report}.xlsx"`);
      return res.send(Buffer.from(buffer));
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || "Export failed" });
    }
  }
}

export default ReportController;
