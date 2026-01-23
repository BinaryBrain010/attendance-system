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
     *     summary: Get all attendance requests with employee details (master-detail format)
     *     tags: [Attendance]
     *     security:
     *       - bearerAuth: []
     *     description: Returns all attendance requests with complete employee information and user names in master-detail format
     *     responses:
     *       200:
     *         description: Attendance requests retrieved successfully with employee details
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
     *                   type: array
     *                   items:
     *                     type: object
     *                     description: Master-detail format with attendance request and employee data
     *                     properties:
     *                       id:
     *                         type: string
     *                       employeeId:
     *                         type: string
     *                       attendanceId:
     *                         type: string
     *                       reason:
     *                         type: string
     *                       status:
     *                         type: string
     *                       proposedStatus:
     *                         type: string
     *                       proposedCheckIn:
     *                         type: string
     *                       proposedCheckOut:
     *                         type: string
     *                       requestedBy:
     *                         type: string
     *                       requestedByName:
     *                         type: string
     *                       approvedBy:
     *                         type: string
     *                       approvedByName:
     *                         type: string
     *                       employeeCode:
     *                         type: string
     *                       employeeName:
     *                         type: string
     *                       employeeSurname:
     *                         type: string
     *                       employeeDesignation:
     *                         type: string
     *                       employeeDepartment:
     *                         type: string
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/get', this.controller.getAllAttendanceRequests.bind(this.controller));
    
    /**
     * @swagger
     * /attendanceReq/get:
     *   post:
     *     summary: Get paginated attendance requests with employee details (master-detail format)
     *     tags: [Attendance]
     *     security:
     *       - bearerAuth: []
     *     description: Returns paginated attendance requests with complete employee information and user names
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
     *         description: Attendance requests retrieved successfully with employee details
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
     *                     data:
     *                       type: array
     *                       items:
     *                         type: object
     *                         description: Master-detail format with attendance request and employee data
     *                     totalSize:
     *                       type: integer
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/get', this.controller.getAttendanceRequests.bind(this.controller));
    
    /**
     * @swagger
     * /attendanceReq/getEmployee:
     *   post:
     *     summary: Get attendance requests by employee ID with employee details (master-detail format)
     *     tags: [Attendance]
     *     security:
     *       - bearerAuth: []
     *     description: Returns all attendance requests for a specific employee with complete employee information
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
     *         description: Attendance requests retrieved successfully with employee details
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
     *                   type: array
     *                   items:
     *                     type: object
     *                     description: Master-detail format with attendance request and employee data
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
     *     summary: Approve or reject an attendance request
     *     tags: [Attendance]
     *     security:
     *       - bearerAuth: []
     *     description: Updates the status of an attendance request. Requires 'attendance.request.approve.*' permission. If approved and request has attendanceId, applies proposed changes to attendance. If approved without attendanceId, creates new attendance.
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
     *                 enum: [PENDING, APPROVED, REJECTED]
     *                 example: APPROVED
     *     responses:
     *       200:
     *         description: Status updated successfully. If approved, attendance changes have been applied.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     *       403:
     *         description: User doesn't have permission to approve attendance requests
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/updateStatus', this.controller.updateAttendanceRequestStatus.bind(this.controller));
    
    /**
     * @swagger
     * /attendanceReq/getById:
     *   post:
     *     summary: Get attendance request by ID with employee details (master-detail format)
     *     tags: [Attendance]
     *     security:
     *       - bearerAuth: []
     *     description: Returns a single attendance request with complete employee information and user names
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
     *         description: Attendance request retrieved successfully with employee details
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
     *                   description: Master-detail format with attendance request and employee data
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/getById', this.controller.getAttendanceRequestById.bind(this.controller));
    
    /**
     * @swagger
     * /attendanceReq/bulkUpdateStatus:
     *   post:
     *     summary: Bulk approve or reject multiple attendance requests
     *     tags: [Attendance]
     *     security:
     *       - bearerAuth: []
     *     description: Updates the status of multiple attendance requests in a single operation. Requires 'attendance.request.approve.*' permission. If approved, applies proposed changes to attendance records.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - requestIds
     *               - status
     *             properties:
     *               requestIds:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: Array of attendance request IDs to update
     *                 example: ["123e4567-e89b-12d3-a456-426614174000", "223e4567-e89b-12d3-a456-426614174001"]
     *               status:
     *                 type: string
     *                 enum: [APPROVED, REJECTED, PENDING]
     *                 description: Status to set for all requests
     *                 example: APPROVED
     *     responses:
     *       200:
     *         description: Bulk status update completed. Returns count of successful and failed operations.
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
     *                   example: "Bulk approved operation completed!"
     *                 data:
     *                   type: object
     *                   properties:
     *                     successful:
     *                       type: integer
     *                       description: Number of successfully processed requests
     *                       example: 8
     *                     failed:
     *                       type: integer
     *                       description: Number of failed requests
     *                       example: 2
     *                     errors:
     *                       type: array
     *                       description: Details of failed requests
     *                       items:
     *                         type: object
     *                         properties:
     *                           requestId:
     *                             type: string
     *                             example: "223e4567-e89b-12d3-a456-426614174001"
     *                           error:
     *                             type: string
     *                             example: "Attendance request not found"
     *       400:
     *         description: Bad request - Missing or invalid parameters
     *       401:
     *         $ref: '#/components/responses/401'
     *       403:
     *         description: User doesn't have permission to approve attendance requests
     */
    this.router.post('/bulkUpdateStatus', this.controller.bulkUpdateAttendanceRequestStatus.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default AttendanceReqRoutes;
