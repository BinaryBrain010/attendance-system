import express, { Router } from 'express';
import AccessController from '../controller/access.controller';

class AccessRoutes {
  private router: Router;
  private controller: AccessController;

  constructor() {
    this.router = express.Router();
    this.controller = new AccessController();
    this.initializeRoutes();
  }

  initializeRoutes(): void {
    /**
     * @swagger
     * /access/getUserGroup:
     *   get:
     *     summary: Get user groups for current user
     *     tags: [Access]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: User groups retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/getUserGroup', this.controller.getUserGroup.bind(this.controller));
    
    /**
     * @swagger
     * /access/getUserRole:
     *   get:
     *     summary: Get user roles for current user
     *     tags: [Access]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: User roles retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/getUserRole', this.controller.getUserRole.bind(this.controller));
    
    /**
     * @swagger
     * /access/getPermission:
     *   post:
     *     summary: Get permissions for a user/role/group
     *     tags: [Access]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - parentType
     *               - parentId
     *             properties:
     *               parentType:
     *                 type: string
     *                 enum: [Role, User, Group]
     *                 example: "User"
     *               parentId:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *     responses:
     *       200:
     *         description: Permissions retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/getPermission', this.controller.getPermission.bind(this.controller));
    
    /**
     * @swagger
     * /access/checkPermission:
     *   post:
     *     summary: Check if user has a specific permission
     *     tags: [Access]
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
     *               - permission
     *             properties:
     *               userId:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *               permission:
     *                 type: string
     *                 example: "user.create"
     *     responses:
     *       200:
     *         description: Permission check completed
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 hasPermission:
     *                   type: boolean
     *                   example: true
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/checkPermission', this.controller.checkPermission.bind(this.controller));
    
    /**
     * @swagger
     * /access/checkPermissions:
     *   post:
     *     summary: Check if user has multiple permissions
     *     tags: [Access]
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
     *               - permissions
     *             properties:
     *               userId:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *               permissions:
     *                 type: array
     *                 items:
     *                   type: string
     *                 example: ["user.create", "user.update"]
     *     responses:
     *       200:
     *         description: Permissions check completed
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 permissions:
     *                   type: object
     *                   additionalProperties:
     *                     type: boolean
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/checkPermissions', this.controller.checkPermissions.bind(this.controller));
  }

  getRouter(): Router {
    return this.router;
  }
}

export default AccessRoutes;
