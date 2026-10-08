import { Router } from "express";
import PriceListController from "../controllers/pricelist.controller";

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
    this.router.post("/byProduct", this.controller.byProduct.bind(this.controller));
    this.router.post("/withCost", this.controller.withCost.bind(this.controller));
    this.router.post("/create", this.controller.create.bind(this.controller));
    this.router.put("/update", this.controller.update.bind(this.controller));
    this.router.post("/delete", this.controller.remove.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default CrmPriceListRoutes;
