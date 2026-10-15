import { Request, Response } from "express";
import ExcelJS from "exceljs";
import BaseController from "../../../../core/controllers/base.controller";
import WorkReportService from "../services/workReport.service";
import { ReportPDF } from "../../../../pdf/report";

const pdf = new ReportPDF();
const uid = (req: Request) => (req as any).userId as string;

/** Flatten a report result into { title, columns, rows } for Excel/PDF export. */
function tabulate(report: string, data: any): { title: string; columns: { key: string; header: string }[]; rows: any[] } {
  switch (report) {
    case "completion":
      return { title: "Task completion", columns: [{ key: "team", header: "Team" }, { key: "total", header: "Total" }, { key: "done", header: "Done" }, { key: "completionPct", header: "Completion %" }], rows: data.byTeam };
    case "overdue":
      return { title: "Overdue by person", columns: [{ key: "person", header: "Person" }, { key: "count", header: "Overdue" }], rows: data.byPerson };
    case "timeToComplete":
      return { title: "Time to complete", columns: [{ key: "team", header: "Team" }, { key: "completed", header: "Completed" }, { key: "avgDays", header: "Avg days" }], rows: data.byTeam };
    case "workload":
      return { title: "Workload per person", columns: [{ key: "person", header: "Person" }, { key: "open", header: "Open" }, { key: "overdue", header: "Overdue" }], rows: data.byPerson };
    case "compliance":
      return { title: "Daily report compliance", columns: [{ key: "date", header: "Date" }, { key: "expected", header: "Expected" }, { key: "submitted", header: "Submitted" }, { key: "missing", header: "Missing" }, { key: "compliancePct", header: "Compliance %" }], rows: data.rows };
    case "hours":
      return { title: "Hours logged per person", columns: [{ key: "person", header: "Person" }, { key: "hours", header: "Hours" }], rows: data.byPerson };
    default:
      return { title: report, columns: [], rows: [] };
  }
}

class WorkReportController extends BaseController<WorkReportService> {
  protected service = new WorkReportService();

  private run(uid: string, report: string, f: any): Promise<any> {
    switch (report) {
      case "completion": return this.service.completion(uid, f);
      case "overdue": return this.service.overdue(uid, f);
      case "timeToComplete": return this.service.timeToComplete(uid, f);
      case "workload": return this.service.workload(uid, f);
      case "compliance": return this.service.compliance(uid, f);
      case "hours": return this.service.hours(uid, f);
      default: return Promise.resolve({});
    }
  }

  completion(req: Request, res: Response) { return this.handleRequest(() => this.service.completion(uid(req), req.body), res, { successMessage: "Completion report ready" }); }
  overdue(req: Request, res: Response) { return this.handleRequest(() => this.service.overdue(uid(req), req.body), res, { successMessage: "Overdue report ready" }); }
  timeToComplete(req: Request, res: Response) { return this.handleRequest(() => this.service.timeToComplete(uid(req), req.body), res, { successMessage: "Time-to-complete report ready" }); }
  workload(req: Request, res: Response) { return this.handleRequest(() => this.service.workload(uid(req), req.body), res, { successMessage: "Workload report ready" }); }
  compliance(req: Request, res: Response) { return this.handleRequest(() => this.service.compliance(uid(req), req.body), res, { successMessage: "Compliance report ready" }); }
  hours(req: Request, res: Response) { return this.handleRequest(() => this.service.hours(uid(req), req.body), res, { successMessage: "Hours report ready" }); }

  async export(req: Request, res: Response) {
    try {
      const { report = "completion", format = "excel", ...f } = req.body || {};
      const data = await this.run(uid(req), report, f);
      const { title, columns, rows } = tabulate(report, data);
      if (format === "pdf") {
        const doc = pdf.generate(title, columns, rows);
        return doc.getBuffer((buf: Buffer) => {
          res.writeHead(200, { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="work_${report}.pdf"` });
          res.end(buf);
        });
      }
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(report.slice(0, 28));
      ws.addRow(columns.map((c) => c.header));
      rows.forEach((r) => ws.addRow(columns.map((c) => r[c.key])));
      ws.columns.forEach((c) => (c.width = 20));
      const buffer = await wb.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="work_${report}.xlsx"`);
      return res.send(Buffer.from(buffer));
    } catch (err: any) {
      return res.status(err?.statusCode || 500).json({ success: false, message: err?.message || "Export failed" });
    }
  }
}

export default WorkReportController;
