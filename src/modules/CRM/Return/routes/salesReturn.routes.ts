import { Router } from "express";
import SalesReturnController from "../controllers/salesReturn.controller";
import { validate, schemas } from "../../shared/validate";

/** Mounts at /salesReturn (feature root crm.return). */
class SalesReturnRoutes {
  private router: Router;
  private controller: SalesReturnController;

  constructor() {
    this.router = Router();
    this.controller = new SalesReturnController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post("/get", validate(schemas.readList), this.controller.get.bind(this.controller));
    this.router.post("/filtered", validate(schemas.readList), this.controller.filtered.bind(this.controller));
    this.router.post("/total", validate(schemas.readList), this.controller.total.bind(this.controller));
    this.router.post("/getById", validate(schemas.idOnly), this.controller.getById.bind(this.controller));
    this.router.post("/create", validate(schemas.salesReturn.create), this.controller.create.bind(this.controller));
    this.router.post("/fromOrder", validate(schemas.fromOrder), this.controller.fromOrder.bind(this.controller));
    this.router.put("/update", validate(schemas.salesReturn.update), this.controller.update.bind(this.controller));
    this.router.post("/transition", validate(schemas.salesReturn.transition), this.controller.transition.bind(this.controller));
    this.router.post("/delete", validate(schemas.idOnly), this.controller.remove.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default SalesReturnRoutes;
