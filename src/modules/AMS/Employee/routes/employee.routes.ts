import express, { Router } from 'express';
import EmployeeController from '../controllers/employee.controller';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from "uuid"; 

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
     *     summary: Get all employees
     *     tags: [Employees]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: filter
     *         schema:
     *           type: string
     *         description: Optional filter parameter
     *     responses:
     *       200:
     *         description: Employees retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
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
    this.router.post('/updateFile',   this.upload.fields([
      { name: 'employeeId', maxCount: 1 },
      { name: 'employeeName', maxCount: 1 },
      { name: 'files' },
    ]), this.controller.updateFiles.bind(this.controller));
    
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
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default EmployeeRoutes;
