import { Request, Response } from "express";
import ExcelJS from "exceljs";
import BaseController from "../../../core/controllers/base.controller";
import AuditService from "../services/audit.service";

class AuditController extends BaseController<AuditService> {
  protected service = new AuditService();

  /** Admin Audit Log list (audit.read.*). */
  async get(req: Request, res: Response) {
    await this.handleRequest(() => this.service.list(req.body || {}), res, { successMessage: "Audit log retrieved" });
  }

  /** Per-record history (route maps to profile.*; service enforces record-read). */
  async entity(req: Request, res: Response) {
    const uid = (req as any).userId;
    const { entity, entityId, limit } = req.body || {};
    await this.handleRequest(() => this.service.entityHistory(uid, entity, entityId, limit), res, { successMessage: "History retrieved" });
  }

  /** Resolve actor ids -> display names (for list columns / footers). */
  async actors(req: Request, res: Response) {
    const { ids } = req.body || {};
    await this.handleRequest(() => this.service.resolveActors(Array.isArray(ids) ? ids : []), res, { successMessage: "Actors resolved" });
  }

  /** Excel export of a filtered audit log (audit.read.*). */
  async export(req: Request, res: Response) {
    try {
      const result = await this.service.list({ ...(req.body || {}), page: 1, pageSize: 5000 });
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Audit Log");
      ws.addRow(["Time", "User", "Module", "Entity", "Entity Id", "Action", "Changes", "IP", "Platform"]);
      for (const r of result.data as any[]) {
        ws.addRow([
          r.createdAt ? new Date(r.createdAt).toISOString() : "",
          r.actor?.name || r.userId || "",
          r.module || "", r.entity || "", r.entityId || "", r.action || "",
          r.changes ? JSON.stringify(r.changes) : "", r.ip || "", r.platform || "",
        ]);
      }
      ws.columns.forEach((c) => (c.width = 22));
      const buffer = await wb.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="audit_log.xlsx"`);
      return res.send(Buffer.from(buffer));
    } catch (err: any) {
      return res.status(err?.statusCode || 500).json({ success: false, message: err?.message || "Export failed" });
    }
  }
}

export default AuditController;
