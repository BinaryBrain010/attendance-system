import { Router } from "express";
import UnitController from "../controllers/unit.controller";

class UnitRoutes {
  private router: Router;
  private controller: UnitController;

  constructor() {
    this.router = Router();
    this.controller = new UnitController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    /**
     * @swagger
     * /unit/getAll:
     *   get:
     *     summary: Get all units
     *     tags: [Units]
     *     security:
     *       - bearerAuth: []
     *     description: Retrieves all active units
     *     responses:
     *       200:
     *         description: Units retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/getAll', this.controller.getAllUnits.bind(this.controller));

    /**
     * @swagger
     * /unit/get:
     *   get:
     *     summary: Get units with pagination
     *     tags: [Units]
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
     *     responses:
     *       200:
     *         description: Units retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/get', this.controller.getUnits.bind(this.controller));

    /**
     * @swagger
     * /unit/getById:
     *   get:
     *     summary: Get unit by ID
     *     tags: [Units]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Unit ID
     *     responses:
     *       200:
     *         description: Unit retrieved successfully
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
    this.router.get('/getById', this.controller.getUnitById.bind(this.controller));

    /**
     * @swagger
     * /unit/deleted:
     *   get:
     *     summary: Get deleted units
     *     tags: [Units]
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
     *     responses:
     *       200:
     *         description: Deleted units retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/deleted', this.controller.getDeletedUnits.bind(this.controller));

    /**
     * @swagger
     * /unit/total:
     *   get:
     *     summary: Get total units count
     *     tags: [Units]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Total units count retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/total', this.controller.getTotalUnits.bind(this.controller));

    /**
     * @swagger
     * /unit/create:
     *   post:
     *     summary: Create a new unit
     *     tags: [Units]
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
     *               - type
     *             properties:
     *               name:
     *                 type: string
     *                 example: "Karachi Branch"
     *               type:
     *                 type: string
     *                 enum: [SERVICE_CENTER, BRANCH, OUTLET, DEPARTMENT, STORE, WAREHOUSE, OFFICE, FACTORY, OTHER]
     *                 example: "BRANCH"
     *               description:
     *                 type: string
     *                 example: "Main branch in Karachi"
     *               address:
     *                 type: string
     *                 example: "123 Main Street, Karachi"
     *               contactNo:
     *                 type: string
     *                 example: "+92-300-1234567"
     *               email:
     *                 type: string
     *                 example: "karachi@company.com"
     *               attendanceManagerId:
     *                 type: string
     *                 description: Employee ID who manages attendance for this unit
     *               createdByUserId:
     *                 type: string
     *                 description: User ID who created the unit
     *     responses:
     *       200:
     *         description: Unit created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/create', this.controller.createUnit.bind(this.controller));

    /**
     * @swagger
     * /unit/update:
     *   put:
     *     summary: Update a unit
     *     tags: [Units]
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
     *               name:
     *                 type: string
     *               type:
     *                 type: string
     *                 enum: [SERVICE_CENTER, BRANCH, OUTLET, DEPARTMENT, STORE, WAREHOUSE, OFFICE, FACTORY, OTHER]
     *               description:
     *                 type: string
     *               address:
     *                 type: string
     *               contactNo:
     *                 type: string
     *               email:
     *                 type: string
     *               attendanceManagerId:
     *                 type: string
     *               updatedByUserId:
     *                 type: string
     *                 description: User ID who updated the unit
     *     responses:
     *       200:
     *         description: Unit updated successfully
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
    this.router.put('/update', this.controller.updateUnit.bind(this.controller));

    /**
     * @swagger
     * /unit/delete:
     *   post:
     *     summary: Delete a unit (soft delete)
     *     tags: [Units]
     *     security:
     *       - bearerAuth: []
     *     description: Soft deletes a unit
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
     *         description: Unit deleted successfully
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
    this.router.post('/delete', this.controller.deleteUnit.bind(this.controller));

    /**
     * @swagger
     * /unit/restore:
     *   post:
     *     summary: Restore a deleted unit
     *     tags: [Units]
     *     security:
     *       - bearerAuth: []
     *     description: Restores a soft-deleted unit
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
     *         description: Unit restored successfully
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
    this.router.post('/restore', this.controller.restoreUnit.bind(this.controller));

    /**
     * @swagger
     * /unit/search:
     *   post:
     *     summary: Search units
     *     tags: [Units]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - searchTerm
     *             properties:
     *               searchTerm:
     *                 type: string
     *                 example: "Karachi"
     *               page:
     *                 type: integer
     *                 default: 1
     *               pageSize:
     *                 type: integer
     *                 default: 10
     *     responses:
     *       200:
     *         description: Units search completed successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/search', this.controller.searchUnits.bind(this.controller));

    /**
     * @swagger
     * /unit/getHistoryById:
     *   post:
     *     summary: Get unit update history
     *     tags: [Units]
     *     security:
     *       - bearerAuth: []
     *     description: Retrieves the update history for a unit with audit trail information
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
     *         description: Unit history retrieved successfully
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
     * /unit/getAttendanceAndStats:
     *   post:
     *     summary: Get attendance data and statistics for a unit
     *     tags: [Units]
     *     security:
     *       - bearerAuth: []
     *     description: Retrieves attendance records and statistics for all employees in a unit with optional filters
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
     *                 description: Unit ID to get attendance for
     *                 example: "88b7e906-86e7-437d-9c69-6255082380f7"
     *               from:
     *                 type: string
     *                 format: date
     *                 description: "Start date for filtering (default: start of current month)"
     *                 example: "2026-01-01"
     *               to:
     *                 type: string
     *                 format: date
     *                 description: "End date for filtering (default: today)"
     *                 example: "2026-01-31"
     *               status:
     *                 type: string
     *                 enum: [PRESENT, ABSENT, ON_LEAVE, LATE, HALF_DAY]
     *                 description: Filter by attendance status (optional)
     *                 example: "PRESENT"
     *               employeeId:
     *                 type: string
     *                 description: Filter by specific employee ID (optional)
     *                 example: "employee-uuid"
     *               page:
     *                 type: integer
     *                 default: 1
     *                 description: Page number for pagination
     *                 example: 1
     *               pageSize:
     *                 type: integer
     *                 default: 10
     *                 description: Number of records per page
     *                 example: 10
     *     responses:
     *       200:
     *         description: Unit attendance and stats retrieved successfully
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
     *                   example: "Unit attendance and stats retrieved successfully!"
     *                 data:
     *                   type: object
     *                   properties:
     *                     attendance:
     *                       type: object
     *                       properties:
     *                         data:
     *                           type: array
     *                           items:
     *                             type: object
     *                             properties:
     *                               id:
     *                                 type: string
     *                               employeeId:
     *                                 type: string
     *                               employeeCode:
     *                                 type: string
     *                               employeeName:
     *                                 type: string
     *                               employeeSurname:
     *                                 type: string
     *                               designation:
     *                                 type: string
     *                               department:
     *                                 type: string
     *                               date:
     *                                 type: string
     *                                 format: date
     *                               status:
     *                                 type: string
     *                                 enum: [PRESENT, ABSENT, ON_LEAVE, LATE, HALF_DAY]
     *                               checkIn:
     *                                 type: string
     *                                 format: date-time
     *                               checkOut:
     *                                 type: string
     *                                 format: date-time
     *                               comment:
     *                                 type: string
     *                               location:
     *                                 type: string
     *                         totalSize:
     *                           type: integer
     *                           example: 150
     *                         page:
     *                           type: integer
     *                           example: 1
     *                         pageSize:
     *                           type: integer
     *                           example: 10
     *                     stats:
     *                       type: object
     *                       properties:
     *                         totalEmployees:
     *                           type: integer
     *                           description: Total number of employees in the unit
     *                           example: 25
     *                         totalAttendance:
     *                           type: integer
     *                           description: Total attendance records in the date range
     *                           example: 500
     *                         byStatus:
     *                           type: object
     *                           properties:
     *                             PRESENT:
     *                               type: integer
     *                               example: 350
     *                             ABSENT:
     *                               type: integer
     *                               example: 50
     *                             ON_LEAVE:
     *                               type: integer
     *                               example: 80
     *                             LATE:
     *                               type: integer
     *                               example: 15
     *                             HALF_DAY:
     *                               type: integer
     *                               example: 5
     *                         dateRange:
     *                           type: object
     *                           properties:
     *                             from:
     *                               type: string
     *                               format: date-time
     *                             to:
     *                               type: string
     *                               format: date-time
     *       400:
     *         description: Bad request - Unit ID is required
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/getAttendanceAndStats', this.controller.getUnitAttendanceAndStats.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default UnitRoutes;
