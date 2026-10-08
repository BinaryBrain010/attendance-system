import { Router } from "express";
import multer from "multer";
import LeadController from "../controllers/lead.controller";

const upload = multer({ storage: multer.memoryStorage() });

/** Mounts at /lead. Scoped reads + CRUD + state machine + timeline + Visitor->Lead + import. */
class LeadRoutes {
  private router: Router;
  private controller: LeadController;

  constructor() {
    this.router = Router();
    this.controller = new LeadController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post("/import", upload.single("file"), this.controller.importCsv.bind(this.controller));
    this.router.post("/get", this.controller.get.bind(this.controller));
    this.router.post("/filtered", this.controller.filtered.bind(this.controller));
    this.router.post("/total", this.controller.total.bind(this.controller));
    this.router.post("/getById", this.controller.getById.bind(this.controller));
    this.router.post("/create", this.controller.create.bind(this.controller));
    this.router.put("/update", this.controller.update.bind(this.controller));
    this.router.post("/delete", this.controller.remove.bind(this.controller));
    this.router.post("/restore", this.controller.restore.bind(this.controller));
    this.router.post("/transition", this.controller.transition.bind(this.controller));
    this.router.post("/assign", this.controller.assign.bind(this.controller));
    this.router.post("/fromVisitor", this.controller.fromVisitor.bind(this.controller));
    this.router.post("/timeline", this.controller.timeline.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default LeadRoutes;
