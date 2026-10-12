import { Router } from "express";
import BundleController from "../controllers/bundle.controller";
import { validate, schemas } from "../../../shared/validate";

/** Mounts at /crmBundle. */
class CrmBundleRoutes {
  private router: Router;
  private controller: BundleController;

  constructor() {
    this.router = Router();
    this.controller = new BundleController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get("/getAll", this.controller.getAll.bind(this.controller));
    this.router.post("/get", validate(schemas.readList), this.controller.get.bind(this.controller));
    this.router.post("/getDeleted", validate(schemas.readList), this.controller.getDeleted.bind(this.controller));
    this.router.post("/getById", validate(schemas.idOnly), this.controller.getById.bind(this.controller));
    this.router.get("/total", this.controller.total.bind(this.controller));
    this.router.post("/create", validate(schemas.bundle.create), this.controller.create.bind(this.controller));
    this.router.put("/update", validate(schemas.bundle.update), this.controller.update.bind(this.controller));
    this.router.post("/addItem", validate(schemas.bundleAddItem), this.controller.addItem.bind(this.controller));
    this.router.post("/delete", validate(schemas.idOnly), this.controller.remove.bind(this.controller));
    this.router.post("/restore", validate(schemas.idOnly), this.controller.restore.bind(this.controller));
    this.router.post("/search", validate(schemas.readList), this.controller.search.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default CrmBundleRoutes;
