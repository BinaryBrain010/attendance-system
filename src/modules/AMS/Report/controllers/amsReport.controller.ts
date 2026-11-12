import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import AmsReportService from "../services/amsReport.service";
import { sendTableExport, EXPORT_CAP, ExportCol } from "../../../../core/export/tableExport";
import { ReportPDF } from "../../../../pdf/report";
import { pdfContentDisposition } from "../../../../core/http/pdfHeaders";
import { buildMonthlyExcel, buildMonthlyPdf, buildSlipPdf, toDisplayRow, monthTitle } from "../exports/amsReportExports";

const uid = (req: Request) => (req as any).userId as string | undefined;
const nowY = () => new Date().getFullYear();

/** Registry of the "simpler" reports: how to fetch rows + the export columns + a title. */
const SIMPLE: Record<string, { fetch: (svc: AmsReportService, userId: string | undefined, b: any) => Promise<any[]>; columns: ExportCol[]; title: string; filename: string; align?: Record<string, string> }> = {
  daily: {
    fetch: (s, u, b) => s.dailySummary(u, b),
    columns: [{ key: "date", header: "Date" }, { key: "present", header: "Present" }, { key: "late", header: "Late" }, { key: "halfDay", header: "Half day" }, { key: "absent", header: "Absent" }, { key: "onLeave", header: "On leave" }, { key: "total", header: "Total" }],
    title: "Daily Attendance Summary", filename: "daily-attendance-summary",
  },
  lateComers: {
    fetch: (s, u, b) => s.lateComers(u, b),
    columns: [{ key: "code", header: "Code" }, { key: "name", header: "Name" }, { key: "department", header: "Department" }, { key: "date", header: "Date" }, { key: "checkIn", header: "Check-in" }, { key: "lateMinutes", header: "Late (min)" }, { key: "status", header: "Status" }],
    title: "Late Comers", filename: "late-comers",
  },
  absentees: {
    fetch: (s, u, b) => s.absentees(u, b),
    columns: [{ key: "code", header: "Code" }, { key: "name", header: "Name" }, { key: "department", header: "Department" }, { key: "designation", header: "Designation" }, { key: "date", header: "Date" }],
    title: "Absentee List", filename: "absentee-list",
  },
  leaveBalance: {
    fetch: (s, u, b) => s.leaveBalance(u, b),
    columns: [{ key: "code", header: "Code" }, { key: "name", header: "Name" }, { key: "department", header: "Department" }, { key: "entitlement", header: "Entitlement" }, { key: "taken", header: "Taken" }, { key: "remaining", header: "Remaining" }, { key: "medical", header: "Medical" }],
    title: "Leave Balance", filename: "leave-balance",
  },
  byUnit: {
    fetch: (s, u, b) => s.attendanceByUnit(u, { year: Number(b.year) || nowY(), month: Number(b.month) || new Date().getMonth() + 1, unitId: b.unitId }),
    columns: [{ key: "unit", header: "Unit" }, { key: "employees", header: "Employees" }, { key: "present", header: "Present" }, { key: "late", header: "Late" }, { key: "halfDay", header: "Half day" }, { key: "absent", header: "Absent" }, { key: "onLeave", header: "On leave" }],
    title: "Attendance by Unit", filename: "attendance-by-unit",
  },
  probation: {
    fetch: (s, u, b) => s.probationDue(u, b.withinDays != null ? Number(b.withinDays) : 30),
    columns: [{ key: "code", header: "Code" }, { key: "name", header: "Name" }, { key: "department", header: "Department" }, { key: "designation", header: "Designation" }, { key: "joiningDate", header: "Joining" }, { key: "probationEnd", header: "Probation ends" }, { key: "dueInDays", header: "Due in (days)" }, { key: "overdue", header: "Overdue" }],
    title: "Probation Due", filename: "probation-due",
  },
};

function normalizeForExport(report: string, rows: any[]): any[] {
  if (report === "leaveBalance") return rows.map((r) => ({ ...r, medical: r.medicalEligible ? "Yes" : "No" }));
  if (report === "probation") return rows.map((r) => ({ ...r, joiningDate: r.joiningDate ? new Date(r.joiningDate).toISOString().slice(0, 10) : "", probationEnd: r.probationEnd ? new Date(r.probationEnd).toISOString().slice(0, 10) : "", overdue: r.overdue ? "Yes" : "No" }));
  return rows;
}

class AmsReportController extends BaseController<AmsReportService> {
  protected service = new AmsReportService();

  // ---- Monthly Employee Report ----------------------------------------------------------------
  async monthly(req: Request, res: Response) {
    const b = req.body || {};
    const f = { year: Number(b.year) || nowY(), month: Number(b.month) || new Date().getMonth() + 1, unitId: b.unitId, department: b.department, company: b.company, status: b.status };
    await this.handleRequest(() => this.service.monthlyPaged(uid(req), f, Number(b.page) || 1, Number(b.pageSize) || 25), res, { successMessage: "Monthly report retrieved!" });
  }

  async monthlyExcel(req: Request, res: Response) {
    const b = req.body || {};
    const f = { year: Number(b.year) || nowY(), month: Number(b.month) || new Date().getMonth() + 1, unitId: b.unitId, department: b.department, company: b.company, status: b.status };
    const { rows, totals } = await this.service.monthlyRows(uid(req), f);
    const buf = await buildMonthlyExcel(rows, totals, f);
    res.setHeader("Content-Disposition", `attachment; filename="monthly-report-${f.year}-${String(f.month).padStart(2, "0")}.xlsx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buf);
  }

  async monthlyPdf(req: Request, res: Response) {
    const b = req.body || {};
    const f = { year: Number(b.year) || nowY(), month: Number(b.month) || new Date().getMonth() + 1, unitId: b.unitId, department: b.department, company: b.company, status: b.status };
    const { rows, totals } = await this.service.monthlyRows(uid(req), f);
    const doc = buildMonthlyPdf(rows, totals, f);
    doc.getBuffer((buffer: Buffer) => {
      res.writeHead(200, { "Content-Type": "application/pdf", "Content-Disposition": pdfContentDisposition(req, `monthly-report-${f.year}-${String(f.month).padStart(2, "0")}.pdf`), "Content-Length": buffer.length });
      res.end(buffer);
    });
  }

  async monthlySlip(req: Request, res: Response) {
    const b = req.body || {};
    const year = Number(b.year) || nowY(); const month = Number(b.month) || new Date().getMonth() + 1;
    const row = await this.service.monthlySlip(uid(req), b.employeeId, year, month);
    if (!row) { res.status(404).json({ success: false, message: "Employee not found in your scope." }); return; }
    const doc = buildSlipPdf(row, { year, month });
    doc.getBuffer((buffer: Buffer) => {
      res.writeHead(200, { "Content-Type": "application/pdf", "Content-Disposition": pdfContentDisposition(req, `slip-${row.code}-${year}-${String(month).padStart(2, "0")}.pdf`), "Content-Length": buffer.length });
      res.end(buffer);
    });
  }

  async saveRemark(req: Request, res: Response) {
    const { employeeId, year, month, remark } = req.body || {};
    await this.handleRequest(() => this.service.saveRemark(uid(req), employeeId, Number(year) || nowY(), Number(month) || new Date().getMonth() + 1, remark || ""), res, { successMessage: "Remark saved!" });
  }

  // ---- Simple reports (JSON) ------------------------------------------------------------------
  async simple(req: Request, res: Response) {
    const report = String(req.params.report || req.body?.report || "");
    const def = SIMPLE[report];
    if (!def) { res.status(400).json({ success: false, message: "Unknown report." }); return; }
    await this.handleRequest(() => def.fetch(this.service, uid(req), req.body || {}), res, { successMessage: `${def.title} retrieved!` });
  }

  // ---- Simple reports export (CSV / Excel via sendTableExport) ---------------------------------
  async export(req: Request, res: Response) {
    const report = String(req.body?.report || "");
    const def = SIMPLE[report];
    if (!def) { res.status(400).json({ success: false, message: "Unknown report." }); return; }
    const rows = normalizeForExport(report, await def.fetch(this.service, uid(req), req.body || {}));
    const capped = rows.length > EXPORT_CAP;
    await sendTableExport(res, { rows: capped ? rows.slice(0, EXPORT_CAP) : rows, columns: def.columns, format: req.body?.format === "csv" ? "csv" : "excel", filename: def.filename, capped });
  }

  // ---- Simple reports export (generic landscape PDF) ------------------------------------------
  async pdf(req: Request, res: Response) {
    const report = String(req.body?.report || "");
    const def = SIMPLE[report];
    if (!def) { res.status(400).json({ success: false, message: "Unknown report." }); return; }
    const rows = normalizeForExport(report, await def.fetch(this.service, uid(req), req.body || {}));
    const cols = def.columns.map((c) => ({ header: c.header, key: c.key }));
    const sub = req.body?.from && req.body?.to ? `${req.body.from} — ${req.body.to}` : (req.body?.year ? monthTitle(Number(req.body.year), Number(req.body.month) || 1) : "");
    const doc = new ReportPDF().generate(def.title, cols, rows, sub);
    doc.getBuffer((buffer: Buffer) => {
      res.writeHead(200, { "Content-Type": "application/pdf", "Content-Disposition": pdfContentDisposition(req, `${def.filename}.pdf`), "Content-Length": buffer.length });
      res.end(buffer);
    });
  }
}

export default AmsReportController;
