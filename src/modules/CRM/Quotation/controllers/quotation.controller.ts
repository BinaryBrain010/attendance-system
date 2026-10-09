import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import QuotationService from "../services/quotation.service";
import { QuotationPDF } from "../../../../pdf/quotation";
import { canSeeCost, stripCost } from "../../shared/cost";

class QuotationController extends BaseController<QuotationService> {
  protected service = new QuotationService();
  private pdf = new QuotationPDF();

  async get(req: Request, res: Response) {
    const { page, pageSize, ...filters } = req.body || {};
    await this.handleRequest(() => this.service.get((req as any).userId, page, pageSize, filters), res, { successMessage: "Quotations retrieved successfully!" });
  }
  async filtered(req: Request, res: Response) {
    const { page, pageSize, ...filters } = req.body || {};
    await this.handleRequest(() => this.service.get((req as any).userId, page, pageSize, filters), res, { successMessage: "Quotations retrieved successfully!" });
  }
  async total(req: Request, res: Response) {
    await this.handleRequest(() => this.service.total((req as any).userId, req.body || {}), res, { successMessage: "Total quotations retrieved successfully!" });
  }
  async getById(req: Request, res: Response) {
    const uid = (req as any).userId;
    const { id } = req.body;
    await this.handleRequest(async () => {
      const q: any = await this.service.getById(uid, id);
      if (!q) return q;
      const canSee = await canSeeCost(uid);
      if (canSee) {
        const cost = (q.items || []).reduce((s: number, it: any) => s + (it.unitCost || 0) * (it.quantity || 0), 0);
        q.margin = q.total - cost; q.marginPct = q.total ? Math.round((q.margin / q.total) * 100) : 0;
      }
      return stripCost(q, canSee);
    }, res, { successMessage: "Quotation retrieved successfully!" });
  }
  async create(req: Request, res: Response) {
    const uid = (req as any).userId;
    await this.handleRequest(() => this.service.create(uid, { ...req.body, createdBy: uid }), res, {
      successMessage: "Quotation created successfully!", statusCode: 201,
      logActivity: { action: "CREATE", entityType: "Quotation", entityId: (r: any) => r?.id, description: (r: any) => `Quotation ${r?.quotationNo} created` }, req,
    });
  }
  async update(req: Request, res: Response) {
    const uid = (req as any).userId;
    const { id, ...rest } = req.body;
    await this.handleRequest(() => this.service.update(uid, id, rest), res, {
      successMessage: "Quotation updated successfully!",
      logActivity: { action: "UPDATE", entityType: "Quotation", entityId: id, description: "Quotation updated" }, req,
    });
  }
  async newVersion(req: Request, res: Response) {
    const uid = (req as any).userId;
    const { id } = req.body;
    await this.handleRequest(() => this.service.newVersion(uid, id), res, {
      successMessage: "New quotation version created!", statusCode: 201,
      logActivity: { action: "VERSION", entityType: "Quotation", entityId: (r: any) => r?.id, description: (r: any) => `New version v${r?.version} of ${r?.quotationNo}` }, req,
    });
  }
  async transition(req: Request, res: Response) {
    const uid = (req as any).userId;
    const { id, to, reason } = req.body;
    await this.handleRequest(() => this.service.transition(uid, id, to, reason ?? null), res, {
      successMessage: "Quotation status changed!",
      logActivity: { action: "STATUS_CHANGE", entityType: "Quotation", entityId: id, description: (r: any) => `Status ${r?.from} -> ${r?.to}`, metadata: { to, reason: reason ?? null } }, req,
    });
  }
  async remove(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.remove((req as any).userId, id), res, {
      successMessage: "Quotation deleted successfully!",
      logActivity: { action: "DELETE", entityType: "Quotation", entityId: id, description: "Quotation deleted" }, req,
    });
  }
  async restore(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.restore((req as any).userId, id), res, {
      successMessage: "Quotation restored successfully!",
      logActivity: { action: "RESTORE", entityType: "Quotation", entityId: id, description: "Quotation restored" }, req,
    });
  }

  /** Streams a quotation PDF (scope-enforced). */
  async downloadPdf(req: Request, res: Response) {
    try {
      const uid = (req as any).userId;
      const id = (req.body && req.body.id) || req.query.id;
      const q = await this.service.forPdf(uid, String(id));
      const doc = this.pdf.generate(q);
      doc.getBuffer((buffer: Buffer) => {
        res.writeHead(200, { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${q.quotationNo}-v${q.version}.pdf"` });
        res.end(buffer);
      });
    } catch (err: any) {
      const code = err?.statusCode || 500;
      res.status(code).json({ success: false, message: err?.message || "PDF failed" });
    }
  }
}

export default QuotationController;
