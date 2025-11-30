import express, { Request, Response, Router } from 'express';
import AppFeatureController from '../controller/feature.controller';

class AppFeatureRoutes {
  private router: Router;
  private controller: AppFeatureController;

  constructor() {
    this.router = express.Router();
    this.controller = new AppFeatureController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    /**
     * @swagger
     * /appFeature/get:
     *   get:
     *     summary: Get all app features
     *     tags: [Features]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: App features retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.get('/get', this.controller.getAllAppFeatures.bind(this.controller));
    
    /**
     * @swagger
     * /appFeature/total:
     *   get:
     *     summary: Get total app features count
     *     tags: [Features]
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
    this.router.get('/total', this.controller.getTotalAppFeatures.bind(this.controller));
    
    /**
     * @swagger
     * /appFeature/get:
     *   post:
     *     summary: Get app feature by ID
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
     *         description: App feature retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/get', this.controller.getAppFeatureById.bind(this.controller)); 
    
    /**
     * @swagger
     * /appFeature/getByParent:
     *   post:
     *     summary: Get app features by parent
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
     *               - parentId
     *             properties:
     *               parentId:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *     responses:
     *       200:
     *         description: App features retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/getByParent', this.controller.getAppFeatureByParent.bind(this.controller)); 
    
    /**
     * @swagger
     * /appFeature/create:
     *   post:
     *     summary: Create a new app feature
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
     *               - name
     *             properties:
     *               name:
     *                 type: string
     *                 example: "user.manage"
     *               description:
     *                 type: string
     *                 example: "Manage users"
     *               parentId:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *     responses:
     *       201:
     *         description: App feature created successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/create', this.controller.createAppFeature.bind(this.controller));
    
    /**
     * @swagger
     * /appFeature/update:
     *   put:
     *     summary: Update an app feature
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
     *         description: App feature updated successfully
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
    this.router.put('/update', this.controller.updateAppFeature.bind(this.controller));
    
    /**
     * @swagger
     * /appFeature/restore:
     *   post:
     *     summary: Restore a deleted app feature
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
     *         description: App feature restored successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/restore', this.controller.restoreAppFeature.bind(this.controller));
    
    /**
     * @swagger
     * /appFeature/delete:
     *   post:
     *     summary: Delete an app feature (soft delete)
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
     *         description: App feature deleted successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/delete', this.controller.deleteAppFeature.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default AppFeatureRoutes;
