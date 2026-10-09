import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import SalesReturnService from "../services/salesReturn.service";

class SalesReturnController extends BaseController<SalesReturnService> {
  protected service = new SalesReturnService();

  async get(req: Request, res: Response) {
    const { page, pageSize, ...filters } = req.body || {};
    await this.handleRequest(() => this.service.get((req as any).userId, page, pageSize, filters), res, { successMessage: "Returns retrieved successfully!" });
  }
  async filtered(req: Request, res: Response) {
    const { page, pageSize, ...filters } = req.body || {};
    await this.handleRequest(() => this.service.get((req as any).userId, page, pageSize, filters), res, { successMessage: "Returns retrieved successfully!" });
  }
  async total(req: Request, res: Response) {
    await this.handleRequest(() => this.service.total((req as any).userId, req.body || {}), res, { successMessage: "Total returns retrieved successfully!" });
  }
  async getById(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.getById((req as any).userId, id), res, { successMessage: "Return retrieved successfully!" });
  }
  async create(req: Request, res: Response) {
    const uid = (req as any).userId;
    await this.handleRequest(() => this.service.create(uid, { ...req.body, createdBy: uid }), res, {
      successMessage: "Return reported successfully!", statusCode: 201,
      logActivity: { action: "CREATE", entityType: "SalesReturn", entityId: (r: any) => r?.id, description: (r: any) => `Return ${r?.returnNo} reported` }, req,
    });
  }
  async fromOrder(req: Request, res: Response) {
    const uid = (req as any).userId;
    const { orderId, reason } = req.body;
    await this.handleRequest(() => this.service.fromOrder(uid, orderId, reason), res, {
      successMessage: "Return created from order!", statusCode: 201,
      logActivity: { action: "CREATE", entityType: "SalesReturn", entityId: (r: any) => r?.id, description: (r: any) => `Return ${r?.returnNo} from order ${orderId}` }, req,
    });
  }
  async update(req: Request, res: Response) {
    const { id, ...rest } = req.body;
    await this.handleRequest(() => this.service.update((req as any).userId, id, rest), res, {
      successMessage: "Return updated successfully!",
      logActivity: { action: "UPDATE", entityType: "SalesReturn", entityId: id, description: "Return updated" }, req,
    });
  }
  async transition(req: Request, res: Response) {
    const uid = (req as any).userId;
    const { id, to, reason } = req.body;
    await this.handleRequest(() => this.service.transition(uid, id, to, reason ?? null), res, {
      successMessage: "Return status changed!",
      logActivity: { action: "STATUS_CHANGE", entityType: "SalesReturn", entityId: id, description: (r: any) => `Status ${r?.from} -> ${r?.to}`, metadata: { to, reason: reason ?? null } }, req,
    });
  }
  async remove(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.remove((req as any).userId, id), res, {
      successMessage: "Return deleted successfully!",
      logActivity: { action: "DELETE", entityType: "SalesReturn", entityId: id, description: "Return deleted" }, req,
    });
  }
}

export default SalesReturnController;
