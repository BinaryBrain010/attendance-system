import { Request, Response } from "express";
import BaseController from "../../../../../core/controllers/base.controller";
import CategoryService from "../services/category.service";

class CategoryController extends BaseController<CategoryService> {
  protected service = new CategoryService();

  async getAll(_req: Request, res: Response) {
    await this.handleRequest(() => this.service.getAll(), res, { successMessage: "Categories retrieved successfully!" });
  }
  async get(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    await this.handleRequest(() => this.service.get(page, pageSize), res, { successMessage: "Categories retrieved successfully!" });
  }
  async getDeleted(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    await this.handleRequest(() => this.service.getDeleted(page, pageSize), res, { successMessage: "Deleted categories retrieved successfully!" });
  }
  async getById(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.getById(id), res, { successMessage: "Category retrieved successfully!" });
  }
  async total(_req: Request, res: Response) {
    await this.handleRequest(() => this.service.total(), res, { successMessage: "Total categories retrieved successfully!" });
  }
  async create(req: Request, res: Response) {
    const uid = (req as any).userId;
    const data = { ...req.body, createdBy: uid };
    await this.handleRequest(() => this.service.create(data), res, {
      successMessage: "Category created successfully!",
      statusCode: 201,
      logActivity: { action: "CREATE", entityType: "Category", entityId: (r: any) => r?.[0]?.id, description: `Category created: ${req.body?.name ?? ""}` },
      req,
    });
  }
  async update(req: Request, res: Response) {
    const uid = (req as any).userId;
    const { id, ...rest } = req.body;
    await this.handleRequest(() => this.service.update(id, { ...rest, updatedBy: uid }), res, {
      successMessage: "Category updated successfully!",
      logActivity: { action: "UPDATE", entityType: "Category", entityId: id, description: "Category updated" },
      req,
    });
  }
  async remove(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.remove(id), res, {
      successMessage: "Category deleted successfully!",
      logActivity: { action: "DELETE", entityType: "Category", entityId: id, description: "Category deleted" },
      req,
    });
  }
  async restore(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.restore(id), res, {
      successMessage: "Category restored successfully!",
      logActivity: { action: "RESTORE", entityType: "Category", entityId: id, description: "Category restored" },
      req,
    });
  }
  async search(req: Request, res: Response) {
    const { searchTerm, page, pageSize } = req.body;
    await this.handleRequest(() => this.service.search(searchTerm, page, pageSize), res, { successMessage: "Categories retrieved successfully!" });
  }
}

export default CategoryController;
