import { Request, Response } from "express";
import ExcelJS from "exceljs";
import BaseController from "../../../../core/controllers/base.controller";
import ReportService from "../services/report.service";
import { ReportPDF } from "../../../../pdf/report";
import { canSeeCost } from "../../shared/cost";
import { ForbiddenError } from "../../../../core/errors/app.error";

const pdf = new ReportPDF();

class ReportController extends BaseController<ReportService> {
  protected service = new ReportService();

  private run(req: Request, res: Response, op: () => Promise<any>, msg: string) {
    return this.handleRequest(op, res, { successMessage: msg });
  }

  async dashboard(req: Request, res: Response) { await this.run(req, res, () => this.service.dashboard((req as any).userId, req.body || {}), "Dashboard ready"); }
  async agentPerformance(req: Request, res: Response) { await this.run(req, res, () => this.service.agentPerformance((req as any).userId, req.body || {}), "Agent performance ready"); }
  async funnel(req: Request, res: Response) { await this.run(req, res, () => this.service.funnel((req as any).userId, req.body || {}), "Funnel ready"); }
  async pipeline(req: Request, res: Response) { await this.run(req, res, () => this.service.pipeline((req as any).userId, req.body || {}), "Pipeline ready"); }
  async sales(req: Request, res: Response) { const { dimension = "product", ...f } = req.body || {}; await this.run(req, res, () => this.service.salesBy((req as any).userId, dimension, f), "Sales report ready"); }
  async lostReasons(req: Request, res: Response) { await this.run(req, res, () => this.service.lostReasons((req as any).userId, req.body || {}), "Lost reasons ready"); }
  async returns(req: Request, res: Response) { await this.run(req, res, () => this.service.returnsReport((req as any).userId, req.body || {}), "Returns report ready"); }
  async leadAging(req: Request, res: Response) { await this.run(req, res, () => this.service.leadAging((req as any).userId, req.body || {}), "Lead aging ready"); }
  async repeatCustomers(req: Request, res: Response) { await this.run(req, res, () => this.service.repeatCustomers((req as any).userId, req.body || {}), "Repeat customers ready"); }
  async dailySummary(req: Request, res: Response) { await this.run(req, res, () => this.service.dailySummary((req as any).userId, req.body || {}), "Daily summary ready"); }
  async margin(req: Request, res: Response) {
    await this.handleRequest(async () => {
      if (!(await canSeeCost((req as any).userId))) throw new ForbiddenError("crm.catalogue.cost.* required for margin");
      return this.service.margin((req as any).userId, req.body || {});
    }, res, { successMessage: "Margin ready" });
  }

  /** Excel/PDF export of any report. */
  async export(req: Request, res: Response) {
    try {
      const uid = (req as any).userId;
      const { report = "dashboard", format = "excel", ...f } = req.body || {};
      if (report === "margin" && !(await canSeeCost(uid))) return res.status(403).json({ success: false, message: "Forbidden: crm.catalogue.cost.* required for margin" });
      const data = await this.runReport(uid, report, f);
      const { title, columns, rows, subtitle } = tabulate(report, data, f);
      if (format === "pdf") {
        const doc = pdf.generate(title, columns, rows, subtitle);
        return doc.getBuffer((buf: Buffer) => {
          res.writeHead(200, { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="crm_${report}.pdf"` });
          res.end(buf);
        });
      }
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(report.slice(0, 28));
      if (subtitle) { ws.addRow([title]); ws.addRow([subtitle]); ws.addRow([]); }
      ws.addRow(columns.map((c) => c.header));
      rows.forEach((r) => ws.addRow(columns.map((c) => r[c.key])));
      ws.columns.forEach((c) => (c.width = 20));
      const buffer = await wb.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="crm_${report}.xlsx"`);
      return res.send(Buffer.from(buffer));
    } catch (err: any) {
      return res.status(err?.statusCode || 500).json({ success: false, message: err?.message || "Export failed" });
    }
  }

  private runReport(uid: string, report: string, f: any): Promise<any> {
    switch (report) {
      case "dashboard": return this.service.dashboard(uid, f);
      case "agentPerformance": return this.service.agentPerformance(uid, f);
      case "funnel": return this.service.funnel(uid, f);
      case "pipeline": return this.service.pipeline(uid, f);
      case "sales": return this.service.salesBy(uid, f.dimension || "product", f);
      case "lostReasons": return this.service.lostReasons(uid, f);
      case "returns": return this.service.returnsReport(uid, f);
      case "leadAging": return this.service.leadAging(uid, f);
      case "repeatCustomers": return this.service.repeatCustomers(uid, f);
      case "dailySummary": return this.service.dailySummary(uid, f);
      case "margin": return this.service.margin(uid, f);
      default: return this.service.dashboard(uid, f);
    }
  }
}

const C = (header: string, key: string, align?: string) => ({ header, key, align });
function kv(obj: Record<string, any>): any[] { return Object.entries(obj).map(([k, v]) => ({ metric: k, value: v })); }

function tabulate(report: string, d: any, f: any): { title: string; columns: any[]; rows: any[]; subtitle?: string } {
  switch (report) {
    case "agentPerformance": return { title: "Agent Performance", columns: [C("Agent", "agent"), C("Name", "name"), C("Leads", "leads", "right"), C("Won", "won", "right"), C("Won Value", "wonValue", "right"), C("Conv %", "conversionPct", "right"), C("Avg days", "avgDaysToClose", "right"), C("Overdue", "overdueFollowUps", "right"), C("Target", "target", "right"), C("Achieved %", "achievedPct", "right")], rows: d.agents };
    case "funnel": return { title: "Lead Funnel", columns: [C("Stage", "stage"), C("Count", "count", "right"), C("Drop from prev %", "dropFromPrevPct", "right")], rows: d.stages, subtitle: `Total ${d.total} · Lost ${d.lost} · On hold ${d.onHold}` };
    case "pipeline": return { title: "Pipeline by Agent", columns: [C("Agent", "agent"), C("Name", "name"), C("Open leads", "count", "right"), C("Value", "value", "right"), C("Weighted", "weighted", "right")], rows: d.byAgent, subtitle: `Open value ${d.totalValue.toLocaleString()} · Weighted ${d.weightedValue.toLocaleString()}` };
    case "sales": return { title: `Sales by ${d.dimension}`, columns: [C(d.dimension, "key"), C("Orders", "orders", "right"), C("Revenue", "revenue", "right")], rows: d.rows };
    case "lostReasons": return { title: "Lost Reasons", columns: [C("Reason", "reason"), C("Count", "count", "right"), C("Value", "value", "right")], rows: d.reasons, subtitle: `Total lost ${d.total}` };
    case "returns": return { title: "Returns by Reason", columns: [C("Reason", "key"), C("Count", "count", "right")], rows: d.byReason, subtitle: `Returns ${d.totalReturns} · Rate ${d.ratePct}% · RTO value ${d.rtoValue.toLocaleString()}${d.rtoPendingOrders ? ` (+${d.rtoPendingOrders} pending price)` : ""}` };
    case "leadAging": return { title: "Overdue Follow-ups by Agent", columns: [C("Agent", "agent"), C("Name", "name"), C("Overdue", "overdue", "right")], rows: d.overdueByAgent, subtitle: `Open ${d.open} · ` + d.ageBuckets.map((b: any) => `${b.bucket}:${b.count}`).join("  ") };
    case "repeatCustomers": return { title: "Repeat Customers", columns: [C("Name", "name"), C("Phone", "phone"), C("Won", "won", "right"), C("Orders", "orders", "right"), C("Value", "value", "right")], rows: d.customers, subtitle: `Repeat customers ${d.repeatCount}` };
    case "dailySummary": return { title: "Daily Sales Summary", columns: [C("Date", "date"), C("Leads", "leads", "right"), C("Won", "won", "right"), C("Delivered", "delivered", "right"), C("Revenue", "revenue", "right"), C("Returns", "returns", "right")], rows: d.days };
    case "margin": return { title: "Margin (delivered orders)", columns: [C("Metric", "metric"), C("Value", "value", "right")], rows: kv({ Orders: d.orders, Revenue: d.revenue, Cost: d.cost, Margin: d.margin, "Margin %": d.marginPct, "Pending lines": d.pendingLines }) };
    default: return { title: "Dashboard", columns: [C("Metric", "metric"), C("Value", "value", "right")], rows: kv({ "Leads today": d.leads?.today, "Leads this week": d.leads?.thisWeek, "Leads this month": d.leads?.thisMonth, "Total leads": d.leads?.total, Won: d.won, "Won value": d.wonValue, "Conversion %": d.conversionPct, "Pipeline value": d.pipelineValue, "Overdue follow-ups": d.overdueFollowUps, "Delivered orders": d.deliveredOrders, Returns: d.returns, "Returns rate %": d.returnsRatePct }) };
  }
}

export default ReportController;
