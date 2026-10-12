import { Router } from "express";
import SalesOrderController from "../controllers/salesOrder.controller";
import { validate, schemas } from "../../shared/validate";

/** Mounts at /salesOrder. Phase 1 = scoped reads + basic CRUD. State machine/reattempt land in P3. */
class SalesOrderRoutes {
  private router: Router;
  private controller: SalesOrderController;

  constructor() {
    this.router = Router();
    this.controller = new SalesOrderController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post("/get", validate(schemas.readList), this.controller.get.bind(this.controller));
    this.router.post("/filtered", validate(schemas.readList), this.controller.filtered.bind(this.controller));
    this.router.post("/total", validate(schemas.readList), this.controller.total.bind(this.controller));
    this.router.post("/getById", validate(schemas.idOnly), this.controller.getById.bind(this.controller));
    this.router.post("/create", validate(schemas.order.create), this.controller.create.bind(this.controller));
    this.router.post("/fromLead", validate(schemas.leadId), this.controller.fromLead.bind(this.controller));
    this.router.post("/fromQuotation", validate(schemas.fromQuotation), this.controller.fromQuotation.bind(this.controller));
    this.router.put("/update", validate(schemas.order.update), this.controller.update.bind(this.controller));
    this.router.post("/transition", validate(schemas.order.transition), this.controller.transition.bind(this.controller));
    this.router.post("/reattempt", validate(schemas.idOnly), this.controller.reattempt.bind(this.controller));
    this.router.post("/invoicePdf", validate(schemas.idOnly), this.controller.invoicePdf.bind(this.controller));
    this.router.post("/deliverySlip", validate(schemas.idOnly), this.controller.deliverySlip.bind(this.controller));
    this.router.post("/delete", validate(schemas.idOnly), this.controller.remove.bind(this.controller));
    this.router.post("/restore", validate(schemas.idOnly), this.controller.restore.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default SalesOrderRoutes;
