import { Router } from "express";
import multer from "multer";
import PriceListController from "../controllers/pricelist.controller";
import { validate, schemas } from "../../../shared/validate";

const upload = multer({ storage: multer.memoryStorage() });

/** Mounts at /crmPriceList. */
class CrmPriceListRoutes {
  private router: Router;
  private controller: PriceListController;

  constructor() {
    this.router = Router();
    this.controller = new PriceListController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post("/byProduct", validate(schemas.byProduct), this.controller.byProduct.bind(this.controller));
    this.router.post("/withCost", validate(schemas.byProduct), this.controller.withCost.bind(this.controller));
    this.router.post("/create", validate(schemas.priceList.create), this.controller.create.bind(this.controller));
    this.router.put("/update", validate(schemas.priceList.update), this.controller.update.bind(this.controller));
    this.router.post("/delete", validate(schemas.idOnly), this.controller.remove.bind(this.controller));
    this.router.post("/bulkPrice", upload.single("file"), this.controller.bulkPrice.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default CrmPriceListRoutes;
