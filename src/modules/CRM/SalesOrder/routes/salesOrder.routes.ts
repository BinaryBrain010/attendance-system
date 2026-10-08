import { Router } from "express";
import SalesOrderController from "../controllers/salesOrder.controller";

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
    this.router.post("/get", this.controller.get.bind(this.controller));
    this.router.post("/filtered", this.controller.filtered.bind(this.controller));
    this.router.post("/total", this.controller.total.bind(this.controller));
    this.router.post("/getById", this.controller.getById.bind(this.controller));
    this.router.post("/create", this.controller.create.bind(this.controller));
    this.router.put("/update", this.controller.update.bind(this.controller));
    this.router.post("/delete", this.controller.remove.bind(this.controller));
    this.router.post("/restore", this.controller.restore.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default SalesOrderRoutes;
