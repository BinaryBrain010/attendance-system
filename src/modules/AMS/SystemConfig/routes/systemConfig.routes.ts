import { Router } from "express";
import SystemConfigController from "../controllers/systemConfig.controller";

class SystemConfigRoutes {
  private router: Router;
  private controller: typeof SystemConfigController;

  constructor() {
    this.router = Router();
    this.controller = SystemConfigController;
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get("/get", this.controller.getConfig.bind(this.controller));
    this.router.put("/update", this.controller.updateConfig.bind(this.controller));
  }

  getRouter(): Router {
    return this.router;
  }
}

export default SystemConfigRoutes;
