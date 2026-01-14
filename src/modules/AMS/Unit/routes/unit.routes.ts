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
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default UnitRoutes;
