import { Router } from "express";
import LeadActivityController from "../controllers/leadActivity.controller";
import { validate, schemas } from "../../shared/validate";

/** Mounts at /leadActivity (feature root crm.lead). */
class LeadActivityRoutes {
  private router: Router;
  private controller: LeadActivityController;

  constructor() {
    this.router = Router();
    this.controller = new LeadActivityController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post("/byLead", validate(schemas.leadActivity.byLead), this.controller.byLead.bind(this.controller));
    this.router.post("/create", validate(schemas.leadActivity.create), this.controller.create.bind(this.controller));
    this.router.put("/update", validate(schemas.leadActivity.update), this.controller.update.bind(this.controller));
    this.router.post("/delete", validate(schemas.idOnly), this.controller.remove.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default LeadActivityRoutes;
