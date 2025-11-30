import express, { Router } from 'express';
import UserGroupController from '../controller/userGroup.controller';

class UserGroupRoutes {
  private router: Router;
  private controller: UserGroupController;

  constructor() {
    this.router = express.Router();
    this.controller = new UserGroupController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    /**
     * @swagger
     * /userGroup/get:
     *   get:
     *     summary: Get all user groups
     *     tags: [Groups]
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
    this.router.get('/get', this.controller.getAllUserGroups.bind(this.controller));
    
    /**
     * @swagger
     * /userGroup/getById:
     *   post:
     *     summary: Get user group by ID
     *     tags: [Groups]
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
     *         description: User group retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/getById', this.controller.getUserGroupById.bind(this.controller));
    
    /**
     * @swagger
     * /userGroup/getByUserId:
     *   post:
     *     summary: Get user groups by user ID
     *     tags: [Groups]
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
     *             properties:
     *               userId:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
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
    this.router.post('/getByUserId', this.controller.getUserGroupByUserId.bind(this.controller));
    
    /**
     * @swagger
     * /userGroup/create:
     *   post:
     *     summary: Assign a user to a group
     *     tags: [Groups]
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
     *               - groupId
     *             properties:
     *               userId:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *               groupId:
     *                 type: string
     *                 example: "123e4567-e89b-12d3-a456-426614174000"
     *               active:
     *                 type: boolean
     *                 example: true
     *     responses:
     *       201:
     *         description: User assigned to group successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       400:
     *         $ref: '#/components/responses/400'
     *       401:
     *         $ref: '#/components/responses/401'
     */
    this.router.post('/create', this.controller.createUserGroup.bind(this.controller));
    
    /**
     * @swagger
     * /userGroup/update:
     *   put:
     *     summary: Update a user group assignment
     *     tags: [Groups]
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
     *         description: User group updated successfully
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
    this.router.put('/update', this.controller.updateUserGroup.bind(this.controller));
    
    /**
     * @swagger
     * /userGroup/restore:
     *   post:
     *     summary: Restore a deleted user group assignment
     *     tags: [Groups]
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
     *         description: User group restored successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/restore', this.controller.restoreUserGroup.bind(this.controller));
    
    /**
     * @swagger
     * /userGroup/delete:
     *   post:
     *     summary: Remove a user from a group (soft delete)
     *     tags: [Groups]
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
     *         description: User removed from group successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         $ref: '#/components/responses/401'
     *       404:
     *         $ref: '#/components/responses/404'
     */
    this.router.post('/delete', this.controller.deleteUserGroup.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default UserGroupRoutes;

