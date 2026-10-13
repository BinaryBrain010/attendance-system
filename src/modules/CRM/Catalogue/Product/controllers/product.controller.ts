import { Request, Response } from "express";
import BaseController from "../../../../../core/controllers/base.controller";
import ProductService from "../services/product.service";
import ShopifyImportService from "../services/shopifyImport.service";
import { canSeeCost, stripCost } from "../../../shared/cost";

class ProductController extends BaseController<ProductService> {
  protected service = new ProductService();
  private shopify = new ShopifyImportService();

  /** Import a Shopify products CSV. dryRun defaults TRUE — pass dryRun=false (query or body) to persist. */
  async importShopify(req: Request, res: Response) {
    const csv = (req as any).file?.buffer?.toString("utf8") ?? req.body?.csv;
    const dryRun = !(String(req.query.dryRun ?? req.body?.dryRun) === "false");
    await this.handleRequest(async () => {
      if (!csv) throw Object.assign(new Error("No CSV provided (file field 'file' or body.csv)"), { statusCode: 400 });
      return this.shopify.import(csv, dryRun);
    }, res, {
      successMessage: dryRun ? "Shopify import dry-run complete" : "Shopify catalogue imported",
      logActivity: dryRun ? undefined as any : { action: "IMPORT", entityType: "Product", description: "Shopify catalogue import" },
      req,
    });
  }

  /** Run an operation, then strip cost from embedded price lists unless the caller may see cost. */
  private async readGated(req: Request, res: Response, op: () => Promise<any>, successMessage: string) {
    const canSee = await canSeeCost((req as any).userId);
    await this.handleRequest(async () => stripCost(await op(), canSee), res, { successMessage });
  }

  async getAll(req: Request, res: Response) {
    await this.readGated(req, res, () => this.service.getAll(), "Products retrieved successfully!");
  }
  async get(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    await this.readGated(req, res, () => this.service.get(page, pageSize), "Products retrieved successfully!");
  }
  async getDeleted(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    await this.handleRequest(() => this.service.getDeleted(page, pageSize), res, { successMessage: "Deleted products retrieved successfully!" });
  }
  async getById(req: Request, res: Response) {
    const { id } = req.body;
    await this.readGated(req, res, () => this.service.getById(id), "Product retrieved successfully!");
  }
  async byCategory(req: Request, res: Response) {
    const { categoryId } = req.body;
    await this.readGated(req, res, () => this.service.byCategory(categoryId), "Products retrieved successfully!");
  }
  async total(_req: Request, res: Response) {
    await this.handleRequest(() => this.service.total(), res, { successMessage: "Total products retrieved successfully!" });
  }
  async create(req: Request, res: Response) {
    const data = { ...req.body, createdBy: (req as any).userId };
    await this.handleRequest(() => this.service.create(data), res, {
      successMessage: "Product created successfully!",
      statusCode: 201,
      logActivity: { action: "CREATE", entityType: "Product", entityId: (r: any) => r?.[0]?.id, description: `Product created: ${req.body?.name ?? ""}` },
      req,
    });
  }
  async update(req: Request, res: Response) {
    const { id, ...rest } = req.body;
    await this.handleRequest(() => this.service.update(id, { ...rest, updatedBy: (req as any).userId }), res, {
      successMessage: "Product updated successfully!",
      logActivity: { action: "UPDATE", entityType: "Product", entityId: id, description: "Product updated" },
      req,
    });
  }
  async addVariant(req: Request, res: Response) {
    const { productId, ...v } = req.body;
    await this.handleRequest(() => this.service.addVariant(productId, v), res, {
      successMessage: "Variant added successfully!", statusCode: 201,
      logActivity: { action: "UPDATE", entityType: "Product", entityId: productId, description: "Variant added" }, req,
    });
  }
  async addImage(req: Request, res: Response) {
    const { productId, ...img } = req.body;
    await this.handleRequest(() => this.service.addImage(productId, img), res, {
      successMessage: "Image added successfully!", statusCode: 201,
      logActivity: { action: "UPDATE", entityType: "Product", entityId: productId, description: "Image added" }, req,
    });
  }
  async remove(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.remove(id), res, {
      successMessage: "Product deleted successfully!",
      logActivity: { action: "DELETE", entityType: "Product", entityId: id, description: "Product deleted" }, req,
    });
  }
  async restore(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.restore(id), res, {
      successMessage: "Product restored successfully!",
      logActivity: { action: "RESTORE", entityType: "Product", entityId: id, description: "Product restored" }, req,
    });
  }
  async search(req: Request, res: Response) {
    const { searchTerm, search, page, pageSize } = req.body;
    await this.readGated(req, res, () => this.service.search(searchTerm ?? search ?? "", page, pageSize), "Products retrieved successfully!");
  }
}

export default ProductController;
