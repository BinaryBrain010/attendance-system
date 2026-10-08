import { Router } from "express";
import BrandController from "../controllers/brand.controller";

/** Mounts at /crmBrand. */
class CrmBrandRoutes {
  private router: Router;
  private controller: BrandController;

  constructor() {
    this.router = Router();
    this.controller = new BrandController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get("/getAll", this.controller.getAll.bind(this.controller));
    this.router.post("/get", this.controller.get.bind(this.controller));
    this.router.post("/getDeleted", this.controller.getDeleted.bind(this.controller));
    this.router.post("/getById", this.controller.getById.bind(this.controller));
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

export default CrmBrandRoutes;
