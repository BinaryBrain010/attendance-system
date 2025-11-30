import express, { Router } from 'express';
import AttendanceReqController from '../controllers/attendanceReq.contoller';

class AttendanceReqRoutes {
  private router: Router;
  private controller: AttendanceReqController;

  constructor() {
    this.router = express.Router();
    this.controller = new AttendanceReqController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    /**
     * @swagger
     * /attendanceReq/get:
     *   get:
     *     summary: Get all attendance requests
     *     tags: [Attendance]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Attendance requests retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/get', this.controller.getAllAttendanceRequests.bind(this.controller));
    
    /**
     * @swagger
     * /attendanceReq/get:
     *   post:
     *     summary: Get paginated attendance requests
     *     tags: [Attendance]
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
     *         description: Attendance requests retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PaginatedResponse'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/get', this.controller.getAttendanceRequests.bind(this.controller));
    
    /**
     * @swagger
     * /attendanceReq/getEmployee:
     *   post:
     *     summary: Get attendance requests by employee ID
     *     tags: [Attendance]
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
     *         description: Attendance requests retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/getEmployee', this.controller.getAttendanceRequestsByEmployeeId.bind(this.controller));
    
    /**
     * @swagger
     * /attendanceReq/deleted:
     *   get:
     *     summary: Get deleted attendance requests
     *     tags: [Attendance]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Deleted attendance requests retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/deleted', this.controller.getDeletedAttendanceRequests.bind(this.controller));
    
    /**
     * @swagger
     * /attendanceReq/search:
     *   post:
     *     summary: Search attendance requests
     *     tags: [Attendance]
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
    this.router.post('/search', this.controller.searchAttendanceRequests.bind(this.controller));
    
    /**
     * @swagger
     * /attendanceReq/total:
     *   get:
     *     summary: Get total attendance requests count
     *     tags: [Attendance]
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
    this.router.get('/total', this.controller.getTotalAttendanceRequests.bind(this.controller));
    
    /**
     * @swagger
     * /attendanceReq/create:
     *   post:
     *     summary: Create a new attendance request
     *     tags: [Attendance]
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
     *               - date
     *             properties:
     *               employeeId:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *               date:
     *                 type: string
     *                 format: date
     *                 example: "2024-01-15"
     *               reason:
     *                 type: string
     *                 example: "Medical appointment"
     *     responses:
     *       201:
     *         description: Attendance request created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/create', this.controller.createAttendanceRequest.bind(this.controller));
    
    /**
     * @swagger
     * /attendanceReq/update:
     *   put:
     *     summary: Update an attendance request
     *     tags: [Attendance]
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
     *         description: Attendance request updated successfully
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
    this.router.put('/update', this.controller.updateAttendanceRequest.bind(this.controller));
    
    /**
     * @swagger
     * /attendanceReq/delete:
     *   post:
     *     summary: Delete an attendance request (soft delete)
     *     tags: [Attendance]
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
     *         description: Attendance request deleted successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/delete', this.controller.deleteAttendanceRequest.bind(this.controller));
    
    /**
     * @swagger
     * /attendanceReq/restore:
     *   post:
     *     summary: Restore a deleted attendance request
     *     tags: [Attendance]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - requestId
     *             properties:
     *               requestId:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *     responses:
     *       200:
     *         description: Attendance request restored successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/restore', this.controller.restoreAttendanceRequest.bind(this.controller));
    
    /**
     * @swagger
     * /attendanceReq/updateStatus:
     *   post:
     *     summary: Update attendance request status
     *     tags: [Attendance]
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
    this.router.post('/updateStatus', this.controller.updateAttendanceRequestStatus.bind(this.controller));
    
    /**
     * @swagger
     * /attendanceReq/getById:
     *   post:
     *     summary: Get attendance request by ID
     *     tags: [Attendance]
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
     *         description: Attendance request retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/getById', this.controller.getAttendanceRequestById.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default AttendanceReqRoutes;
