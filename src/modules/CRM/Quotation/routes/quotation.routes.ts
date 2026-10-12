import { Router } from "express";
import QuotationController from "../controllers/quotation.controller";
import { validate, schemas } from "../../shared/validate";

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
    this.router.post("/get", validate(schemas.readList), this.controller.get.bind(this.controller));
    this.router.post("/filtered", validate(schemas.readList), this.controller.filtered.bind(this.controller));
    this.router.post("/total", validate(schemas.readList), this.controller.total.bind(this.controller));
    this.router.post("/getById", validate(schemas.idOnly), this.controller.getById.bind(this.controller));
    this.router.post("/create", validate(schemas.quotation.create), this.controller.create.bind(this.controller));
    this.router.put("/update", validate(schemas.quotation.update), this.controller.update.bind(this.controller));
    this.router.post("/fromLead", validate(schemas.leadId), this.controller.fromLead.bind(this.controller));
    this.router.post("/newVersion", validate(schemas.idOnly), this.controller.newVersion.bind(this.controller));
    this.router.post("/transition", validate(schemas.quotation.transition), this.controller.transition.bind(this.controller));
    this.router.post("/pdf", validate(schemas.idOnly), this.controller.downloadPdf.bind(this.controller));
    this.router.post("/delete", validate(schemas.idOnly), this.controller.remove.bind(this.controller));
    this.router.post("/restore", validate(schemas.idOnly), this.controller.restore.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default QuotationRoutes;
