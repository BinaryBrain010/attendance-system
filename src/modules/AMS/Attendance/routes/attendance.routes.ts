import express, { Router, Request, Response, NextFunction } from 'express';
import AttendanceController from '../controllers/attendance.controller';
import multer from 'multer';
import logger from '../../../../core/logger/logger';

// Configure multer to store files in memory as Buffers
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Wrapper for multer middleware that handles errors gracefully
 * Prevents "Boundary not found" errors when non-multipart requests hit multer-protected routes
 */
function handleMulter(multerMiddlewareFactory: () => any) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentType = req.headers['content-type'] || '';
    const contentTypeLower = contentType.toLowerCase();
    const isMultipart = contentTypeLower.includes('multipart/form-data');
    
    // If not multipart at all, skip multer and let bodyParser handle it
    if (!isMultipart) {
      logger.warn(`Multer middleware skipped: Content-Type is not multipart/form-data. Received: ${contentType}`, {
        path: req.path,
        method: req.method
      });
      // Initialize req.file as undefined to prevent errors in route handlers
      (req as any).file = undefined;
      return next();
    }
    
    // CRITICAL: Check if boundary parameter exists before passing to multer
    // Multer/busboy requires boundary to parse multipart data
    // More robust boundary check - look for boundary= or boundary = (with optional spaces)
    const boundaryMatch = contentType.match(/boundary\s*=\s*([^;,\s]+)/i);
    const hasBoundary = !!boundaryMatch;
    
    if (!hasBoundary) {
      logger.error('Multipart request missing boundary parameter', {
        path: req.path,
        method: req.method,
        contentType: contentType,
        allHeaders: JSON.stringify(req.headers),
        userAgent: req.headers['user-agent']
      });
      return res.status(400).json({
        success: false,
        message: 'Invalid request: multipart/form-data Content-Type is missing the required boundary parameter.',
        statusCode: 400,
        receivedContentType: contentType,
        solution: {
          description: 'The Content-Type header must include a boundary parameter. This happens when you manually set the Content-Type header.',
          correctUsage: {
            browser: 'const formData = new FormData(); formData.append("files", file); fetch(url, { method: "POST", body: formData }); // DO NOT set Content-Type header manually!',
            nodejs: 'const FormData = require("form-data"); const form = new FormData(); form.append("files", file); // FormData automatically sets Content-Type with boundary',
            axios: 'const formData = new FormData(); formData.append("files", file); axios.post(url, formData); // DO NOT set headers: { "Content-Type": "multipart/form-data" }'
          },
          commonMistake: 'Manually setting Content-Type header without boundary: headers: { "Content-Type": "multipart/form-data" }',
          fix: 'Remove the Content-Type header from your request. Let FormData/form-data library set it automatically.'
        }
      });
    }
    
    // For multipart requests with valid boundary, let multer parse it
    const multerMiddleware = multerMiddlewareFactory();
    
    // Apply multer middleware for multipart requests with comprehensive error handling
    const errorHandler = (err: any) => {
      if (err) {
        const errorMessage = err.message || err.toString() || '';
        if (errorMessage.includes('Boundary not found') || errorMessage.includes('Multipart: Boundary not found')) {
          logger.error('Multer error: Boundary not found', {
            path: req.path,
            method: req.method,
            contentType: req.headers['content-type'],
            error: errorMessage
          });
          // Don't send response if already sent
          if (!res.headersSent) {
            return res.status(400).json({
              success: false,
              message: 'Invalid request: multipart/form-data Content-Type is missing or has invalid boundary parameter. Please ensure your request includes a proper Content-Type header with boundary (e.g., Content-Type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW)',
              statusCode: 400
            });
          }
          return;
        }
        return next(err);
      }
      next();
    };
    
    // Wrap in try-catch to handle any synchronous errors
    try {
      multerMiddleware(req, res, errorHandler);
    } catch (error: any) {
      // Catch synchronous errors from multer/busboy
      const errorMessage = error?.message || error?.toString() || '';
      if (errorMessage.includes('Boundary not found') || errorMessage.includes('Multipart: Boundary not found')) {
        logger.error('Multer synchronous error: Boundary not found', {
          path: req.path,
          method: req.method,
          contentType: req.headers['content-type'],
          error: errorMessage
        });
        if (!res.headersSent) {
          return res.status(400).json({
            success: false,
            message: 'Invalid request: multipart/form-data Content-Type is missing or has invalid boundary parameter. Please ensure your request includes a proper Content-Type header with boundary (e.g., Content-Type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW)',
            statusCode: 400
          });
        }
        return;
      }
      return next(error);
    }
  };
}

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
     *               checkIn:
     *                 type: string
     *                 format: time
     *               checkOut:
     *                 type: string
     *                 format: time
     *               status:
     *                 type: string
     *                 enum: [present, absent, late, half_day]
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
    this.router.post('/import', handleMulter(() => upload.single('file')), this.controller.importAttendance.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default AttendanceRoutes;