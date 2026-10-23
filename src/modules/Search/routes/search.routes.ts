import express, { Router } from "express";
import SearchController from "../controllers/search.controller";

/** A10: global top-bar search. Mounts at /search (class name → path). */
class SearchRoutes {
  private router: Router;
  private controller: SearchController;
  constructor() {
    this.router = express.Router();
    this.controller = new SearchController();
    this.router.get("/global", this.controller.global.bind(this.controller));
  }
  public getRouter(): Router {
    return this.router;
  }
}

export default SearchRoutes;
