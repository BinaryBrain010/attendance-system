import { Request, Response } from "express";
import BaseController from "../../../core/controllers/base.controller";
import InsightsService from "../services/insights.service";
import DashboardService from "../services/dashboard.service";
import { getFeatureSet } from "../shared/gating";

class InsightsController extends BaseController<InsightsService> {
  protected service = new InsightsService();
  private dashboards = new DashboardService();

  // ---------- catalog + widget data ----------

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

  // ---------- dashboards ----------

  async listDashboards(req: Request, res: Response) {
    const userId = (req as any).userId as string;
    await this.handleRequest(() => this.dashboards.list(userId), res, { successMessage: "Dashboards" });
  }

  async getDashboard(req: Request, res: Response) {
    const userId = (req as any).userId as string;
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ success: false, message: "id is required", statusCode: 400 });
    await this.handleRequest(() => this.dashboards.get(userId, id), res, { successMessage: "Dashboard" });
  }

  async createDashboard(req: Request, res: Response) {
    const userId = (req as any).userId as string;
    const feats = await getFeatureSet(userId);
    await this.handleRequest(() => this.dashboards.create(userId, feats, req.body || {}), res, { successMessage: "Dashboard created" });
  }

  async updateDashboard(req: Request, res: Response) {
    const userId = (req as any).userId as string;
    const feats = await getFeatureSet(userId);
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ success: false, message: "id is required", statusCode: 400 });
    await this.handleRequest(() => this.dashboards.update(userId, feats, req.body), res, { successMessage: "Dashboard saved" });
  }

  async deleteDashboard(req: Request, res: Response) {
    const userId = (req as any).userId as string;
    const feats = await getFeatureSet(userId);
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ success: false, message: "id is required", statusCode: 400 });
    await this.handleRequest(() => this.dashboards.remove(userId, feats, id), res, { successMessage: "Dashboard deleted" });
  }

  async duplicateDashboard(req: Request, res: Response) {
    const userId = (req as any).userId as string;
    const feats = await getFeatureSet(userId);
    const { id, name } = req.body || {};
    if (!id) return res.status(400).json({ success: false, message: "id is required", statusCode: 400 });
    await this.handleRequest(() => this.dashboards.duplicate(userId, feats, id, name), res, { successMessage: "Dashboard duplicated" });
  }

  async setHomeDashboard(req: Request, res: Response) {
    const userId = (req as any).userId as string;
    const feats = await getFeatureSet(userId);
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ success: false, message: "id is required", statusCode: 400 });
    await this.handleRequest(() => this.dashboards.setHome(userId, feats, id), res, { successMessage: "Home dashboard set" });
  }

  async shareDashboard(req: Request, res: Response) {
    const userId = (req as any).userId as string;
    const feats = await getFeatureSet(userId);
    const { id, roleIds } = req.body || {};
    if (!id) return res.status(400).json({ success: false, message: "id is required", statusCode: 400 });
    await this.handleRequest(() => this.dashboards.share(userId, feats, id, roleIds || []), res, { successMessage: "Dashboard shared" });
  }
}

export default InsightsController;
