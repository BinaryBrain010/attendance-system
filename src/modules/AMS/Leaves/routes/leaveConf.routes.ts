// src/conf/leaveConfig.routes.ts

import express, { Router } from 'express';
import LeaveController from '../controllers/leave.controller';

class LeaveConfigRoutes {
  private router: Router;
  private controller: LeaveController;

  constructor() {
    this.router = express.Router();
    this.controller = new LeaveController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    /**
     * @swagger
     * /leave/leave-configurations/getAll:
     *   get:
     *     summary: Get all leave configurations
     *     tags: [Leaves]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Leave configurations retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/getAll', this.controller.getAllLeaveConfigurations.bind(this.controller));
    
    /**
     * @swagger
     * /leave/leave-configurations/get:
     *   post:
     *     summary: Get paginated leave configurations
     *     tags: [Leaves]
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
     *     responses:
     *       200:
     *         description: Leave configurations retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PaginatedResponse'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/get', this.controller.getLeaveConfigurations.bind(this.controller));
    
    /**
     * @swagger
     * /leave/leave-configurations/create:
     *   post:
     *     summary: Create a new leave configuration
     *     tags: [Leaves]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - name
     *               - days
     *             properties:
     *               name:
     *                 type: string
     *                 example: "Annual Leave"
     *               days:
     *                 type: integer
     *                 example: 20
     *               description:
     *                 type: string
     *                 example: "Annual vacation leave"
     *     responses:
     *       201:
     *         description: Leave configuration created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/create', this.controller.createLeaveConfiguration.bind(this.controller));
    
    /**
     * @swagger
     * /leave/leave-configurations/update:
     *   put:
     *     summary: Update a leave configuration
     *     tags: [Leaves]
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
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *               leaveConfigData:
     *                 type: object
     *     responses:
     *       200:
     *         description: Leave configuration updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.put('/update', this.controller.updateLeaveConfiguration.bind(this.controller));
    
    /**
     * @swagger
     * /leave/leave-configurations/delete:
     *   post:
     *     summary: Delete a leave configuration (soft delete)
     *     tags: [Leaves]
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
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *     responses:
     *       200:
     *         description: Leave configuration deleted successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/delete', this.controller.deleteLeaveConfiguration.bind(this.controller));
    
    /**
     * @swagger
     * /leave/leave-configurations/restore:
     *   post:
     *     summary: Restore a deleted leave configuration
     *     tags: [Leaves]
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
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *     responses:
     *       200:
     *         description: Leave configuration restored successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/restore', this.controller.restoreLeaveConfiguration.bind(this.controller));
    
    /**
     * @swagger
     * /leave/leave-configurations/getById:
     *   post:
     *     summary: Get leave configuration by ID
     *     tags: [Leaves]
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
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *     responses:
     *       200:
     *         description: Leave configuration retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/getById', this.controller.getLeaveConfigurationById.bind(this.controller));
    
    /**
     * @swagger
     * /leave/leave-configurations/getDeleted:
     *   post:
     *     summary: Get deleted leave configurations
     *     tags: [Leaves]
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
     *     responses:
     *       200:
     *         description: Deleted leave configurations retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PaginatedResponse'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/getDeleted', this.controller.getDeletedLeaveConfigurations.bind(this.controller));
    
    /**
     * @swagger
     * /leave/leave-configurations/search:
     *   post:
     *     summary: Search leave configurations
     *     tags: [Leaves]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               searchTerm:
     *                 type: string
     *                 example: "Annual"
     *               page:
     *                 type: integer
     *                 example: 1
     *               pageSize:
     *                 type: integer
     *                 example: 10
     *     responses:
     *       200:
     *         description: Search results retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PaginatedResponse'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/search', this.controller.searchLeaveConfigurations.bind(this.controller));
    
    /**
     * @swagger
     * /leave/leave-configurations/total:
     *   get:
     *     summary: Get total leave configurations count
     *     tags: [Leaves]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Total count retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/total', this.controller.getTotalLeaveConfigurations.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default LeaveConfigRoutes;
