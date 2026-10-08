import { Request, Response } from "express";
import BaseController from "../../../../../core/controllers/base.controller";
import BundleService from "../services/bundle.service";

class BundleController extends BaseController<BundleService> {
  protected service = new BundleService();

  async getAll(_req: Request, res: Response) {
    await this.handleRequest(() => this.service.getAll(), res, { successMessage: "Bundles retrieved successfully!" });
  }
  async get(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    await this.handleRequest(() => this.service.get(page, pageSize), res, { successMessage: "Bundles retrieved successfully!" });
  }
  async getDeleted(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    await this.handleRequest(() => this.service.getDeleted(page, pageSize), res, { successMessage: "Deleted bundles retrieved successfully!" });
  }
  async getById(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.getById(id), res, { successMessage: "Bundle retrieved successfully!" });
  }
  async total(_req: Request, res: Response) {
    await this.handleRequest(() => this.service.total(), res, { successMessage: "Total bundles retrieved successfully!" });
  }
  async create(req: Request, res: Response) {
    const data = { ...req.body, createdBy: (req as any).userId };
    await this.handleRequest(() => this.service.create(data), res, {
      successMessage: "Bundle created successfully!",
      statusCode: 201,
      logActivity: { action: "CREATE", entityType: "Bundle", entityId: (r: any) => r?.id, description: `Bundle created: ${req.body?.name ?? ""}` },
      req,
    });
  }
  async update(req: Request, res: Response) {
    const { id, ...rest } = req.body;
    await this.handleRequest(() => this.service.update(id, { ...rest, updatedBy: (req as any).userId }), res, {
      successMessage: "Bundle updated successfully!",
      logActivity: { action: "UPDATE", entityType: "Bundle", entityId: id, description: "Bundle updated" },
      req,
    });
  }
  async addItem(req: Request, res: Response) {
    const { bundleId, ...item } = req.body;
    await this.handleRequest(() => this.service.addItem(bundleId, item), res, {
      successMessage: "Bundle item added successfully!",
      statusCode: 201,
      logActivity: { action: "UPDATE", entityType: "Bundle", entityId: bundleId, description: "Bundle item added" },
      req,
    });
  }
  async remove(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.remove(id), res, {
      successMessage: "Bundle deleted successfully!",
      logActivity: { action: "DELETE", entityType: "Bundle", entityId: id, description: "Bundle deleted" },
      req,
    });
  }
  async restore(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.restore(id), res, {
      successMessage: "Bundle restored successfully!",
      logActivity: { action: "RESTORE", entityType: "Bundle", entityId: id, description: "Bundle restored" },
      req,
    });
  }
  async search(req: Request, res: Response) {
    const { searchTerm, page, pageSize } = req.body;
    await this.handleRequest(() => this.service.search(searchTerm, page, pageSize), res, { successMessage: "Bundles retrieved successfully!" });
  }
}

export default BundleController;
