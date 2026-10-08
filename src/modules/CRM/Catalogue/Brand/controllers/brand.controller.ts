import { Request, Response } from "express";
import BaseController from "../../../../../core/controllers/base.controller";
import BrandService from "../services/brand.service";

class BrandController extends BaseController<BrandService> {
  protected service = new BrandService();

  async getAll(_req: Request, res: Response) {
    await this.handleRequest(() => this.service.getAll(), res, { successMessage: "Brands retrieved successfully!" });
  }
  async get(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    await this.handleRequest(() => this.service.get(page, pageSize), res, { successMessage: "Brands retrieved successfully!" });
  }
  async getDeleted(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    await this.handleRequest(() => this.service.getDeleted(page, pageSize), res, { successMessage: "Deleted brands retrieved successfully!" });
  }
  async getById(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.getById(id), res, { successMessage: "Brand retrieved successfully!" });
  }
  async total(_req: Request, res: Response) {
    await this.handleRequest(() => this.service.total(), res, { successMessage: "Total brands retrieved successfully!" });
  }
  async create(req: Request, res: Response) {
    const data = { ...req.body, createdBy: (req as any).userId };
    await this.handleRequest(() => this.service.create(data), res, {
      successMessage: "Brand created successfully!",
      statusCode: 201,
      logActivity: { action: "CREATE", entityType: "Brand", entityId: (r: any) => r?.[0]?.id, description: `Brand created: ${req.body?.name ?? ""}` },
      req,
    });
  }
  async update(req: Request, res: Response) {
    const { id, ...rest } = req.body;
    await this.handleRequest(() => this.service.update(id, { ...rest, updatedBy: (req as any).userId }), res, {
      successMessage: "Brand updated successfully!",
      logActivity: { action: "UPDATE", entityType: "Brand", entityId: id, description: "Brand updated" },
      req,
    });
  }
  async remove(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.remove(id), res, {
      successMessage: "Brand deleted successfully!",
      logActivity: { action: "DELETE", entityType: "Brand", entityId: id, description: "Brand deleted" },
      req,
    });
  }
  async restore(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.restore(id), res, {
      successMessage: "Brand restored successfully!",
      logActivity: { action: "RESTORE", entityType: "Brand", entityId: id, description: "Brand restored" },
      req,
    });
  }
  async search(req: Request, res: Response) {
    const { searchTerm, page, pageSize } = req.body;
    await this.handleRequest(() => this.service.search(searchTerm, page, pageSize), res, { successMessage: "Brands retrieved successfully!" });
  }
}

export default BrandController;
