import { Router } from "express";
import LeadReviewController from "../controllers/leadReview.controller";
import { validate, schemas } from "../../shared/validate";

/**
 * Mounts at /leadReview. Reviewer actions (create / sendBack / reopen) gate on crm.lead.review.*;
 * owner/read actions (forLead / flagsForLeads / myDay / reply) gate on crm.lead.read.own.* — see the
 * featuremap overrides. Everything is scope-checked through the parent lead in the service.
 */
class LeadReviewRoutes {
  private router: Router;
  private controller: LeadReviewController;

  constructor() {
    this.router = Router();
    this.controller = new LeadReviewController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post("/create", validate(schemas.leadReview.create), this.controller.create.bind(this.controller));
    this.router.post("/sendBack", validate(schemas.leadReview.sendBack), this.controller.sendBack.bind(this.controller));
    this.router.post("/forLead", validate(schemas.leadReview.forLead), this.controller.forLead.bind(this.controller));
    this.router.post("/flagsForLeads", validate(schemas.leadReview.flagsForLeads), this.controller.flagsForLeads.bind(this.controller));
    this.router.post("/myDay", this.controller.myDay.bind(this.controller));
    this.router.post("/reply", validate(schemas.leadReview.reply), this.controller.reply.bind(this.controller));
    this.router.post("/reopen", validate(schemas.leadReview.reopen), this.controller.reopen.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default LeadReviewRoutes;
