// src/alloc/leaveAlloc.routes.ts

import express, { Router } from 'express';
import LeaveAllocController from '../controllers/leaveAlloc.controller';

class LeaveAllocRoutes {
  private router: Router;
  private controller: LeaveAllocController;

  constructor() {
    this.router = express.Router();
    this.controller = new LeaveAllocController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    /**
     * @swagger
     * /leave/leave-allocations/get:
     *   get:
     *     summary: Get all leave allocations
     *     tags: [Leaves]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Leave allocations retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/get', this.controller.getAllLeaveAllocations.bind(this.controller));
    
    /**
     * @swagger
     * /leave/leave-allocations/get:
     *   post:
     *     summary: Get paginated leave allocations
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
     *         description: Leave allocations retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PaginatedResponse'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/get', this.controller.getLeaveAllocations.bind(this.controller));
    
    /**
     * @swagger
     * /leave/leave-allocations/deleted:
     *   get:
     *     summary: Get deleted leave allocations
     *     tags: [Leaves]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Deleted leave allocations retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/deleted', this.controller.getDeletedLeaveAllocations.bind(this.controller));
    
    /**
     * @swagger
     * /leave/leave-allocations/search:
     *   post:
     *     summary: Search leave allocations
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
     *                 example: "John"
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
    this.router.post('/search', this.controller.searchLeaveAllocations.bind(this.controller));
    
    /**
     * @swagger
     * /leave/leave-allocations/total:
     *   get:
     *     summary: Get total leave allocations count
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
    this.router.get('/total', this.controller.getTotalLeaveAllocations.bind(this.controller));
    
    /**
     * @swagger
     * /leave/leave-allocations/create:
     *   post:
     *     summary: Create a new leave allocation
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
     *               - employeeId
     *               - leaveConfigurationId
     *               - allocatedDays
     *             properties:
     *               employeeId:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *               leaveConfigurationId:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *               allocatedDays:
     *                 type: integer
     *                 example: 20
     *     responses:
     *       201:
     *         description: Leave allocation created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/create', this.controller.createLeaveAllocation.bind(this.controller));
    
    /**
     * @swagger
     * /leave/leave-allocations/update:
     *   put:
     *     summary: Update a leave allocation
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
     *               data:
     *                 type: object
     *     responses:
     *       200:
     *         description: Leave allocation updated successfully
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
    this.router.put('/update', this.controller.updateLeaveAllocation.bind(this.controller));
    
    /**
     * @swagger
     * /leave/leave-allocations/delete:
     *   post:
     *     summary: Delete a leave allocation (soft delete)
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
     *         description: Leave allocation deleted successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/delete', this.controller.deleteLeaveAllocation.bind(this.controller));
    
    /**
     * @swagger
     * /leave/leave-allocations/restore:
     *   post:
     *     summary: Restore a deleted leave allocation
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
     *         description: Leave allocation restored successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/restore', this.controller.restoreLeaveAllocation.bind(this.controller));
    
    /**
     * @swagger
     * /leave/leave-allocations/getById:
     *   get:
     *     summary: Get leave allocation by ID
     *     tags: [Leaves]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         example: "123e4567-e89b-12d3-a456-426614174000"
     *     responses:
     *       200:
     *         description: Leave allocation retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.get('/getById', this.controller.getLeaveAllocationById.bind(this.controller));
    
    /**
     * @swagger
     * /leave/leave-allocations/getByEmployeeId:
     *   post:
     *     summary: Get leave allocations by employee ID
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
     *               - employeeId
     *             properties:
     *               employeeId:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *     responses:
     *       200:
     *         description: Leave allocations retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/getByEmployeeId', this.controller.getLeaveAllocationByEmployeeId.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default LeaveAllocRoutes;
