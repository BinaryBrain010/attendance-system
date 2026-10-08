import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import LeadService from "../services/lead.service";

class LeadController extends BaseController<LeadService> {
  protected service = new LeadService();

  async get(req: Request, res: Response) {
    const { page, pageSize, ...filters } = req.body || {};
    await this.handleRequest(() => this.service.get((req as any).userId, page, pageSize, filters), res, { successMessage: "Leads retrieved successfully!" });
  }
  async filtered(req: Request, res: Response) {
    const { page, pageSize, ...filters } = req.body || {};
    await this.handleRequest(() => this.service.get((req as any).userId, page, pageSize, filters), res, { successMessage: "Leads retrieved successfully!" });
  }
  async total(req: Request, res: Response) {
    await this.handleRequest(() => this.service.total((req as any).userId, req.body || {}), res, { successMessage: "Total leads retrieved successfully!" });
  }
  async getById(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.getById((req as any).userId, id), res, { successMessage: "Lead retrieved successfully!" });
  }
  async create(req: Request, res: Response) {
    const data = { ...req.body, createdBy: (req as any).userId };
    await this.handleRequest(() => this.service.create(data), res, {
      successMessage: "Lead created successfully!", statusCode: 201,
      logActivity: { action: "CREATE", entityType: "Lead", entityId: (r: any) => r?.[0]?.id, description: `Lead created: ${req.body?.customerName ?? ""}` }, req,
    });
  }
  async update(req: Request, res: Response) {
    const { id, ...rest } = req.body;
    await this.handleRequest(() => this.service.update(id, { ...rest, updatedBy: (req as any).userId }), res, {
      successMessage: "Lead updated successfully!",
      logActivity: { action: "UPDATE", entityType: "Lead", entityId: id, description: "Lead updated" }, req,
    });
  }
  async remove(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.remove(id), res, {
      successMessage: "Lead deleted successfully!",
      logActivity: { action: "DELETE", entityType: "Lead", entityId: id, description: "Lead deleted" }, req,
    });
  }
  async restore(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.restore(id), res, {
      successMessage: "Lead restored successfully!",
      logActivity: { action: "RESTORE", entityType: "Lead", entityId: id, description: "Lead restored" }, req,
    });
  }
}

export default LeadController;
