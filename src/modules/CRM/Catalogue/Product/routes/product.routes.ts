import { Router } from "express";
import multer from "multer";
import ProductController from "../controllers/product.controller";
import { validate, schemas } from "../../../shared/validate";

const upload = multer({ storage: multer.memoryStorage() });

/** Mounts at /crmProduct. */
class CrmProductRoutes {
  private router: Router;
  private controller: ProductController;

  constructor() {
    this.router = Router();
    this.controller = new ProductController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post("/import", upload.single("file"), this.controller.importShopify.bind(this.controller));
    this.router.get("/getAll", this.controller.getAll.bind(this.controller));
    this.router.post("/get", validate(schemas.readList), this.controller.get.bind(this.controller));
    this.router.post("/getDeleted", validate(schemas.readList), this.controller.getDeleted.bind(this.controller));
    this.router.post("/getById", validate(schemas.idOnly), this.controller.getById.bind(this.controller));
    this.router.post("/byCategory", validate(schemas.byCategory), this.controller.byCategory.bind(this.controller));
    this.router.get("/total", this.controller.total.bind(this.controller));
    this.router.post("/create", validate(schemas.product.create), this.controller.create.bind(this.controller));
    this.router.put("/update", validate(schemas.product.update), this.controller.update.bind(this.controller));
    this.router.post("/variant", validate(schemas.product.variant), this.controller.addVariant.bind(this.controller));
    this.router.post("/image", validate(schemas.product.image), this.controller.addImage.bind(this.controller));
    this.router.post("/delete", validate(schemas.idOnly), this.controller.remove.bind(this.controller));
    this.router.post("/restore", validate(schemas.idOnly), this.controller.restore.bind(this.controller));
    this.router.post("/search", validate(schemas.readList), this.controller.search.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default CrmProductRoutes;
