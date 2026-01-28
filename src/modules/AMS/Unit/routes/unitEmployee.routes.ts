import { Router } from "express";
import UnitEmployeeController from "../controllers/unitEmployee.controller";

class UnitEmployeeRoutes {
  private router: Router;
  private controller: UnitEmployeeController;

  constructor() {
    this.router = Router();
    this.controller = new UnitEmployeeController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    /**
     * @swagger
     * /unitEmployee/getEmployeesByUnitId:
     *   post:
     *     summary: Get employees by unit ID
     *     tags: [Unit Employees]
     *     security:
     *       - bearerAuth: []
     *     description: Retrieves all employees assigned to a specific unit
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
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *                 description: Unit ID
     *     responses:
     *       200:
     *         description: Employees retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/getEmployeesByUnitId', this.controller.getEmployeesByUnitId.bind(this.controller));

    /**
     * @swagger
     * /unitEmployee/getUnitsByEmployeeId:
     *   post:
     *     summary: Get units by employee ID
     *     tags: [Unit Employees]
     *     security:
     *       - bearerAuth: []
     *     description: Retrieves all units assigned to a specific employee
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
     *                 description: Employee ID
     *     responses:
     *       200:
     *         description: Units retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/getUnitsByEmployeeId', this.controller.getUnitsByEmployeeId.bind(this.controller));

    /**
     * @swagger
     * /unitEmployee/assignEmployeesToUnit:
     *   post:
     *     summary: Assign employees to unit (bulk assignment)
     *     tags: [Unit Employees]
     *     security:
     *       - bearerAuth: []
     *     description: Assigns multiple employees to a unit. This replaces all existing assignments for the unit.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - unitId
     *               - employeeIds
     *             properties:
     *               unitId:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *                 description: Unit ID
     *               employeeIds:
     *                 type: array
     *                 items:
     *                   type: string
     *                 example: ["emp-1", "emp-2", "emp-3"]
     *                 description: Array of employee IDs to assign to the unit
     *     responses:
     *       200:
     *         description: Employees assigned to unit successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/assignEmployeesToUnit', this.controller.assignEmployeesToUnit.bind(this.controller));

    /**
     * @swagger
     * /unitEmployee/addEmployeesToUnit:
     *   post:
     *     summary: Add employees to unit (bulk addition)
     *     tags: [Unit Employees]
     *     security:
     *       - bearerAuth: []
     *     description: Adds multiple employees to a unit without removing existing assignments
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - unitId
     *               - employeeIds
     *             properties:
     *               unitId:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *                 description: Unit ID
     *               employeeIds:
     *                 type: array
     *                 items:
     *                   type: string
     *                 example: ["emp-1", "emp-2", "emp-3"]
     *                 description: Array of employee IDs to add to the unit
     *     responses:
     *       200:
     *         description: Employees added to unit successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/addEmployeesToUnit', this.controller.addEmployeesToUnit.bind(this.controller));

    /**
     * @swagger
     * /unitEmployee/removeEmployeesFromUnit:
     *   post:
     *     summary: Remove employees from unit (bulk removal)
     *     tags: [Unit Employees]
     *     security:
     *       - bearerAuth: []
     *     description: Removes multiple employees from a unit
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - unitId
     *               - employeeIds
     *             properties:
     *               unitId:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *                 description: Unit ID
     *               employeeIds:
     *                 type: array
     *                 items:
     *                   type: string
     *                 example: ["emp-1", "emp-2"]
     *                 description: Array of employee IDs to remove from the unit
     *     responses:
     *       200:
     *         description: Employees removed from unit successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/removeEmployeesFromUnit', this.controller.removeEmployeesFromUnit.bind(this.controller));

    /**
     * @swagger
     * /unitEmployee/removeEmployeeFromUnit:
     *   post:
     *     summary: Remove a single employee from unit
     *     tags: [Unit Employees]
     *     security:
     *       - bearerAuth: []
     *     description: Removes a single employee from a unit
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - unitId
     *               - employeeId
     *             properties:
     *               unitId:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *                 description: Unit ID
     *               employeeId:
     *                 type: string
     *                 example: "emp-1"
     *                 description: Employee ID to remove from the unit
     *     responses:
     *       200:
     *         description: Employee removed from unit successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/removeEmployeeFromUnit', this.controller.removeEmployeeFromUnit.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default UnitEmployeeRoutes;
