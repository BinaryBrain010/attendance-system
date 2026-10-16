import { Router } from "express";
import AuditController from "../controllers/audit.controller";

/**
 * Mounts at /auditLog.
 *  - /get, /export : admin Audit Log page (mapped to audit.read.* in featureMap).
 *  - /entity, /actors : per-record History tab + actor name resolution (mapped to profile.* so any
 *    authenticated user passes the route gate; the service enforces that the caller can read the
 *    specific record).
 */
class AuditLogRoutes {
  private router: Router;
  private controller: AuditController;

  constructor() {
    this.router = Router();
    this.controller = new AuditController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post("/get", this.controller.get.bind(this.controller));
    this.router.post("/export", this.controller.export.bind(this.controller));
    this.router.post("/entity", this.controller.entity.bind(this.controller));
    this.router.post("/actors", this.controller.actors.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default AuditLogRoutes;
