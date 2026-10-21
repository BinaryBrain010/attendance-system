import { Router } from "express";
import multer from "multer";
import LeadController from "../controllers/lead.controller";
import { validate, schemas } from "../../shared/validate";

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
    this.router.post("/get", validate(schemas.readList), this.controller.get.bind(this.controller));
    this.router.post("/filtered", validate(schemas.readList), this.controller.filtered.bind(this.controller));
    this.router.post("/total", validate(schemas.readList), this.controller.total.bind(this.controller));
    this.router.post("/getById", validate(schemas.idOnly), this.controller.getById.bind(this.controller));
    this.router.post("/create", validate(schemas.lead.create), this.controller.create.bind(this.controller));
    this.router.put("/update", validate(schemas.lead.update), this.controller.update.bind(this.controller));
    this.router.post("/delete", validate(schemas.idOnly), this.controller.remove.bind(this.controller));
    this.router.post("/restore", validate(schemas.idOnly), this.controller.restore.bind(this.controller));
    this.router.post("/transition", validate(schemas.lead.transition), this.controller.transition.bind(this.controller));
    this.router.post("/assign", validate(schemas.leadAssign), this.controller.assign.bind(this.controller));
    this.router.post("/transfer", validate(schemas.leadTransfer), this.controller.transfer.bind(this.controller));
    this.router.post("/mentionables", this.controller.mentionables.bind(this.controller));
    this.router.post("/fromVisitor", validate(schemas.fromVisitor), this.controller.fromVisitor.bind(this.controller));
    this.router.post("/timeline", validate(schemas.idOnly), this.controller.timeline.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default LeadRoutes;
