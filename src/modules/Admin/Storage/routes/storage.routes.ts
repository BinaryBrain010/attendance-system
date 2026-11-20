import express, { Router } from "express";
import StorageController from "../controllers/storage.controller";

/** Storage used per employee (mounted at /storage; storage.read.*). */
class StorageRoutes {
  private router: Router;
  private controller: StorageController;

  constructor() {
    this.router = express.Router();
    this.controller = new StorageController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post("/employee", this.controller.employee.bind(this.controller));
    this.router.post("/list", this.controller.list.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default StorageRoutes;
