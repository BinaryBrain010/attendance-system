import express, { Router } from 'express';
import StatsController from '../controllers/stats.controller';

class StatsRoutes {
  private router: Router;
  private controller: StatsController;

  constructor() {
    this.router = express.Router();
    this.controller = new StatsController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    /**
     * @swagger
     * /stats/dashboard:
     *   get:
     *     summary: Get dashboard overview statistics
     *     tags: [Stats/Widgets]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Dashboard stats retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 message:
     *                   type: string
     *                 data:
     *                   type: object
     *                   properties:
     *                     gatePasses:
     *                       type: object
     *                     customers:
     *                       type: object
     *                     items:
     *                       type: object
     *                     recentGatePasses:
     *                       type: array
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/dashboard', this.controller.getDashboardStats.bind(this.controller));

    /**
     * @swagger
     * /stats/gatePass:
     *   get:
     *     summary: Get gate pass statistics
     *     tags: [Stats/Widgets]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Gate pass stats retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 message:
     *                   type: string
     *                 data:
     *                   type: object
     *                   properties:
     *                     total:
     *                       type: number
     *                     byStatus:
     *                       type: object
     *                     byPeriod:
     *                       type: object
     *                     monthlyReport:
     *                       type: array
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/gatePass', this.controller.getGatePassStats.bind(this.controller));

    /**
     * @swagger
     * /stats/customer:
     *   get:
     *     summary: Get customer statistics
     *     tags: [Stats/Widgets]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Customer stats retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 message:
     *                   type: string
     *                 data:
     *                   type: object
     *                   properties:
     *                     total:
     *                       type: number
     *                     active:
     *                       type: number
     *                     topCustomers:
     *                       type: array
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/customer', this.controller.getCustomerStats.bind(this.controller));

    /**
     * @swagger
     * /stats/item:
     *   get:
     *     summary: Get item statistics
     *     tags: [Stats/Widgets]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Item stats retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 message:
     *                   type: string
     *                 data:
     *                   type: object
     *                   properties:
     *                     total:
     *                       type: number
     *                     outOfStock:
     *                       type: number
     *                     lowStock:
     *                       type: number
     *                     inUse:
     *                       type: number
     *                     mostUsedItems:
     *                       type: array
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/item', this.controller.getItemStats.bind(this.controller));

    /**
     * @swagger
     * /stats/dateRange:
     *   post:
     *     summary: Get statistics by date range
     *     tags: [Stats/Widgets]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - from
     *               - to
     *             properties:
     *               from:
     *                 type: string
     *                 format: date-time
     *                 example: "2024-01-01T00:00:00Z"
     *               to:
     *                 type: string
     *                 format: date-time
     *                 example: "2024-12-31T23:59:59Z"
     *     responses:
     *       200:
     *         description: Stats by date range retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 message:
     *                   type: string
     *                 data:
     *                   type: object
     *                   properties:
     *                     gatePasses:
     *                       type: number
     *                     customers:
     *                       type: number
     *                     items:
     *                       type: number
     *                     dateRange:
     *                       type: object
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/dateRange', this.controller.getStatsByDateRange.bind(this.controller));

    /**
     * @swagger
     * /stats/widgets:
     *   get:
     *     summary: Get all widget data for dashboard
     *     tags: [Stats/Widgets]
     *     security:
     *       - bearerAuth: []
     *     description: Returns comprehensive statistics including dashboard overview, gate pass stats, customer stats, and item stats
     *     responses:
     *       200:
     *         description: Widget data retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 message:
     *                   type: string
     *                 data:
     *                   type: object
     *                   properties:
     *                     overview:
     *                       type: object
     *                     gatePasses:
     *                       type: object
     *                     customers:
     *                       type: object
     *                     items:
     *                       type: object
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/widgets', this.controller.getWidgetData.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default StatsRoutes;

