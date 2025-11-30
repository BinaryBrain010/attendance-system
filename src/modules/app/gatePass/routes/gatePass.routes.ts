import express, { Router } from 'express';
import GatePassController from '../controllers/gatePass';

class GatePassRoutes {
  private router: Router;
  private controller: GatePassController;

  constructor() {
    this.router = express.Router();
    this.controller = new GatePassController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    /**
     * @swagger
     * /gatePass/get:
     *   get:
     *     summary: Get all gate passes
     *     tags: [Gate Pass]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Gate passes retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/get', this.controller.getAllGatePass.bind(this.controller));
    
    /**
     * @swagger
     * /gatePass/report:
     *   get:
     *     summary: Get gate pass report
     *     tags: [Gate Pass]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Report generated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/report', this.controller.gatePassReport.bind(this.controller));
    
    /**
     * @swagger
     * /gatePass/get:
     *   post:
     *     summary: Get paginated gate passes
     *     tags: [Gate Pass]
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
     *         description: Gate passes retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PaginatedResponse'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/get', this.controller.getGatePass.bind(this.controller));
    
    /**
     * @swagger
     * /gatePass/getDeleted:
     *   post:
     *     summary: Get deleted gate passes
     *     tags: [Gate Pass]
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
     *         description: Deleted gate passes retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PaginatedResponse'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/getDeleted', this.controller.getDeletedGatePass.bind(this.controller));
    
    /**
     * @swagger
     * /gatePass/total:
     *   get:
     *     summary: Get total gate passes count
     *     tags: [Gate Pass]
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
    this.router.get('/total', this.controller.getTotalGatePass.bind(this.controller));
    
    /**
     * @swagger
     * /gatePass/create:
     *   post:
     *     summary: Create a new gate pass
     *     tags: [Gate Pass]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - customerId
     *               - location
     *               - vehicleNo
     *               - storeIncharge
     *             properties:
     *               customerId:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *               location:
     *                 type: string
     *                 example: "Warehouse A"
     *               vehicleNo:
     *                 type: string
     *                 example: "ABC-123"
     *               storeIncharge:
     *                 type: string
     *                 example: "John Doe"
     *               notes:
     *                 type: string
     *                 example: "Additional notes"
     *               validUntil:
     *                 type: string
     *                 format: date-time
     *     responses:
     *       201:
     *         description: Gate pass created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/create', this.controller.createGatePass.bind(this.controller));
    
    /**
     * @swagger
     * /gatePass/update:
     *   put:
     *     summary: Update a gate pass
     *     tags: [Gate Pass]
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
     *         description: Gate pass updated successfully
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
    this.router.put('/update', this.controller.updateGatePass.bind(this.controller));
    
    /**
     * @swagger
     * /gatePass/delete:
     *   post:
     *     summary: Delete a gate pass (soft delete)
     *     tags: [Gate Pass]
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
     *         description: Gate pass deleted successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/delete', this.controller.deleteGatePass.bind(this.controller));
    
    /**
     * @swagger
     * /gatePass/date:
     *   post:
     *     summary: Get gate passes by date range
     *     tags: [Gate Pass]
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
     *         description: Gate passes retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/date', this.controller.getDatedGatePass.bind(this.controller));
    
    /**
     * @swagger
     * /gatePass/status:
     *   post:
     *     summary: Get gate passes by status
     *     tags: [Gate Pass]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               status:
     *                 type: string
     *                 enum: [pending, approved, cancelled]
     *                 example: pending
     *     responses:
     *       200:
     *         description: Gate passes retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/status', this.controller.getDatedGatePass.bind(this.controller));
    
    /**
     * @swagger
     * /gatePass/approve:
     *   post:
     *     summary: Approve a gate pass
     *     tags: [Gate Pass]
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
     *         description: Gate pass approved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/approve', this.controller.approveGatePass.bind(this.controller));
    
    /**
     * @swagger
     * /gatePass/getById:
     *   post:
     *     summary: Get gate pass by ID
     *     tags: [Gate Pass]
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
     *         description: Gate pass retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/getById', this.controller.getGatePassById.bind(this.controller));
    
    /**
     * @swagger
     * /gatePass/customerId:
     *   post:
     *     summary: Get gate passes by customer ID
     *     tags: [Gate Pass]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - customerId
     *             properties:
     *               customerId:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *     responses:
     *       200:
     *         description: Gate passes retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/customerId', this.controller.getGatePassByCustomerId.bind(this.controller));
    
    /**
     * @swagger
     * /gatePass/itemId:
     *   post:
     *     summary: Get gate passes by item ID
     *     tags: [Gate Pass]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - itemId
     *             properties:
     *               itemId:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *     responses:
     *       200:
     *         description: Gate passes retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/itemId', this.controller.getGatePassByItemId.bind(this.controller));
    
    /**
     * @swagger
     * /gatePass/pdf:
     *   post:
     *     summary: Generate PDF for gate pass
     *     tags: [Gate Pass]
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
     *         description: PDF generated successfully
     *         content:
     *           application/pdf:
     *             schema:
     *               type: string
     *               format: binary
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/pdf', this.controller.gatePassPDF.bind(this.controller));
    
    /**
     * @swagger
     * /gatePass/restore:
     *   post:
     *     summary: Restore a deleted gate pass
     *     tags: [Gate Pass]
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
     *         description: Gate pass restored successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/restore', this.controller.restoreGatePass.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  } 
}

export default GatePassRoutes;
