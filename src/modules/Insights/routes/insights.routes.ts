import express, { Router } from "express";
import InsightsController from "../controllers/insights.controller";

/**
 * Analytics / Insights routes (mounted at /insights — the AMS module already owns /analytics).
 * Phase 2: the permission-aware widget catalog + scoped widget data. Dashboards, the custom widget
 * builder and exports are added by later phases.
 */
class InsightsRoutes {
  private router: Router;
  private controller: InsightsController;

  constructor() {
    this.router = express.Router();
    this.controller = new InsightsController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    /**
     * @swagger
     * /insights/catalog:
     *   get:
     *     summary: Widgets available to the caller (permission-aware), grouped by module
     *     tags: [Insights]
     *     security: [ { bearerAuth: [] } ]
     *     responses:
     *       200: { description: OK }
     *       401: { $ref: '#/components/responses/401' }
     */
    this.router.get("/catalog", this.controller.getCatalog.bind(this.controller));

    /**
     * @swagger
     * /insights/widget/data:
     *   post:
     *     summary: Compute a single widget's data, scoped to the caller
     *     tags: [Insights]
     *     security: [ { bearerAuth: [] } ]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [key]
     *             properties:
     *               key: { type: string, example: "quickpass.byStatus" }
     *               filters: { type: object }
     *     responses:
     *       200: { description: OK }
     *       400: { $ref: '#/components/responses/400' }
     *       401: { $ref: '#/components/responses/401' }
     */
    this.router.post("/widget/data", this.controller.getWidgetData.bind(this.controller));

    // ---- dashboards (reads: analytics.read.*; writes: analytics.dashboard.*) ----
    this.router.get("/dashboard/list", this.controller.listDashboards.bind(this.controller));
    this.router.post("/dashboard/get", this.controller.getDashboard.bind(this.controller));
    this.router.post("/dashboard/create", this.controller.createDashboard.bind(this.controller));
    this.router.post("/dashboard/update", this.controller.updateDashboard.bind(this.controller));
    this.router.post("/dashboard/delete", this.controller.deleteDashboard.bind(this.controller));
    this.router.post("/dashboard/duplicate", this.controller.duplicateDashboard.bind(this.controller));
    this.router.post("/dashboard/setHome", this.controller.setHomeDashboard.bind(this.controller));
    this.router.post("/dashboard/share", this.controller.shareDashboard.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default InsightsRoutes;
