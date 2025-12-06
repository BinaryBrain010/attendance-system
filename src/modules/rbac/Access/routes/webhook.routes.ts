import express, { Router } from 'express';
import AccessController from '../controller/access.controller';

class WebhookRoutes {
  private router: Router;
  private controller: AccessController;

  constructor() {
    this.router = express.Router();
    this.controller = new AccessController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    /**
     * @swagger
     * /webhook/permissions:
     *   post:
     *     summary: Webhook to get updated permissions array for a specific session token
     *     tags: [Webhooks]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               token:
     *                 type: string
     *                 description: JWT token for the session
     *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
     *     parameters:
     *       - in: query
     *         name: token
     *         schema:
     *           type: string
     *         description: JWT token (alternative to body)
     *     responses:
     *       200:
     *         description: Permissions retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                   example: true
     *                 message:
     *                   type: string
     *                   example: "Permissions retrieved successfully!"
     *                 data:
     *                   type: array
     *                   items:
     *                     type: string
     *                   example: ["user.create.*", "user.read.*", "group.update.*"]
     *       400:
     *         description: Token is required
     *       401:
     *         description: Invalid or expired token
     *       500:
     *         description: Server error
     */
    this.router.post('/permissions', this.controller.getPermissionsByToken.bind(this.controller));
    
    /**
     * @swagger
     * /webhook/permissions:
     *   get:
     *     summary: Webhook to get updated permissions array for a specific session token (GET method)
     *     tags: [Webhooks]
     *     parameters:
     *       - in: query
     *         name: token
     *         required: true
     *         schema:
     *           type: string
     *         description: JWT token for the session
     *     responses:
     *       200:
     *         description: Permissions retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                   example: true
     *                 message:
     *                   type: string
     *                   example: "Permissions retrieved successfully!"
     *                 data:
     *                   type: array
     *                   items:
     *                     type: string
     *                   example: ["user.create.*", "user.read.*", "group.update.*"]
     *       400:
     *         description: Token is required
     *       401:
     *         description: Invalid or expired token
     *       500:
     *         description: Server error
     */
    this.router.get('/permissions', this.controller.getPermissionsByToken.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default WebhookRoutes;

