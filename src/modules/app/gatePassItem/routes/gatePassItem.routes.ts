import express, { Router } from 'express';
import GatePassItemController from '../controllers/gatePassItem';

class GatePassItemRoutes {
  private router: Router;
  private controller: GatePassItemController;

  constructor() {
    this.router = express.Router();
    this.controller = new GatePassItemController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    /**
     * @swagger
     * /gatePassItem/get:
     *   get:
     *     summary: Get all gate pass items
     *     tags: [Gate Pass]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Gate pass items retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/get', this.controller.getAllGatePassItem.bind(this.controller));
    
    /**
     * @swagger
     * /gatePassItem/get:
     *   post:
     *     summary: Get paginated gate pass items
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
     *         description: Gate pass items retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PaginatedResponse'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/get', this.controller.getGatePassItem.bind(this.controller));
    
    /**
     * @swagger
     * /gatePassItem/total:
     *   get:
     *     summary: Get total gate pass items count
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
    this.router.get('/total', this.controller.getTotalGatePassItem.bind(this.controller));
    
    /**
     * @swagger
     * /gatePassItem/create:
     *   post:
     *     summary: Create a new gate pass item
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
     *               - gatePassId
     *               - itemId
     *               - quantity
     *             properties:
     *               gatePassId:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *               itemId:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *               quantity:
     *                 type: integer
     *                 example: 5
     *               serialNos:
     *                 type: array
     *                 items:
     *                   type: string
     *                 example: ["SN001", "SN002"]
     *     responses:
     *       201:
     *         description: Gate pass item created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/create', this.controller.createGatePassItem.bind(this.controller));
    
    /**
     * @swagger
     * /gatePassItem/update:
     *   put:
     *     summary: Update a gate pass item
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
     *         description: Gate pass item updated successfully
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
    this.router.put('/update', this.controller.updateGatePassItem.bind(this.controller));
    
    /**
     * @swagger
     * /gatePassItem/delete:
     *   post:
     *     summary: Delete a gate pass item (soft delete)
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
     *         description: Gate pass item deleted successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/delete', this.controller.deleteGatePassItem.bind(this.controller));
    
    /**
     * @swagger
     * /gatePassItem/getById:
     *   post:
     *     summary: Get gate pass item by ID
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
     *         description: Gate pass item retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/getById', this.controller.getGatePassItemById.bind(this.controller));
    
    /**
     * @swagger
     * /gatePassItem/restore:
     *   post:
     *     summary: Restore a deleted gate pass item
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
     *         description: Gate pass item restored successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/restore', this.controller.restoreGatePassItem.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default GatePassItemRoutes;
