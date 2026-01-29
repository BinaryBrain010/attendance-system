import express, { Router, Request, Response, NextFunction } from 'express';
import EmployeeController from '../controllers/employee.controller';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from "uuid";
import logger from '../../../../core/logger/logger'; 

class EmployeeRoutes {
  private router: Router;
  private controller: EmployeeController;
  private storage = multer.diskStorage({
    destination: function (req, file, cb) {
      const employeeId = req.body.employeeId || req.query.employeeId;
      const employeeName = req.body.employeeName || req.query.employeeName;
    
      if (!employeeId || !employeeName) {
        return cb(new Error("Employee ID and Name are required"), "");
      }
    
      const employeeFolder = `${employeeId.slice(-4)}-${employeeName.replace(/ /g, "_")}`;
      const uploadPath = path.join(
        __dirname,
        "..",
        "..",
        "..",
        "..",
        "assets",
        "uploads",
        employeeFolder
      );
    
      require("fs").mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    }
,    
    filename: function (req, file, cb) {
      // Generate a unique filename using UUID
      const uniqueFilename = `${uuidv4()}-${file.originalname}`;
      cb(null, uniqueFilename);
    },
  });

  private upload = multer({ storage: this.storage });

  /**
   * Wrapper for multer middleware that handles errors gracefully
   * Prevents "Boundary not found" errors when non-multipart requests hit multer-protected routes
   */
  private handleMulter(multerMiddlewareFactory: () => any) {
    return (req: Request, res: Response, next: NextFunction) => {
      const contentType = req.headers['content-type'] || '';
      const contentTypeLower = contentType.toLowerCase();
      const isMultipart = contentTypeLower.includes('multipart/form-data');
      
      // Log detailed information about the request for debugging
      if (isMultipart) {
        // More robust boundary check - look for boundary= or boundary = (with optional spaces)
        const boundaryMatch = contentType.match(/boundary\s*=\s*([^;,\s]+)/i);
        let hasBoundary = !!boundaryMatch;
        let boundaryValue = boundaryMatch ? boundaryMatch[1] : null;
        
        logger.info('Multipart request detected', {
          path: req.path,
          method: req.method,
          contentType: contentType,
          contentTypeLength: contentType.length,
          hasBoundary: hasBoundary,
          boundaryValue: boundaryValue,
          allHeaders: JSON.stringify(req.headers)
        });
        
        // CRITICAL: Check if boundary parameter exists before passing to multer
        // Multer/busboy requires boundary to parse multipart data
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
      }
      
      // If not multipart at all, skip multer and let bodyParser handle it
      if (!isMultipart) {
        logger.warn(`Multer middleware skipped: Content-Type is not multipart/form-data. Received: ${contentType}`, {
          path: req.path,
          method: req.method
        });
        // Initialize req.files as empty object to prevent errors in route handlers
        (req as any).files = {};
        return next();
      }
      
      // For multipart requests with valid boundary, let multer parse it
      const multerMiddleware = multerMiddlewareFactory();
      
      // Apply multer middleware for multipart requests with comprehensive error handling
      const errorHandler = (err: any) => {
        if (err) {
          const errorMessage = err.message || err.toString() || '';
          if (errorMessage.includes('Boundary not found') || errorMessage.includes('Multipart: Boundary not found')) {
            logger.error('Multer error: Boundary not found - Detailed diagnostics', {
              path: req.path,
              method: req.method,
              contentType: req.headers['content-type'],
              contentTypeRaw: contentType,
              contentTypeBytes: contentType.split('').map(c => `${c}(${c.charCodeAt(0)})`).join(' '),
              error: errorMessage,
              userAgent: req.headers['user-agent'],
              contentLength: req.headers['content-length']
            });
            // Don't send response if already sent
            if (!res.headersSent) {
              return res.status(400).json({
                success: false,
                message: 'Invalid request: multipart/form-data Content-Type is missing or has invalid boundary parameter. The Content-Type header must include a boundary parameter. Common causes: 1) Manually setting Content-Type without boundary, 2) Using a library that doesn\'t set boundary automatically. Solution: Use FormData API (browser) or form-data library (Node.js) which automatically sets the boundary, or ensure your Content-Type includes: boundary=----WebKitFormBoundary...',
                statusCode: 400,
                receivedContentType: contentType
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
          logger.error('Multer synchronous error: Boundary not found - Detailed diagnostics', {
            path: req.path,
            method: req.method,
            contentType: req.headers['content-type'],
            contentTypeRaw: contentType,
            contentTypeBytes: contentType.split('').map(c => `${c}(${c.charCodeAt(0)})`).join(' '),
            error: errorMessage,
            userAgent: req.headers['user-agent'],
            contentLength: req.headers['content-length']
          });
          if (!res.headersSent) {
            return res.status(400).json({
              success: false,
              message: 'Invalid request: multipart/form-data Content-Type is missing or has invalid boundary parameter. The Content-Type header must include a boundary parameter. Common causes: 1) Manually setting Content-Type without boundary, 2) Using a library that doesn\'t set boundary automatically. Solution: Use FormData API (browser) or form-data library (Node.js) which automatically sets the boundary, or ensure your Content-Type includes: boundary=----WebKitFormBoundary...',
              statusCode: 400,
              receivedContentType: contentType
            });
          }
          return;
        }
        return next(error);
      }
    };
  }

  constructor() {
    this.router = express.Router();
    this.controller = new EmployeeController();
    this.initializeRoutes();
  }


  private initializeRoutes(): void {
    /**
     * @swagger
     * /employee/get:
     *   get:
     *     summary: Get all employees with pagination, sorting, and filtering
     *     tags: [Employees]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *           default: 1
     *         description: Page number for pagination
     *       - in: query
     *         name: pageSize
     *         schema:
     *           type: integer
     *           default: 10
     *         description: Number of items per page
     *       - in: query
     *         name: sortBy
     *         schema:
     *           type: string
     *           enum: [name, surname, code, designation, department, createdAt, updatedAt, joiningDate]
     *           default: createdAt
     *         description: Field to sort by
     *       - in: query
     *         name: sortOrder
     *         schema:
     *           type: string
     *           enum: [asc, desc]
     *           default: desc
     *         description: Sort order (ascending or descending)
     *       - in: query
     *         name: filter
     *         schema:
     *           type: string
     *         description: Optional filter parameter. If set to "true", returns only id, code, and name fields. Otherwise, filters by status (e.g., "RESIGNED", "ACTIVE")
     *       - in: query
     *         name: search
     *         schema:
     *           type: string
     *         description: Optional search term to filter by name, surname, code, designation, or department
     *       - in: query
     *         name: from
     *         schema:
     *           type: string
     *           format: date
     *         description: "Start date for date range filter (format: YYYY-MM-DD). Filters by joiningDate, createdAt, or updatedAt based on dateField parameter"
     *       - in: query
     *         name: to
     *         schema:
     *           type: string
     *           format: date
     *         description: "End date for date range filter (format: YYYY-MM-DD). Filters by joiningDate, createdAt, or updatedAt based on dateField parameter"
     *       - in: query
     *         name: dateField
     *         schema:
     *           type: string
     *           enum: [joiningDate, createdAt, updatedAt]
     *           default: joiningDate
     *         description: Date field to filter by when using from/to parameters
     *     responses:
     *       200:
     *         description: Employees retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PaginatedResponse'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/get', this.controller.getAllEmployees.bind(this.controller));
    
    /**
     * @swagger
     * /employee/getFaceRecognitionData:
     *   get:
     *     summary: Get employees data for face recognition
     *     tags: [Employees]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Face recognition data retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/getFaceRecognitionData', this.controller.getEmployeesForFaceRecognition.bind(this.controller));
    
    /**
     * @swagger
     * /employee/get:
     *   post:
     *     summary: Get paginated employees
     *     tags: [Employees]
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
     *         description: Employees retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PaginatedResponse'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/get', this.controller.getEmployees.bind(this.controller));
    
    /**
     * @swagger
     * /employee/getDeleted:
     *   post:
     *     summary: Get deleted employees
     *     tags: [Employees]
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
     *         description: Deleted employees retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PaginatedResponse'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/getDeleted', this.controller.getDeletedEmployees.bind(this.controller));
    
    /**
     * @swagger
     * /employee/total:
     *   get:
     *     summary: Get total employees count
     *     tags: [Employees]
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
    this.router.get('/total', this.controller.getTotalEmployees.bind(this.controller));
    
    /**
     * @swagger
     * /employee/create:
     *   post:
     *     summary: Create a new employee
     *     tags: [Employees]
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
     *               - code
     *             properties:
     *               name:
     *                 type: string
     *                 example: "John Doe"
     *               code:
     *                 type: string
     *                 example: "EMP001"
     *               email:
     *                 type: string
     *                 format: email
     *               phone:
     *                 type: string
     *     responses:
     *       201:
     *         description: Employee created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/create', this.controller.createEmployee.bind(this.controller));
    
    /**
     * @swagger
     * /employee/update:
     *   put:
     *     summary: Update an employee
     *     tags: [Employees]
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
     *         description: Employee updated successfully
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
    this.router.put('/update', this.controller.updateEmployee.bind(this.controller));
    
    /**
     * @swagger
     * /employee/search:
     *   post:
     *     summary: Search employees
     *     tags: [Employees]
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
    this.router.post('/search', this.controller.searchEmployees.bind(this.controller));
    
    /**
     * @swagger
     * /employee/delete:
     *   post:
     *     summary: Delete an employee (soft delete)
     *     tags: [Employees]
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
     *         description: Employee deleted successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/delete', this.controller.deleteEmployee.bind(this.controller));
    
    /**
     * @swagger
     * /employee/getById:
     *   post:
     *     summary: Get employee by ID
     *     tags: [Employees]
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
     *         description: Employee retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/getById', this.controller.getEmployeeById.bind(this.controller));
    
    /**
     * @swagger
     * /employee/getByCode:
     *   post:
     *     summary: Get employee by code
     *     tags: [Employees]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - code
     *             properties:
     *               code:
     *                 type: string
     *                 example: "EMP001"
     *     responses:
     *       200:
     *         description: Employee retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/getByCode', this.controller.getEmployeeByCode.bind(this.controller));
    
    /**
     * @swagger
     * /employee/getLinkedUser:
     *   post:
     *     summary: Get employee's linked user account
     *     tags: [Employees]
     *     security:
     *       - bearerAuth: []
     *     description: Retrieves the user account linked to the specified employee. Requires 'employee.user.read.*' permission.
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
     *                 description: Employee ID
     *     responses:
     *       200:
     *         description: Employee linked user retrieved successfully
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
     *                     id:
     *                       type: string
     *                       description: User ID
     *                     username:
     *                       type: string
     *                       description: Username
     *                     createdAt:
     *                       type: string
     *                       format: date-time
     *                     updatedAt:
     *                       type: string
     *                       format: date-time
     *       400:
     *         description: Bad request - Employee ID is required
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         description: Employee or linked user not found
     */
    this.router.post('/getLinkedUser', this.controller.getEmployeeLinkedUser.bind(this.controller));
    
    /**
     * @swagger
     * /employee/restore:
     *   post:
     *     summary: Restore a deleted employee
     *     tags: [Employees]
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
     *         description: Employee restored successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/restore', this.controller.restoreEmployee.bind(this.controller));
    
    /**
     * @swagger
     * /employee/updateFile:
     *   post:
     *     summary: Update employee files
     *     tags: [Employees]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         multipart/form-data:
     *           schema:
     *             type: object
     *             required:
     *               - employeeId
     *             properties:
     *               employeeId:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *               employeeName:
     *                 type: string
     *                 example: "John Doe"
     *               files:
     *                 type: array
     *                 items:
     *                   type: string
     *                   format: binary
     *     responses:
     *       200:
     *         description: Files updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/updateFile', this.handleMulter(() => this.upload.fields([
      { name: 'employeeId', maxCount: 1 },
      { name: 'employeeName', maxCount: 1 },
      { name: 'files' },
    ])), this.controller.updateFiles.bind(this.controller));
    
    /**
     * @swagger
     * /employee/getCard:
     *   post:
     *     summary: Get employee card
     *     tags: [Employees]
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
     *         description: Employee card retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/getCard',this.controller.getEmployeeCard.bind(this.controller));
    
    /**
     * @swagger
     * /employee/getExcel:
     *   get:
     *     summary: Download employees as Excel
     *     tags: [Employees]
     *     security:
     *       - bearerAuth: []
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
    this.router.get('/getExcel',this.controller.getEmployeeExcel.bind(this.controller));
    
    /**
     * @swagger
     * /employee/getByUserId:
     *   post:
     *     summary: Get employee by user ID
     *     tags: [Employees]
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
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *     responses:
     *       200:
     *         description: Employee retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/getByUserId',this.controller.getEmployeeByUserId.bind(this.controller));
    
    /**
     * @swagger
     * /employee/files:
     *   post:
     *     summary: Get employee files
     *     tags: [Employees]
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
     *         description: Files retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/files',this.controller.getFiles.bind(this.controller));
    
    /**
     * @swagger
     * /employee/filesDel:
     *   post:
     *     summary: Delete employee files
     *     tags: [Employees]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - fileIds
     *             properties:
     *               fileIds:
     *                 type: array
     *                 items:
     *                   type: string
     *                 example: ["123e4567-e89b-12d3-a456-426614174000"]
     *     responses:
     *       200:
     *         description: Files deleted successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/filesDel',this.controller.deleteFiles.bind(this.controller));
    
    /**
     * @swagger
     * /employee/getHistoryById:
     *   post:
     *     summary: Get employee update history by ID
     *     tags: [Employees]
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
     *               filter:
     *                 type: boolean
     *                 description: If true, returns array of dates. If false, returns complete previousUpdates array.
     *                 example: true
     *               date:
     *                 type: string
     *                 format: date
     *                 description: Optional. If filter is true and date is provided, returns record for that specific date.
     *                 example: "2024-01-15"
     *     responses:
     *       200:
     *         description: Employee history retrieved successfully
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
    this.router.post('/getHistoryById', this.controller.getHistoryById.bind(this.controller));
    
    /**
     * @swagger
     * /employee/stats:
     *   post:
     *     summary: Get comprehensive statistics for an employee
     *     tags: [Employees]
     *     security:
     *       - bearerAuth: []
     *     description: Returns detailed statistics including attendance, leave requests, and leave allocations with trends for visualization
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
     *                 description: Employee ID
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *               from:
     *                 type: string
     *                 format: date
     *                 description: Optional start date for statistics (defaults to start of current month)
     *                 example: "2024-01-01"
     *               to:
     *                 type: string
     *                 format: date
     *                 description: Optional end date for statistics (defaults to end of current month)
     *                 example: "2024-12-31"
     *     responses:
     *       200:
     *         description: Employee statistics retrieved successfully
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
     *                     employee:
     *                       type: object
     *                     attendance:
     *                       type: object
     *                     leaveRequests:
     *                       type: object
     *                     leaveAllocations:
     *                       type: object
     *                     leaveTrends:
     *                       type: object
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/stats', this.controller.getEmployeeStats.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default EmployeeRoutes;
