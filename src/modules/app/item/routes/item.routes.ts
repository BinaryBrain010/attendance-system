import express, { Router } from 'express';
import ItemController from '../controllers/item';

class ItemRoutes {
  private router: Router;
  private controller: ItemController;

  constructor() {
    this.router = express.Router();
    this.controller = new ItemController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    /**
     * @swagger
     * /item/get:
     *   get:
     *     summary: Get all items
     *     tags: [Items]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Items retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/get', this.controller.getAllItem.bind(this.controller));
    
    /**
     * @swagger
     * /item/getOutOfStock:
     *   get:
     *     summary: Get out of stock items
     *     tags: [Items]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Out of stock items retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/getOutOfStock', this.controller.getOutOfStockItem.bind(this.controller));
    
    /**
     * @swagger
     * /item/get:
     *   post:
     *     summary: Get paginated items
     *     tags: [Items]
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
     *         description: Items retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PaginatedResponse'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/get', this.controller.getItem.bind(this.controller));
    
    /**
     * @swagger
     * /item/getDeleted:
     *   post:
     *     summary: Get deleted items
     *     tags: [Items]
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
     *         description: Deleted items retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PaginatedResponse'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/getDeleted', this.controller.getDeletedItem.bind(this.controller));
    
    /**
     * @swagger
     * /item/total:
     *   get:
     *     summary: Get total items count
     *     tags: [Items]
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
    this.router.get('/total', this.controller.getTotalItem.bind(this.controller));
    
    /**
     * @swagger
     * /item/create:
     *   post:
     *     summary: Create a new item
     *     tags: [Items]
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
     *             properties:
     *               name:
     *                 type: string
     *                 example: Laptop
     *               description:
     *                 type: string
     *                 example: High-performance laptop
     *               quantity:
     *                 type: integer
     *                 example: 50
     *               unitPrice:
     *                 type: number
     *                 format: float
     *                 example: 999.99
     *     responses:
     *       201:
     *         description: Item created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/create', this.controller.createItem.bind(this.controller));
    
    /**
     * @swagger
     * /item/update:
     *   put:
     *     summary: Update an item
     *     tags: [Items]
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
     *               description:
     *                 type: string
     *               quantity:
     *                 type: integer
     *               unitPrice:
     *                 type: number
     *                 format: float
     *     responses:
     *       200:
     *         description: Item updated successfully
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
    this.router.put('/update', this.controller.updateItem.bind(this.controller));
    
    /**
     * @swagger
     * /item/delete:
     *   post:
     *     summary: Delete an item (soft delete)
     *     tags: [Items]
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
     *         description: Item deleted successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/delete', this.controller.deleteItem.bind(this.controller));
    
    /**
     * @swagger
     * /item/search:
     *   post:
     *     summary: Search items
     *     tags: [Items]
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
     *                 example: laptop
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
    this.router.post('/search', this.controller.searchItems.bind(this.controller));
    
    /**
     * @swagger
     * /item/getById:
     *   post:
     *     summary: Get item by ID
     *     tags: [Items]
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
     *         description: Item retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/getById', this.controller.getItemById.bind(this.controller));
    
    /**
     * @swagger
     * /item/restore:
     *   post:
     *     summary: Restore a deleted item
     *     tags: [Items]
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
     *         description: Item restored successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/restore', this.controller.restoreItem.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default ItemRoutes;
