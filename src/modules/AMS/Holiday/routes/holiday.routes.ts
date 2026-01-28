import { Router } from "express";
import HolidayController from "../controllers/holiday.controller";

class HolidayRoutes {
  private router: Router;
  private controller: HolidayController;

  constructor() {
    this.router = Router();
    this.controller = new HolidayController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    /**
     * @swagger
     * /holiday/getAll:
     *   get:
     *     summary: Get all holidays
     *     tags: [Holidays]
     *     security:
     *       - bearerAuth: []
     *     description: Retrieves all active holidays
     *     responses:
     *       200:
     *         description: Holidays retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/getAll', this.controller.getAllHolidays.bind(this.controller));

    /**
     * @swagger
     * /holiday/get:
     *   get:
     *     summary: Get holidays with pagination
     *     tags: [Holidays]
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
     *         description: Holidays retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/get', this.controller.getHolidays.bind(this.controller));

    /**
     * @swagger
     * /holiday/getById:
     *   get:
     *     summary: Get holiday by ID
     *     tags: [Holidays]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Holiday ID
     *     responses:
     *       200:
     *         description: Holiday retrieved successfully
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
    this.router.get('/getById', this.controller.getHolidayById.bind(this.controller));

    /**
     * @swagger
     * /holiday/deleted:
     *   get:
     *     summary: Get deleted holidays
     *     tags: [Holidays]
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
     *         description: Deleted holidays retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/deleted', this.controller.getDeletedHolidays.bind(this.controller));

    /**
     * @swagger
     * /holiday/total:
     *   get:
     *     summary: Get total holidays count
     *     tags: [Holidays]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Total holidays count retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/total', this.controller.getTotalHolidays.bind(this.controller));

    /**
     * @swagger
     * /holiday/create:
     *   post:
     *     summary: Create a new holiday
     *     tags: [Holidays]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - date
     *             properties:
     *               date:
     *                 type: string
     *                 format: date
     *                 example: "2024-12-25"
     *               reason:
     *                 type: string
     *                 example: "Christmas"
     *               description:
     *                 type: string
     *                 example: "Christmas Day holiday"
     *               isActive:
     *                 type: boolean
     *                 default: true
     *               createdByUserId:
     *                 type: string
     *                 description: User ID who created the holiday
     *     responses:
     *       200:
     *         description: Holiday created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/create', this.controller.createHoliday.bind(this.controller));

    /**
     * @swagger
     * /holiday/update:
     *   put:
     *     summary: Update a holiday
     *     tags: [Holidays]
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
     *               date:
     *                 type: string
     *                 format: date
     *                 example: "2024-12-25"
     *               reason:
     *                 type: string
     *                 example: "Christmas"
     *               description:
     *                 type: string
     *                 example: "Christmas Day holiday"
     *               isActive:
     *                 type: boolean
     *               updatedByUserId:
     *                 type: string
     *                 description: User ID who updated the holiday
     *     responses:
     *       200:
     *         description: Holiday updated successfully
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
    this.router.put('/update', this.controller.updateHoliday.bind(this.controller));

    /**
     * @swagger
     * /holiday/delete:
     *   post:
     *     summary: Delete a holiday (soft delete)
     *     tags: [Holidays]
     *     security:
     *       - bearerAuth: []
     *     description: Soft deletes a holiday and removes holiday attendance records for all employees
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
     *         description: Holiday deleted successfully
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
    this.router.post('/delete', this.controller.deleteHoliday.bind(this.controller));

    /**
     * @swagger
     * /holiday/restore:
     *   post:
     *     summary: Restore a deleted holiday
     *     tags: [Holidays]
     *     security:
     *       - bearerAuth: []
     *     description: Restores a soft-deleted holiday and marks attendance as HOLIDAYS for all employees
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
     *         description: Holiday restored successfully
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
    this.router.post('/restore', this.controller.restoreHoliday.bind(this.controller));

    /**
     * @swagger
     * /holiday/search:
     *   post:
     *     summary: Search holidays
     *     tags: [Holidays]
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
     *                 example: "Christmas"
     *               page:
     *                 type: integer
     *                 default: 1
     *               pageSize:
     *                 type: integer
     *                 default: 10
     *     responses:
     *       200:
     *         description: Holidays search completed successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/search', this.controller.searchHolidays.bind(this.controller));

    /**
     * @swagger
     * /holiday/markSundays:
     *   post:
     *     summary: Mark all Sundays of a year as holidays
     *     tags: [Holidays]
     *     security:
     *       - bearerAuth: []
     *     description: Automatically creates holidays for all Sundays in the specified year and marks attendance as HOLIDAYS for all employees
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - year
     *             properties:
     *               year:
     *                 type: integer
     *                 example: 2024
     *                 description: Year for which to mark Sundays as holidays
     *               createdByUserId:
     *                 type: string
     *                 description: User ID who created the holidays
     *     responses:
     *       200:
     *         description: Sundays marked as holidays successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/markSundays', this.controller.markSundaysForYear.bind(this.controller));

    /**
     * @swagger
     * /holiday/getHistoryById:
     *   post:
     *     summary: Get holiday update history
     *     tags: [Holidays]
     *     security:
     *       - bearerAuth: []
     *     description: Retrieves the update history for a holiday with audit trail information
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
     *         description: Holiday history retrieved successfully
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

export default HolidayRoutes;
