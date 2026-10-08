import { Router } from "express";
import SalesAgentController from "../controllers/salesAgent.controller";

/** Mounts at /salesAgent. */
class SalesAgentRoutes {
  private router: Router;
  private controller: SalesAgentController;

  constructor() {
    this.router = Router();
    this.controller = new SalesAgentController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get("/getAll", this.controller.getAll.bind(this.controller));
    this.router.post("/get", this.controller.get.bind(this.controller));
    this.router.post("/getById", this.controller.getById.bind(this.controller));
    this.router.get("/me", this.controller.me.bind(this.controller));
    this.router.get("/total", this.controller.total.bind(this.controller));
    this.router.post("/create", this.controller.create.bind(this.controller));
    this.router.put("/update", this.controller.update.bind(this.controller));
    this.router.post("/delete", this.controller.remove.bind(this.controller));
    this.router.post("/restore", this.controller.restore.bind(this.controller));
    this.router.post("/search", this.controller.search.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default SalesAgentRoutes;
