import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import QuotationService from "../services/quotation.service";

class QuotationController extends BaseController<QuotationService> {
  protected service = new QuotationService();

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
    const { id } = req.body;
    await this.handleRequest(() => this.service.getById((req as any).userId, id), res, { successMessage: "Quotation retrieved successfully!" });
  }
  async create(req: Request, res: Response) {
    const uid = (req as any).userId;
    const data = { ...req.body, createdBy: uid };
    await this.handleRequest(() => this.service.create(uid, data), res, {
      successMessage: "Quotation created successfully!", statusCode: 201,
      logActivity: { action: "CREATE", entityType: "Quotation", entityId: (r: any) => r?.[0]?.id, description: `Quotation created: ${req.body?.quotationNo ?? ""}` }, req,
    });
  }
  async update(req: Request, res: Response) {
    const uid = (req as any).userId;
    const { id, ...rest } = req.body;
    await this.handleRequest(() => this.service.update(uid, id, { ...rest, updatedBy: uid }), res, {
      successMessage: "Quotation updated successfully!",
      logActivity: { action: "UPDATE", entityType: "Quotation", entityId: id, description: "Quotation updated" }, req,
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
}

export default QuotationController;
