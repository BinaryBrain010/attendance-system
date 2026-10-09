import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import SalesOrderService from "../services/salesOrder.service";
import { canSeeCost, stripCost } from "../../shared/cost";

class SalesOrderController extends BaseController<SalesOrderService> {
  protected service = new SalesOrderService();

  async get(req: Request, res: Response) {
    const { page, pageSize, ...filters } = req.body || {};
    await this.handleRequest(() => this.service.get((req as any).userId, page, pageSize, filters), res, { successMessage: "Orders retrieved successfully!" });
  }
  async filtered(req: Request, res: Response) {
    const { page, pageSize, ...filters } = req.body || {};
    await this.handleRequest(() => this.service.get((req as any).userId, page, pageSize, filters), res, { successMessage: "Orders retrieved successfully!" });
  }
  async total(req: Request, res: Response) {
    await this.handleRequest(() => this.service.total((req as any).userId, req.body || {}), res, { successMessage: "Total orders retrieved successfully!" });
  }
  async getById(req: Request, res: Response) {
    const uid = (req as any).userId;
    const { id } = req.body;
    await this.handleRequest(async () => {
      const o: any = await this.service.getById(uid, id);
      if (!o) return o;
      const canSee = await canSeeCost(uid);
      if (canSee) {
        const cost = (o.items || []).reduce((s: number, it: any) => s + (it.unitCost || 0) * (it.quantity || 0), 0);
        o.margin = o.total - cost; o.marginPct = o.total ? Math.round((o.margin / o.total) * 100) : 0;
      }
      return stripCost(o, canSee);
    }, res, { successMessage: "Order retrieved successfully!" });
  }
  async create(req: Request, res: Response) {
    const uid = (req as any).userId;
    await this.handleRequest(() => this.service.create(uid, { ...req.body, createdBy: uid }), res, {
      successMessage: "Order created successfully!", statusCode: 201,
      logActivity: { action: "CREATE", entityType: "SalesOrder", entityId: (r: any) => r?.id, description: (r: any) => `Order ${r?.orderNo} created` }, req,
    });
  }
  async fromLead(req: Request, res: Response) {
    const uid = (req as any).userId;
    const { leadId } = req.body;
    await this.handleRequest(() => this.service.fromLead(uid, leadId), res, {
      successMessage: "Order created from lead!", statusCode: 201,
      logActivity: { action: "CREATE", entityType: "SalesOrder", entityId: (r: any) => r?.id, description: (r: any) => `Order ${r?.orderNo} from lead ${leadId}` }, req,
    });
  }
  async fromQuotation(req: Request, res: Response) {
    const uid = (req as any).userId;
    const { quotationId } = req.body;
    await this.handleRequest(() => this.service.fromQuotation(uid, quotationId), res, {
      successMessage: "Order created from quotation!", statusCode: 201,
      logActivity: { action: "CREATE", entityType: "SalesOrder", entityId: (r: any) => r?.id, description: (r: any) => `Order ${r?.orderNo} from quotation ${quotationId}` }, req,
    });
  }
  async update(req: Request, res: Response) {
    const uid = (req as any).userId;
    const { id, ...rest } = req.body;
    await this.handleRequest(() => this.service.update(uid, id, rest), res, {
      successMessage: "Order updated successfully!",
      logActivity: { action: "UPDATE", entityType: "SalesOrder", entityId: id, description: "Order updated" }, req,
    });
  }
  async transition(req: Request, res: Response) {
    const uid = (req as any).userId;
    const { id, to, reason } = req.body;
    await this.handleRequest(() => this.service.transition(uid, id, to, reason ?? null), res, {
      successMessage: "Order status changed!",
      logActivity: { action: "STATUS_CHANGE", entityType: "SalesOrder", entityId: id, description: (r: any) => `Status ${r?.from} -> ${r?.to}`, metadata: { to, reason: reason ?? null } }, req,
    });
  }
  async reattempt(req: Request, res: Response) {
    const uid = (req as any).userId;
    const { id } = req.body;
    await this.handleRequest(() => this.service.reattempt(uid, id), res, {
      successMessage: "Delivery re-attempt recorded!",
      logActivity: { action: "REATTEMPT", entityType: "SalesOrder", entityId: id, description: "Delivery re-attempt" }, req,
    });
  }
  async remove(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.remove((req as any).userId, id), res, {
      successMessage: "Order deleted successfully!",
      logActivity: { action: "DELETE", entityType: "SalesOrder", entityId: id, description: "Order deleted" }, req,
    });
  }
  async restore(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.restore((req as any).userId, id), res, {
      successMessage: "Order restored successfully!",
      logActivity: { action: "RESTORE", entityType: "SalesOrder", entityId: id, description: "Order restored" }, req,
    });
  }
}

export default SalesOrderController;
