import { Router } from "express";
import HrPolicyController from "../controllers/hrPolicy.controller";

/** Mounts at /hrPolicy. Every route is gated by hr.policy.manage.* (see featuremap override). */
class HrPolicyRoutes {
  private router: Router;
  private controller: HrPolicyController;
  constructor() {
    this.router = Router();
    this.controller = new HrPolicyController();
    this.initializeRoutes();
  }
  private initializeRoutes(): void {
    // Settings
    this.router.get("/settings", this.controller.getSettings.bind(this.controller));
    this.router.post("/settings", this.controller.updateSettings.bind(this.controller));
    // Rules
    this.router.post("/rules", this.controller.listRules.bind(this.controller));
    this.router.post("/rules/save", this.controller.upsertRule.bind(this.controller));
    this.router.post("/rules/remove", this.controller.removeRule.bind(this.controller));
    // Entitlement
    this.router.post("/entitlement/preview", this.controller.previewEntitlement.bind(this.controller));
    this.router.post("/entitlement/apply", this.controller.applyEntitlement.bind(this.controller));
    this.router.post("/entitlement/adjust", this.controller.adjustEntitlement.bind(this.controller));
    // Probation
    this.router.post("/probation/due", this.controller.probationDue.bind(this.controller));
    this.router.post("/probation/history", this.controller.probationHistory.bind(this.controller));
    this.router.post("/probation/decide", this.controller.probationDecide.bind(this.controller));
  }
  public getRouter(): Router { return this.router; }
}

export default HrPolicyRoutes;
