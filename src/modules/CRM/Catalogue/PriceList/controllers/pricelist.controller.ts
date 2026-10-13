import { Request, Response } from "express";
import ExcelJS from "exceljs";
import BaseController from "../../../../../core/controllers/base.controller";
import PriceListService from "../services/pricelist.service";
import { canSeeCost, stripCost } from "../../../shared/cost";
import { ForbiddenError } from "../../../../../core/errors/app.error";

class PriceListController extends BaseController<PriceListService> {
  protected service = new PriceListService();

  /** Bulk price/cost update. Accepts an uploaded .xlsx (field "file", columns SKU/Price/Cost) or
   * body.rows [{sku,price,cost}]. Cost-gated. dryRun defaults TRUE (pass dryRun=false to persist). */
  async bulkPrice(req: Request, res: Response) {
    await this.handleRequest(async () => {
      const uid = (req as any).userId;
      if (!(await canSeeCost(uid))) throw new ForbiddenError("crm.catalogue.cost.* required for bulk price update");
      let rows: any[] = Array.isArray(req.body?.rows) ? req.body.rows : [];
      const file = (req as any).file;
      if (file?.buffer) {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(file.buffer);
        const ws = wb.worksheets[0];
        const header: Record<string, number> = {};
        ws.getRow(1).eachCell((cell, col) => { header[String(cell.value || "").trim().toLowerCase()] = col; });
        const skuCol = header["sku"] || 1, priceCol = header["price"] || header["retail price"] || 2, costCol = header["cost"] || header["cost per item"] || 3;
        rows = [];
        ws.eachRow((row, i) => { if (i === 1) return; const sku = row.getCell(skuCol).value; if (sku) rows.push({ sku, price: row.getCell(priceCol).value, cost: row.getCell(costCol).value }); });
      }
      const dryRun = !(String(req.query.dryRun ?? req.body?.dryRun) === "false");
      return this.service.bulkSetPrices(rows, dryRun ? null : uid, dryRun);
    }, res, { successMessage: "Bulk price update processed" });
  }

  async byProduct(req: Request, res: Response) {
    const { productId } = req.body;
    const canSee = await canSeeCost((req as any).userId);
    await this.handleRequest(async () => stripCost(await this.service.byProduct(productId), canSee), res, {
      successMessage: "Prices retrieved successfully!",
    });
  }

  /** Cost-visible view — requires crm.catalogue.cost.* (double-checked here regardless of RBAC mode). */
  async withCost(req: Request, res: Response) {
    const { productId } = req.body;
    await this.handleRequest(async () => {
      if (!(await canSeeCost((req as any).userId))) {
        throw new ForbiddenError("crm.catalogue.cost.* required to view cost");
      }
      return this.service.byProduct(productId);
    }, res, { successMessage: "Prices with cost retrieved successfully!" });
  }

  async create(req: Request, res: Response) {
    const data = { ...req.body, createdBy: (req as any).userId };
    await this.handleRequest(() => this.service.create(data), res, {
      successMessage: "Price created successfully!", statusCode: 201,
      logActivity: { action: "CREATE", entityType: "PriceList", entityId: (r: any) => r?.id, description: `Price set for product ${req.body?.productId ?? ""}` }, req,
    });
  }
  async update(req: Request, res: Response) {
    const { id, ...rest } = req.body;
    await this.handleRequest(() => this.service.update(id, { ...rest, updatedBy: (req as any).userId }), res, {
      successMessage: "Price updated successfully!",
      logActivity: { action: "UPDATE", entityType: "PriceList", entityId: id, description: "Price updated" }, req,
    });
  }
  async remove(req: Request, res: Response) {
    const { id } = req.body;
    await this.handleRequest(() => this.service.remove(id), res, {
      successMessage: "Price deleted successfully!",
      logActivity: { action: "DELETE", entityType: "PriceList", entityId: id, description: "Price deleted" }, req,
    });
  }
}

export default PriceListController;
