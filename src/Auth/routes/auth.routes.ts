import express, { Router } from 'express';
import UserController from '../../modules/rbac/user/controller/user.controller';
import { loginLimiter } from '../../middleware/rateLimiter.middleware';

class AuthRoutes {
  private router: Router;
  private controller: UserController;

  constructor() {
    this.router = express.Router();
    this.controller = new UserController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    /**
     * @swagger
     * /auth/login:
     *   post:
     *     summary: User login
     *     tags: [Authentication]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - username
     *               - password
     *               - platform
     *             properties:
     *               username:
     *                 type: string
     *                 example: admin
     *               password:
     *                 type: string
     *                 format: password
     *                 example: password123
     *               rememberMe:
     *                 type: boolean
     *                 example: false
     *               platform:
     *                 type: string
     *                 enum: [Mobile, Admin, Attendance App, quick-solutions]
     *                 example: Admin
     *     responses:
     *       200:
     *         description: Login successful
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 token:
     *                   type: string
     *                   description: JWT authentication token
     *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
     *                 permissions:
     *                   type: array
     *                   items:
     *                     type: string
     *                   description: Array of allowed feature permissions for the user
     *                   example: ["user.create.*", "user.read.*", "gatePass.approve.*"]
     *                 employee:
     *                   type: object
     *                   description: Employee data (only present for Attendance App platform)
     *                   nullable: true
     *       401:
     *         description: Invalid credentials or insufficient permissions
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     *                   example: "Invalid username or password"
     *       429:
     *         description: Too many login attempts
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    this.router.post('/login', loginLimiter, this.controller.loginUser.bind(this.controller));
    
    /**
     * @swagger
     * /auth/logout:
     *   get:
     *     summary: Logout current user
     *     tags: [Authentication]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Logout successful
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         description: Unauthorized
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    this.router.get('/logout', this.controller.logoutUser.bind(this.controller));
    
    /**
     * @swagger
     * /auth/logoutOfAllDevices:
     *   get:
     *     summary: Logout from all devices
     *     tags: [Authentication]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Logout from all devices successful
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         description: Unauthorized
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    this.router.get('/logoutOfAllDevices', this.controller.logoutOfAllDevices.bind(this.controller));
    
    /**
     * @swagger
     * /auth/logoutUserOfAllDevices:
     *   post:
     *     summary: Logout specific user from all devices
     *     tags: [Authentication]
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
     *         description: Logout successful
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Success'
     *       401:
     *         description: Unauthorized
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    this.router.post('/logoutUserOfAllDevices', this.controller.logoutUserOfAllDevices.bind(this.controller));
  }
  

  public getRouter(): Router {
    return this.router;
  }
}

export default AuthRoutes;
