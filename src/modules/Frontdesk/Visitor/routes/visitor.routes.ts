import { Router } from "express";
import multer from "multer";
import VisitorController from "../controllers/visitor.controller";

// Store uploaded Excel files in memory as Buffers
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * tags:
 *   name: Visitors
 *   description: Frontdesk / reception visitor management
 */
class VisitorRoutes {
  private router: Router;
  private controller: VisitorController;

  constructor() {
    this.router = Router();
    this.controller = new VisitorController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    /**
     * @swagger
     * /visitor/getAll:
     *   get:
     *     summary: Get all visitors
     *     tags: [Visitors]
     *     security: [{ bearerAuth: [] }]
     *     responses:
     *       200:
     *         description: Visitors retrieved successfully
     */
    this.router.get("/getAll", this.controller.getAllVisitors.bind(this.controller));

    /**
     * @swagger
     * /visitor/get:
     *   get:
     *     summary: Get visitors with pagination
     *     tags: [Visitors]
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: query
     *         name: page
     *         schema: { type: integer, default: 1 }
     *       - in: query
     *         name: pageSize
     *         schema: { type: integer, default: 10 }
     *     responses:
     *       200:
     *         description: Visitors retrieved successfully
     */
    this.router.get("/get", this.controller.getVisitors.bind(this.controller));

    /**
     * @swagger
     * /visitor/getById:
     *   get:
     *     summary: Get a visitor by ID
     *     tags: [Visitors]
     *     security: [{ bearerAuth: [] }]
     *     parameters:
     *       - in: query
     *         name: id
     *         required: true
     *         schema: { type: string }
     *     responses:
     *       200:
     *         description: Visitor retrieved successfully
     */
    this.router.get("/getById", this.controller.getVisitorById.bind(this.controller));

    /**
     * @swagger
     * /visitor/deleted:
     *   get:
     *     summary: Get soft-deleted visitors (recycle bin)
     *     tags: [Visitors]
     *     security: [{ bearerAuth: [] }]
     *     responses:
     *       200:
     *         description: Deleted visitors retrieved successfully
     */
    this.router.get("/deleted", this.controller.getDeletedVisitors.bind(this.controller));

    /**
     * @swagger
     * /visitor/total:
     *   get:
     *     summary: Get total visitors count
     *     tags: [Visitors]
     *     security: [{ bearerAuth: [] }]
     *     responses:
     *       200:
     *         description: Total visitors count retrieved successfully
     */
    this.router.get("/total", this.controller.getTotalVisitors.bind(this.controller));

    /**
     * @swagger
     * /visitor/template:
     *   get:
     *     summary: Download the blank visitor import template (xlsx)
     *     tags: [Visitors]
     *     security: [{ bearerAuth: [] }]
     *     responses:
     *       200:
     *         description: Template file
     */
    this.router.get("/template", this.controller.downloadTemplate.bind(this.controller));

    /**
     * @swagger
     * /visitor/create:
     *   post:
     *     summary: Create a new visitor record
     *     tags: [Visitors]
     *     security: [{ bearerAuth: [] }]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [name, visitDate]
     *             properties:
     *               name: { type: string }
     *               phone: { type: string }
     *               cnic: { type: string }
     *               vehicleNo: { type: string }
     *               company: { type: string }
     *               purpose: { type: string }
     *               referredToText: { type: string }
     *               referredToEmployeeId: { type: string }
     *               visitDate: { type: string, format: date }
     *               timeIn: { type: string, format: date-time }
     *               timeOut: { type: string, format: date-time }
     *               outcome:
     *                 type: string
     *                 enum: [ENQUIRY, PURCHASED, REPLACED, RECEIVED, NO_ACTION, OTHER]
     *               purchased: { type: boolean }
     *               purchaseAmount: { type: number }
     *               notes: { type: string }
     *     responses:
     *       200:
     *         description: Visitor created successfully
     */
    this.router.post("/create", this.controller.createVisitor.bind(this.controller));

    /**
     * @swagger
     * /visitor/update:
     *   put:
     *     summary: Update a visitor record
     *     tags: [Visitors]
     *     security: [{ bearerAuth: [] }]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [id]
     *             properties:
     *               id: { type: string }
     *     responses:
     *       200:
     *         description: Visitor updated successfully
     */
    this.router.put("/update", this.controller.updateVisitor.bind(this.controller));

    /**
     * @swagger
     * /visitor/checkout:
     *   post:
     *     summary: Record a visitor check-out time
     *     tags: [Visitors]
     *     security: [{ bearerAuth: [] }]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [id]
     *             properties:
     *               id: { type: string }
     *               timeOut: { type: string, format: date-time }
     *     responses:
     *       200:
     *         description: Visitor checked out successfully
     */
    this.router.post("/checkout", this.controller.checkOutVisitor.bind(this.controller));

    /**
     * @swagger
     * /visitor/delete:
     *   post:
     *     summary: Soft-delete a visitor
     *     tags: [Visitors]
     *     security: [{ bearerAuth: [] }]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [id]
     *             properties:
     *               id: { type: string }
     *     responses:
     *       200:
     *         description: Visitor deleted successfully
     */
    this.router.post("/delete", this.controller.deleteVisitor.bind(this.controller));

    /**
     * @swagger
     * /visitor/restore:
     *   post:
     *     summary: Restore a soft-deleted visitor
     *     tags: [Visitors]
     *     security: [{ bearerAuth: [] }]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [id]
     *             properties:
     *               id: { type: string }
     *     responses:
     *       200:
     *         description: Visitor restored successfully
     */
    this.router.post("/restore", this.controller.restoreVisitor.bind(this.controller));

    /**
     * @swagger
     * /visitor/search:
     *   post:
     *     summary: Search visitors
     *     tags: [Visitors]
     *     security: [{ bearerAuth: [] }]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [searchTerm]
     *             properties:
     *               searchTerm: { type: string }
     *               page: { type: integer, default: 1 }
     *               pageSize: { type: integer, default: 10 }
     *     responses:
     *       200:
     *         description: Visitors search completed successfully
     */
    this.router.post("/search", this.controller.searchVisitors.bind(this.controller));

    /**
     * @swagger
     * /visitor/stats:
     *   post:
     *     summary: Get visitor / purchase statistics for a date range
     *     tags: [Visitors]
     *     security: [{ bearerAuth: [] }]
     *     requestBody:
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               from: { type: string, format: date }
     *               to: { type: string, format: date }
     *     responses:
     *       200:
     *         description: Visitor stats retrieved successfully
     */
    this.router.post("/stats", this.controller.getStats.bind(this.controller));

    /**
     * @swagger
     * /visitor/present:
     *   get:
     *     summary: Get visitors currently on-site (checked in, not yet checked out)
     *     tags: [Visitors]
     *     security: [{ bearerAuth: [] }]
     *     responses:
     *       200:
     *         description: Present visitors retrieved successfully
     */
    this.router.get("/present", this.controller.getPresent.bind(this.controller));

    /**
     * @swagger
     * /visitor/personHistory:
     *   post:
     *     summary: Get the full visit history for one person (by phone and/or name)
     *     tags: [Visitors]
     *     security: [{ bearerAuth: [] }]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               phone: { type: string }
     *               name: { type: string }
     *     responses:
     *       200:
     *         description: Visitor history retrieved successfully
     */
    this.router.post("/personHistory", this.controller.getPersonHistory.bind(this.controller));

    /**
     * @swagger
     * /visitor/lookup:
     *   post:
     *     summary: Quick returning-visitor lookup (count + most recent visit for prefill)
     *     tags: [Visitors]
     *     security: [{ bearerAuth: [] }]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               phone: { type: string }
     *               name: { type: string }
     *     responses:
     *       200:
     *         description: Lookup completed
     */
    this.router.post("/lookup", this.controller.lookupPerson.bind(this.controller));

    /**
     * @swagger
     * /visitor/suggest:
     *   post:
     *     summary: Suggest distinct previous visitors by name (for autocomplete)
     *     tags: [Visitors]
     *     security: [{ bearerAuth: [] }]
     *     requestBody:
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               term: { type: string }
     *               limit: { type: integer, default: 8 }
     *     responses:
     *       200:
     *         description: Suggestions retrieved
     */
    this.router.post("/suggest", this.controller.suggestPersons.bind(this.controller));

    /**
     * @swagger
     * /visitor/filtered:
     *   post:
     *     summary: Paginated visitor list filtered by date range / outcome / purchased
     *     tags: [Visitors]
     *     security: [{ bearerAuth: [] }]
     *     requestBody:
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               from: { type: string, format: date }
     *               to: { type: string, format: date }
     *               outcome: { type: string }
     *               purchased: { type: boolean }
     *               page: { type: integer, default: 1 }
     *               pageSize: { type: integer, default: 10 }
     *     responses:
     *       200:
     *         description: Filtered visitors retrieved successfully
     */
    this.router.post("/filtered", this.controller.getFiltered.bind(this.controller));

    /**
     * @swagger
     * /visitor/getHistoryById:
     *   post:
     *     summary: Get a visitor's update history
     *     tags: [Visitors]
     *     security: [{ bearerAuth: [] }]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [id]
     *             properties:
     *               id: { type: string }
     *               filter: { type: boolean }
     *               date: { type: string, format: date }
     *     responses:
     *       200:
     *         description: Visitor history retrieved successfully
     */
    this.router.post("/getHistoryById", this.controller.getHistoryById.bind(this.controller));

    /**
     * @swagger
     * /visitor/excel:
     *   post:
     *     summary: Export visitors to an Excel file (optionally filtered)
     *     tags: [Visitors]
     *     security: [{ bearerAuth: [] }]
     *     requestBody:
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               from: { type: string, format: date }
     *               to: { type: string, format: date }
     *               outcome: { type: string }
     *               purchased: { type: boolean }
     *     responses:
     *       200:
     *         description: Excel file
     */
    this.router.post("/excel", this.controller.downloadExcel.bind(this.controller));

    /**
     * @swagger
     * /visitor/import:
     *   post:
     *     summary: Import visitors from an Excel file
     *     description: >
     *       Upload an xlsx file. Use mode=template for the clean single-sheet template,
     *       or mode=reception for the historical multi-sheet "Reception Visitors List" workbook.
     *     tags: [Visitors]
     *     security: [{ bearerAuth: [] }]
     *     requestBody:
     *       required: true
     *       content:
     *         multipart/form-data:
     *           schema:
     *             type: object
     *             properties:
     *               file: { type: string, format: binary }
     *               mode: { type: string, enum: [template, reception], default: template }
     *     responses:
     *       200:
     *         description: Visitors imported successfully
     */
    this.router.post(
      "/import",
      upload.single("file"),
      this.controller.importVisitors.bind(this.controller)
    );
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default VisitorRoutes;
