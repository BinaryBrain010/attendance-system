import { Router } from "express";
import SalesReturnController from "../controllers/salesReturn.controller";

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
    this.router.post("/get", this.controller.get.bind(this.controller));
    this.router.post("/filtered", this.controller.filtered.bind(this.controller));
    this.router.post("/total", this.controller.total.bind(this.controller));
    this.router.post("/getById", this.controller.getById.bind(this.controller));
    this.router.post("/create", this.controller.create.bind(this.controller));
    this.router.post("/fromOrder", this.controller.fromOrder.bind(this.controller));
    this.router.put("/update", this.controller.update.bind(this.controller));
    this.router.post("/transition", this.controller.transition.bind(this.controller));
    this.router.post("/delete", this.controller.remove.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default SalesReturnRoutes;
