import { Request, Response } from "express";
import BaseController from "../../../core/controllers/base.controller";
import InsightsService from "../services/insights.service";

class InsightsController extends BaseController<InsightsService> {
  protected service = new InsightsService();

  /** GET /insights/catalog — widgets available to the caller, grouped by module. */
  async getCatalog(req: Request, res: Response) {
    const userId = (req as any).userId as string;
    await this.handleRequest(() => this.service.catalog(userId), res, { successMessage: "Widget catalog" });
  }

  /** POST /insights/widget/data — compute one widget scoped to the caller. Body: { key, filters? }. */
  async getWidgetData(req: Request, res: Response) {
    const userId = (req as any).userId as string;
    const { key, filters } = req.body || {};
    if (!key) return res.status(400).json({ success: false, message: "key is required", statusCode: 400 });
    await this.handleRequest(() => this.service.widgetData(userId, key, filters || {}), res, { successMessage: "Widget data" });
  }
}

export default InsightsController;
