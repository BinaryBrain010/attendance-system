import { Router } from "express";
import QuotationController from "../controllers/quotation.controller";

/** Mounts at /quotation. Phase 1 = scoped reads + basic CRUD. Versioning/transitions land in P3. */
class QuotationRoutes {
  private router: Router;
  private controller: QuotationController;

  constructor() {
    this.router = Router();
    this.controller = new QuotationController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post("/get", this.controller.get.bind(this.controller));
    this.router.post("/filtered", this.controller.filtered.bind(this.controller));
    this.router.post("/total", this.controller.total.bind(this.controller));
    this.router.post("/getById", this.controller.getById.bind(this.controller));
    this.router.post("/create", this.controller.create.bind(this.controller));
    this.router.put("/update", this.controller.update.bind(this.controller));
    this.router.post("/fromLead", this.controller.fromLead.bind(this.controller));
    this.router.post("/newVersion", this.controller.newVersion.bind(this.controller));
    this.router.post("/transition", this.controller.transition.bind(this.controller));
    this.router.post("/pdf", this.controller.downloadPdf.bind(this.controller));
    this.router.post("/delete", this.controller.remove.bind(this.controller));
    this.router.post("/restore", this.controller.restore.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default QuotationRoutes;
