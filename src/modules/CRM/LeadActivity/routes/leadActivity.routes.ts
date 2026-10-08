import { Router } from "express";
import LeadActivityController from "../controllers/leadActivity.controller";

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
    this.router.post("/byLead", this.controller.byLead.bind(this.controller));
    this.router.post("/create", this.controller.create.bind(this.controller));
    this.router.put("/update", this.controller.update.bind(this.controller));
    this.router.post("/delete", this.controller.remove.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default LeadActivityRoutes;
