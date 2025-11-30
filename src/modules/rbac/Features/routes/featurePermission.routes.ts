import express, { Router } from 'express';
import FeaturePermissionController from '../controller/featurePermission.controller';

class FeaturePermissionRoutes {
  private router: Router;
  private controller: FeaturePermissionController;

  constructor() {
    this.router = express.Router();
    this.controller = new FeaturePermissionController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    /**
     * @swagger
     * /featurePermission/get:
     *   get:
     *     summary: Get all feature permissions
     *     tags: [Features]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Feature permissions retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/get', this.controller.getAllFeaturePermissions.bind(this.controller));
    
    /**
     * @swagger
     * /featurePermission/get:
     *   post:
     *     summary: Get feature permission by ID
     *     tags: [Features]
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
     *         description: Feature permission retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/get', this.controller.getFeaturePermissionById.bind(this.controller));
    
    /**
     * @swagger
     * /featurePermission/create:
     *   post:
     *     summary: Create a new feature permission
     *     tags: [Features]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - featureId
     *               - parentType
     *               - parentId
     *             properties:
     *               featureId:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *               parentType:
     *                 type: string
     *                 enum: [Role, User, Group]
     *                 example: "Role"
     *               parentId:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *     responses:
     *       201:
     *         description: Feature permission created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/create', this.controller.createFeaturePermission.bind(this.controller)); 
    
    /**
     * @swagger
     * /featurePermission/allowedFeatures:
     *   post:
     *     summary: Get allowed features for a user/role/group
     *     tags: [Features]
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
     *         description: Allowed features retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/allowedFeatures', this.controller.getAllowedFeatures.bind(this.controller)); 
    
    /**
     * @swagger
     * /featurePermission/update:
     *   put:
     *     summary: Update a feature permission
     *     tags: [Features]
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
     *         description: Feature permission updated successfully
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
    this.router.put('/update', this.controller.updateFeaturePermission.bind(this.controller));
    
    /**
     * @swagger
     * /featurePermission/restore:
     *   post:
     *     summary: Restore a deleted feature permission
     *     tags: [Features]
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
     *         description: Feature permission restored successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/restore', this.controller.restoreFeaturePermission.bind(this.controller));
    
    /**
     * @swagger
     * /featurePermission/delete:
     *   post:
     *     summary: Delete a feature permission (soft delete)
     *     tags: [Features]
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
     *         description: Feature permission deleted successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/delete', this.controller.deleteFeaturePermission.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default FeaturePermissionRoutes;
