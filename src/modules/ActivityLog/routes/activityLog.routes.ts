import express, { Router } from 'express';
import ActivityLogController from '../controllers/activityLog.controller';

class ActivityLogRoutes {
  private router: Router;
  private controller: ActivityLogController;

  constructor() {
    this.router = express.Router();
    this.controller = new ActivityLogController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // Authentication is applied at the route level via routes.helper.ts

    /**
     * @swagger
     * /activityLog/get:
     *   get:
     *     summary: Get all activity logs with optional filters
     *     tags: [ActivityLog]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: userId
     *         schema:
     *           type: string
     *         description: Filter by user ID
     *       - in: query
     *         name: action
     *         schema:
     *           type: string
     *         description: Filter by action (CREATE, UPDATE, DELETE, etc.)
     *       - in: query
     *         name: entityType
     *         schema:
     *           type: string
     *         description: Filter by entity type (Employee, Attendance, etc.)
     *       - in: query
     *         name: entityId
     *         schema:
     *           type: string
     *         description: Filter by entity ID
     *       - in: query
     *         name: from
     *         schema:
     *           type: string
     *           format: date
     *         description: Filter from date
     *       - in: query
     *         name: to
     *         schema:
     *           type: string
     *           format: date
     *         description: Filter to date
     *     responses:
     *       200:
     *         description: Activity logs retrieved successfully
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/get', this.controller.getAllActivityLogs.bind(this.controller));

    /**
     * @swagger
     * /activityLog/get:
     *   post:
     *     summary: Get paginated activity logs with filters
     *     tags: [ActivityLog]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               page:
     *                 type: integer
     *                 example: 1
     *               pageSize:
     *                 type: integer
     *                 example: 10
     *               userId:
     *                 type: string
     *               action:
     *                 type: string
     *               entityType:
     *                 type: string
     *               entityId:
     *                 type: string
     *               from:
     *                 type: string
     *                 format: date
     *               to:
     *                 type: string
     *                 format: date
     *     responses:
     *       200:
     *         description: Activity logs retrieved successfully
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/get', this.controller.getActivityLogs.bind(this.controller));

    /**
     * @swagger
     * /activityLog/getById:
     *   post:
     *     summary: Get activity log by ID
     *     tags: [ActivityLog]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - id
     *             properties:
     *               id:
     *                 type: string
     *     responses:
     *       200:
     *         description: Activity log retrieved successfully
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/getById', this.controller.getActivityLogById.bind(this.controller));

    /**
     * @swagger
     * /activityLog/count:
     *   get:
     *     summary: Get activity log count with optional filters
     *     tags: [ActivityLog]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: userId
     *         schema:
     *           type: string
     *       - in: query
     *         name: action
     *         schema:
     *           type: string
     *       - in: query
     *         name: entityType
     *         schema:
     *           type: string
     *       - in: query
     *         name: entityId
     *         schema:
     *           type: string
     *       - in: query
     *         name: from
     *         schema:
     *           type: string
     *           format: date
     *       - in: query
     *         name: to
     *         schema:
     *           type: string
     *           format: date
     *     responses:
     *       200:
     *         description: Activity log count retrieved successfully
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/count', this.controller.getActivityLogCount.bind(this.controller));

    /**
     * @swagger
     * /activityLog/getByUser:
     *   post:
     *     summary: Get activity logs by user
     *     tags: [ActivityLog]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - userId
     *             properties:
     *               userId:
     *                 type: string
     *               page:
     *                 type: integer
     *               pageSize:
     *                 type: integer
     *               action:
     *                 type: string
     *               entityType:
     *                 type: string
     *               from:
     *                 type: string
     *                 format: date
     *               to:
     *                 type: string
     *                 format: date
     *     responses:
     *       200:
     *         description: User activity logs retrieved successfully
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/getByUser', this.controller.getActivityLogsByUser.bind(this.controller));

    /**
     * @swagger
     * /activityLog/getByEntity:
     *   post:
     *     summary: Get activity logs by entity
     *     tags: [ActivityLog]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - entityType
     *               - entityId
     *             properties:
     *               entityType:
     *                 type: string
     *               entityId:
     *                 type: string
     *               page:
     *                 type: integer
     *               pageSize:
     *                 type: integer
     *               userId:
     *                 type: string
     *               action:
     *                 type: string
     *               from:
     *                 type: string
     *                 format: date
     *               to:
     *                 type: string
     *                 format: date
     *     responses:
     *       200:
     *         description: Entity activity logs retrieved successfully
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/getByEntity', this.controller.getActivityLogsByEntity.bind(this.controller));

    /**
     * @swagger
     * /activityLog/getByUnit:
     *   post:
     *     summary: Get activity logs for all users/employees in a unit
     *     tags: [ActivityLog]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - unitId
     *             properties:
     *               unitId:
     *                 type: string
     *                 description: Unit ID to get activity logs for
     *                 example: "88b7e906-86e7-437d-9c69-6255082380f7"
     *               page:
     *                 type: integer
     *                 example: 1
     *               pageSize:
     *                 type: integer
     *                 example: 10
     *               action:
     *                 type: string
     *                 description: Filter by action (optional)
     *               entityType:
     *                 type: string
     *                 description: Filter by entity type (optional)
     *               entityId:
     *                 type: string
     *                 description: Filter by entity ID (optional)
     *               from:
     *                 type: string
     *                 format: date
     *                 description: Filter from date (optional)
     *               to:
     *                 type: string
     *                 format: date
     *                 description: Filter to date (optional)
     *     responses:
     *       200:
     *         description: Unit activity logs retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                   example: true
     *                 message:
     *                   type: string
     *                   example: "Unit activity logs retrieved successfully!"
     *                 data:
     *                   type: object
     *                   properties:
     *                     data:
     *                       type: array
     *                       items:
     *                         type: object
     *                         properties:
     *                           id:
     *                             type: string
     *                           userId:
     *                             type: string
     *                           userName:
     *                             type: string
     *                           action:
     *                             type: string
     *                           entityType:
     *                             type: string
     *                           entityId:
     *                             type: string
     *                           description:
     *                             type: string
     *                           metadata:
     *                             type: object
     *                           ipAddress:
     *                             type: string
     *                           userAgent:
     *                             type: string
     *                           createdAt:
     *                             type: string
     *                             format: date-time
     *                     totalSize:
     *                       type: integer
     *                       example: 50
     *       400:
     *         description: Bad request - Unit ID is required
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/getByUnit', this.controller.getActivityLogsByUnit.bind(this.controller));

    /**
     * @swagger
     * /activityLog/me:
     *   get:
     *     summary: Get current user's activity logs
     *     description: Returns activity logs for the authenticated user making the request. Supports query parameters for filtering.
     *     tags: [ActivityLog]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *           default: 1
     *         description: Page number
     *       - in: query
     *         name: pageSize
     *         schema:
     *           type: integer
     *           default: 10
     *         description: Number of items per page
     *       - in: query
     *         name: action
     *         schema:
     *           type: string
     *         description: Filter by action (CREATE, UPDATE, DELETE, etc.)
     *       - in: query
     *         name: entityType
     *         schema:
     *           type: string
     *         description: Filter by entity type (Employee, Attendance, etc.)
     *       - in: query
     *         name: from
     *         schema:
     *           type: string
     *           format: date
     *         description: Filter from date
     *       - in: query
     *         name: to
     *         schema:
     *           type: string
     *           format: date
     *         description: Filter to date
     *     responses:
     *       200:
     *         description: User's activity logs retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                   example: true
     *                 message:
     *                   type: string
     *                   example: "Your activity logs retrieved successfully!"
     *                 data:
     *                   type: object
     *                   properties:
     *                     data:
     *                       type: array
     *                       items:
     *                         type: object
     *                         properties:
     *                           id:
     *                             type: string
     *                           userId:
     *                             type: string
     *                           userName:
     *                             type: string
     *                           action:
     *                             type: string
     *                           entityType:
     *                             type: string
     *                           entityId:
     *                             type: string
     *                           description:
     *                             type: string
     *                           metadata:
     *                             type: object
     *                           ipAddress:
     *                             type: string
     *                           userAgent:
     *                             type: string
     *                           createdAt:
     *                             type: string
     *                             format: date-time
     *                     totalSize:
     *                       type: integer
     *                       example: 50
     *       401:
     *         description: Unauthorized - User not authenticated
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/me', this.controller.getMyActivityLogs.bind(this.controller));

    /**
     * @swagger
     * /activityLog/me:
     *   post:
     *     summary: Get current user's activity logs (POST method)
     *     description: Returns activity logs for the authenticated user making the request. Supports request body for filtering.
     *     tags: [ActivityLog]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: false
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               page:
     *                 type: integer
     *                 default: 1
     *                 example: 1
     *               pageSize:
     *                 type: integer
     *                 default: 10
     *                 example: 10
     *               action:
     *                 type: string
     *                 description: Filter by action (optional)
     *                 example: "CREATE"
     *               entityType:
     *                 type: string
     *                 description: Filter by entity type (optional)
     *                 example: "Employee"
     *               from:
     *                 type: string
     *                 format: date
     *                 description: Filter from date (optional)
     *               to:
     *                 type: string
     *                 format: date
     *                 description: Filter to date (optional)
     *     responses:
     *       200:
     *         description: User's activity logs retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                   example: true
     *                 message:
     *                   type: string
     *                   example: "Your activity logs retrieved successfully!"
     *                 data:
     *                   type: object
     *                   properties:
     *                     data:
     *                       type: array
     *                       items:
     *                         type: object
     *                         properties:
     *                           id:
     *                             type: string
     *                           userId:
     *                             type: string
     *                           userName:
     *                             type: string
     *                           action:
     *                             type: string
     *                           entityType:
     *                             type: string
     *                           entityId:
     *                             type: string
     *                           description:
     *                             type: string
     *                           metadata:
     *                             type: object
     *                           ipAddress:
     *                             type: string
     *                           userAgent:
     *                             type: string
     *                           createdAt:
     *                             type: string
     *                             format: date-time
     *                     totalSize:
     *                       type: integer
     *                       example: 50
     *       401:
     *         description: Unauthorized - User not authenticated
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/me', this.controller.getMyActivityLogs.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default ActivityLogRoutes;
