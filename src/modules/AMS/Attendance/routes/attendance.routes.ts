import express, { Router } from 'express';
import AttendanceController from '../controllers/attendance.controller';
import multer from 'multer';

// Configure multer to store files in memory as Buffers
const upload = multer({ storage: multer.memoryStorage() });

class AttendanceRoutes {
  private router: Router;
  private controller: AttendanceController;

  constructor() {
    this.router = express.Router();
    this.controller = new AttendanceController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    /**
     * @swagger
     * /attendance/get:
     *   get:
     *     summary: Get all attendances
     *     tags: [Attendance]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Attendances retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/get', this.controller.getAllAttendances.bind(this.controller));
    
    /**
     * @swagger
     * /attendance/get:
     *   post:
     *     summary: Get paginated attendances
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
     *         description: Attendances retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PaginatedResponse'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/get', this.controller.getAttendances.bind(this.controller));
    
    /**
     * @swagger
     * /attendance/getDate:
     *   post:
     *     summary: Get attendances by date range
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
     *               from:
     *                 type: string
     *                 format: date
     *                 example: "2024-01-01"
     *               to:
     *                 type: string
     *                 format: date
     *                 example: "2024-12-31"
     *     responses:
     *       200:
     *         description: Attendances retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/getDate', this.controller.getDated.bind(this.controller));
    
    /**
     * @swagger
     * /attendance/getEmployeeAttendance:
     *   post:
     *     summary: Get attendance for a specific employee
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
     *               from:
     *                 type: string
     *                 format: date
     *                 example: "2024-01-01"
     *               to:
     *                 type: string
     *                 format: date
     *                 example: "2024-12-31"
     *     responses:
     *       200:
     *         description: Employee attendance retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/getEmployeeAttendance', this.controller.getEmployeeAttendance.bind(this.controller));
    
    /**
     * @swagger
     * /attendance/total:
     *   get:
     *     summary: Get total attendances count
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
    this.router.get('/total', this.controller.getTotalAttendances.bind(this.controller));
    
    /**
     * @swagger
     * /attendance/getById:
     *   post:
     *     summary: Get attendance by ID
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
     *         description: Attendance retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/getById', this.controller.getAttendanceById.bind(this.controller));
    
    /**
     * @swagger
     * /attendance/create:
     *   post:
     *     summary: Create a new attendance record
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
     *               checkIn:
     *                 type: string
     *                 format: time
     *                 example: "09:00"
     *               checkOut:
     *                 type: string
     *                 format: time
     *                 example: "17:00"
     *               status:
     *                 type: string
     *                 enum: [present, absent, late, half_day]
     *                 example: present
     *     responses:
     *       201:
     *         description: Attendance created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/create', this.controller.createAttendance.bind(this.controller));
    
    /**
     * @swagger
     * /attendance/checkAttendance:
     *   post:
     *     summary: Check if attendance exists for employee and date
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
     *               status:
     *                 type: string
     *                 enum: [present, absent, late, half_day]
     *     responses:
     *       200:
     *         description: Attendance check completed
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 message:
     *                   type: string
     *                 status:
     *                   type: string
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/checkAttendance', this.controller.checkAttendance.bind(this.controller));
    
    /**
     * @swagger
     * /attendance/markAttendance:
     *   post:
     *     summary: Mark attendance for an employee
     *     tags: [Attendance]
     *     security:
     *       - bearerAuth: []
     *     description: Mark attendance for an employee. If status is ON_LEAVE and createLeaveRequest is true, a leave request will be automatically created and approved.
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
     *               date:
     *                 type: string
     *                 format: date
     *                 example: "2024-01-20"
     *               status:
     *                 type: string
     *                 enum: [PRESENT, ABSENT, LATE, ON_LEAVE, HALF_DAY, HOLIDAYS]
     *                 example: PRESENT
     *               checkIn:
     *                 type: string
     *                 format: date-time
     *                 example: "2024-01-20T09:00:00Z"
     *               checkOut:
     *                 type: string
     *                 format: date-time
     *                 example: "2024-01-20T17:00:00Z"
     *               comment:
     *                 type: string
     *                 example: "On time"
     *               location:
     *                 type: string
     *                 example: "Office"
     *               createLeaveRequest:
     *                 type: boolean
     *                 description: If true and status is ON_LEAVE, automatically creates and approves a leave request
     *                 example: true
     *               leaveType:
     *                 type: string
     *                 description: Type of leave (CASUAL, MATERNITY, SICK, etc.) - only used if createLeaveRequest is true and status is ON_LEAVE
     *                 example: "CASUAL"
     *               leaveReason:
     *                 type: string
     *                 description: Reason for leave - only used if createLeaveRequest is true and status is ON_LEAVE
     *                 example: "Personal work"
     *     responses:
     *       201:
     *         description: Attendance marked successfully
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
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/markAttendance', this.controller.markAttendance.bind(this.controller));
    
    /**
     * @swagger
     * /attendance/bulkMarkLeave:
     *   post:
     *     summary: Mark leave for multiple selected employees
     *     tags: [Attendance]
     *     security:
     *       - bearerAuth: []
     *     description: Marks attendance as ON_LEAVE for multiple selected employees on a specific date. Optionally creates leave requests for each employee.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - employeeIds
     *               - date
     *             properties:
     *               employeeIds:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: Array of employee IDs to mark leave for
     *                 example: ["emp-id-1", "emp-id-2", "emp-id-3"]
     *               date:
     *                 type: string
     *                 format: date
     *                 description: Date for which to mark leave
     *                 example: "2024-01-20"
     *               leaveType:
     *                 type: string
     *                 description: Type of leave (CASUAL, MATERNITY, SICK, etc.) - only used if createLeaveRequest is true
     *                 example: "CASUAL"
     *               reason:
     *                 type: string
     *                 description: Reason for leave
     *                 example: "Team event"
     *               createLeaveRequest:
     *                 type: boolean
     *                 description: If true, automatically creates and approves leave requests for each employee
     *                 default: false
     *                 example: true
     *     responses:
     *       200:
     *         description: Bulk leave marking completed successfully
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
     *                     success:
     *                       type: boolean
     *                     message:
     *                       type: string
     *                     total:
     *                       type: integer
     *                     successful:
     *                       type: integer
     *                     failed:
     *                       type: integer
     *                     results:
     *                       type: array
     *                       items:
     *                         type: object
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/bulkMarkLeave', this.controller.bulkMarkLeave.bind(this.controller));
    
    /**
     * @swagger
     * /attendance/update:
     *   put:
     *     summary: Update an attendance record
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
     *         description: Attendance updated successfully
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
    this.router.put('/update', this.controller.updateAttendance.bind(this.controller));
    
    /**
     * @swagger
     * /attendance/restore:
     *   post:
     *     summary: Restore a deleted attendance record
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
     *         description: Attendance restored successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/restore', this.controller.restoreAttendance.bind(this.controller));
    
    /**
     * @swagger
     * /attendance/delete:
     *   post:
     *     summary: Delete an attendance record (soft delete)
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
     *         description: Attendance deleted successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/delete', this.controller.deleteAttendance.bind(this.controller));
    
    /**
     * @swagger
     * /attendance/search:
     *   post:
     *     summary: Search attendances
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
    this.router.post('/search', this.controller.searchAttendances.bind(this.controller));
    
    /**
     * @swagger
     * /attendance/face-attendance:
     *   post:
     *     summary: Mark attendance using face recognition
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
     *               - image
     *             properties:
     *               image:
     *                 type: string
     *                 format: base64
     *                 description: Base64 encoded image
     *     responses:
     *       200:
     *         description: Face attendance processed successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/face-attendance', this.controller.faceAttendance.bind(this.controller));
    
    /**
     * @swagger
     * /attendance/specific:
     *   post:
     *     summary: Get attendances by specific type
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
     *               - type
     *             properties:
     *               type:
     *                 type: string
     *                 enum: [present, absent, late, half_day]
     *                 example: present
     *               employeeId:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *     responses:
     *       200:
     *         description: Attendances retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/specific', this.controller.getSpecificTypeAttendances.bind(this.controller));
    
    /**
     * @swagger
     * /attendance/excel:
     *   post:
     *     summary: Download attendance data as Excel
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
     *               employeeId:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *               from:
     *                 type: string
     *                 format: date
     *                 example: "2024-01-01"
     *               to:
     *                 type: string
     *                 format: date
     *                 example: "2024-12-31"
     *     responses:
     *       200:
     *         description: Excel file generated successfully
     *         content:
     *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
     *             schema:
     *               type: string
     *               format: binary
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/excel',this.controller.downloadExcelAttendance.bind(this.controller));
    
    /**
     * @swagger
     * /attendance/pdf:
     *   post:
     *     summary: Generate attendance PDF
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
     *               employeeId:
     *                 type: string
     *               from:
     *                 type: string
     *                 format: date
     *               to:
     *                 type: string
     *                 format: date
     *     responses:
     *       200:
     *         description: PDF generated successfully
     *         content:
     *           application/pdf:
     *             schema:
     *               type: string
     *               format: binary
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/pdf',this.controller.attendancePdf.bind(this.controller));
    
    /**
     * @swagger
     * /attendance/import:
     *   post:
     *     summary: Import attendance from Excel file
     *     tags: [Attendance]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         multipart/form-data:
     *           schema:
     *             type: object
     *             required:
     *               - file
     *               - employeeId
     *               - month
     *             properties:
     *               file:
     *                 type: string
     *                 format: binary
     *                 description: Excel file with attendance data
     *               employeeId:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *               month:
     *                 type: string
     *                 example: "2024-01"
     *     responses:
     *       200:
     *         description: Attendance imported successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         description: Invalid file or missing required fields
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/import', upload.single('file'), this.controller.importAttendance.bind(this.controller));
    
    /**
     * @swagger
     * /attendance/history:
     *   post:
     *     summary: Get attendance update history by ID
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
     *                 description: Attendance ID
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *               filter:
     *                 type: boolean
     *                 description: If true, filter results. If false, return all history
     *                 example: false
     *               date:
     *                 type: string
     *                 format: date
     *                 description: Specific date to filter history (required if filter is true)
     *                 example: "2024-01-15"
     *     responses:
     *       200:
     *         description: Attendance history retrieved successfully
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
     *                   example: "Attendance history retrieved successfully!"
     *                 data:
     *                   type: array
     *                   items:
     *                     type: object
     *                     properties:
     *                       data:
     *                         type: object
     *                         properties:
     *                           status:
     *                             type: string
     *                           checkIn:
     *                             type: string
     *                             format: date-time
     *                           checkOut:
     *                             type: string
     *                             format: date-time
     *                           comment:
     *                             type: string
     *                           location:
     *                             type: string
     *                           date:
     *                             type: string
     *                             format: date-time
     *                       updatedBy:
     *                         type: string
     *                         nullable: true
     *                       updatedByName:
     *                         type: string
     *                         nullable: true
     *                         description: Username of the person who updated (shows "Admin" for admin user)
     *                       updatedAt:
     *                         type: string
     *                         format: date-time
     *       400:
     *         description: Bad request - Attendance ID is required
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/history', this.controller.getHistoryById.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default AttendanceRoutes;