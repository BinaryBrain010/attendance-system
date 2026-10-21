import { Router } from "express";
import SalesAgentController from "../controllers/salesAgent.controller";
import { validate, schemas } from "../../shared/validate";

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
    this.router.post("/get", validate(schemas.readList), this.controller.get.bind(this.controller));
    this.router.post("/getById", validate(schemas.idOnly), this.controller.getById.bind(this.controller));
    this.router.post("/stats", validate(schemas.idOnly), this.controller.stats.bind(this.controller));
    this.router.post("/activity", validate(schemas.idPaged), this.controller.activity.bind(this.controller));
    this.router.get("/me", this.controller.me.bind(this.controller));
    this.router.get("/total", this.controller.total.bind(this.controller));
    this.router.post("/create", validate(schemas.agent.create), this.controller.create.bind(this.controller));
    this.router.put("/update", validate(schemas.agent.update), this.controller.update.bind(this.controller));
    this.router.post("/delete", validate(schemas.idOnly), this.controller.remove.bind(this.controller));
    this.router.post("/restore", validate(schemas.idOnly), this.controller.restore.bind(this.controller));
    this.router.post("/search", validate(schemas.readList), this.controller.search.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default SalesAgentRoutes;
