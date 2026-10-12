import { Router } from "express";
import CategoryController from "../controllers/category.controller";
import { validate, schemas } from "../../../shared/validate";

/** Mounts at /crmCategory (RoutesHelper: class name minus "Routes", first char lowercased). */
class CrmCategoryRoutes {
  private router: Router;
  private controller: CategoryController;

  constructor() {
    this.router = Router();
    this.controller = new CategoryController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get("/getAll", this.controller.getAll.bind(this.controller));
    this.router.post("/get", validate(schemas.readList), this.controller.get.bind(this.controller));
    this.router.post("/getDeleted", validate(schemas.readList), this.controller.getDeleted.bind(this.controller));
    this.router.post("/getById", validate(schemas.idOnly), this.controller.getById.bind(this.controller));
    this.router.get("/total", this.controller.total.bind(this.controller));
    this.router.post("/create", validate(schemas.category.create), this.controller.create.bind(this.controller));
    this.router.put("/update", validate(schemas.category.update), this.controller.update.bind(this.controller));
    this.router.post("/delete", validate(schemas.idOnly), this.controller.remove.bind(this.controller));
    this.router.post("/restore", validate(schemas.idOnly), this.controller.restore.bind(this.controller));
    this.router.post("/search", validate(schemas.readList), this.controller.search.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default CrmCategoryRoutes;
