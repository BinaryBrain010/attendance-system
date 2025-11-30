// src/req/leaveReq.routes.ts

import express, { Router } from 'express';
import LeaveReqController from '../controllers/leaveReq.controller';

class LeaveReqRoutes {
  private router: Router;
  private controller: LeaveReqController;

  constructor() {
    this.router = express.Router();
    this.controller = new LeaveReqController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    /**
     * @swagger
     * /leave/leave-requests/get:
     *   get:
     *     summary: Get all leave requests
     *     tags: [Leaves]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Leave requests retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/get', this.controller.getAllLeaveRequests.bind(this.controller));
    
    /**
     * @swagger
     * /leave/leave-requests/get:
     *   post:
     *     summary: Get paginated leave requests
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
     *         description: Leave requests retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PaginatedResponse'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/get', this.controller.getLeaveRequests.bind(this.controller));
    
    /**
     * @swagger
     * /leave/leave-requests/getEmployee:
     *   post:
     *     summary: Get leave requests by employee ID
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
     *         description: Leave requests retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/getEmployee', this.controller.getLeaveRequestsByEmployeeId.bind(this.controller));
    
    /**
     * @swagger
     * /leave/leave-requests/deleted:
     *   get:
     *     summary: Get deleted leave requests
     *     tags: [Leaves]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Deleted leave requests retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/deleted', this.controller.getDeletedLeaveRequests.bind(this.controller));
    
    /**
     * @swagger
     * /leave/leave-requests/search:
     *   post:
     *     summary: Search leave requests
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
    this.router.post('/search', this.controller.searchLeaveRequests.bind(this.controller));
    
    /**
     * @swagger
     * /leave/leave-requests/total:
     *   get:
     *     summary: Get total leave requests count
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
    this.router.get('/total', this.controller.getTotalLeaveRequests.bind(this.controller));
    
    /**
     * @swagger
     * /leave/leave-requests/create:
     *   post:
     *     summary: Create a new leave request
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
     *               - startDate
     *               - endDate
     *             properties:
     *               employeeId:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *               leaveConfigurationId:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *               startDate:
     *                 type: string
     *                 format: date
     *                 example: "2024-01-15"
     *               endDate:
     *                 type: string
     *                 format: date
     *                 example: "2024-01-20"
     *               reason:
     *                 type: string
     *                 example: "Vacation"
     *     responses:
     *       201:
     *         description: Leave request created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/create', this.controller.createLeaveRequest.bind(this.controller));
    
    /**
     * @swagger
     * /leave/leave-requests/update:
     *   put:
     *     summary: Update a leave request
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
     *         description: Leave request updated successfully
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
    this.router.put('/update', this.controller.updateLeaveRequest.bind(this.controller));
    
    /**
     * @swagger
     * /leave/leave-requests/delete:
     *   post:
     *     summary: Delete a leave request (soft delete)
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
     *         description: Leave request deleted successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/delete', this.controller.deleteLeaveRequest.bind(this.controller));
    
    /**
     * @swagger
     * /leave/leave-requests/restore:
     *   post:
     *     summary: Restore a deleted leave request
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
     *         description: Leave request restored successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/restore', this.controller.restoreLeaveRequest.bind(this.controller));
    
    /**
     * @swagger
     * /leave/leave-requests/updateStatus:
     *   post:
     *     summary: Update leave request status
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
     *               - status
     *             properties:
     *               id:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *               status:
     *                 type: string
     *                 enum: [pending, approved, rejected]
     *                 example: approved
     *     responses:
     *       200:
     *         description: Status updated successfully
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
    this.router.post('/updateStatus', this.controller.updateLeaveRequestStatus.bind(this.controller));
    
    /**
     * @swagger
     * /leave/leave-requests/getById:
     *   get:
     *     summary: Get leave request by ID
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
     *         description: Leave request retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.get('/getById', this.controller.getLeaveRequestById.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default LeaveReqRoutes;
