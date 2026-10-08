import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import SalesOrderService from "../services/salesOrder.service";

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
    const { id } = req.body;
    await this.handleRequest(() => this.service.getById((req as any).userId, id), res, { successMessage: "Order retrieved successfully!" });
  }
  async create(req: Request, res: Response) {
    const data = { ...req.body, createdBy: (req as any).userId };
    await this.handleRequest(() => this.service.create(data), res, {
      successMessage: "Order created successfully!", statusCode: 201,
      logActivity: { action: "CREATE", entityType: "SalesOrder", entityId: (r: any) => r?.[0]?.id, description: `Order created: ${req.body?.orderNo ?? ""}` }, req,
    });
  }
  async update(req: Request, res: Response) {
    const { id, ...rest } = req.body;
    await this.handleRequest(() => this.service.update(id, { ...rest, updatedBy: (req as any).userId }), res, {
      successMessage: "Order updated successfully!",
      logActivity: { action: "UPDATE", entityType: "SalesOrder", entityId: id, description: "Order updated" }, req,
    });
  }
  async remove(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.remove(id), res, {
      successMessage: "Order deleted successfully!",
      logActivity: { action: "DELETE", entityType: "SalesOrder", entityId: id, description: "Order deleted" }, req,
    });
  }
  async restore(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.restore(id), res, {
      successMessage: "Order restored successfully!",
      logActivity: { action: "RESTORE", entityType: "SalesOrder", entityId: id, description: "Order restored" }, req,
    });
  }
}

export default SalesOrderController;
