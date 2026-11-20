import express, { Router } from "express";
import FaceCaptureController from "../controllers/faceCapture.controller";

/**
 * Face capture, signed in (mounted at /faceCapture behind authentication + requirePermission).
 * Every route is mapped in featureMap.json; files are only ever read through these routes.
 */
class FaceCaptureRoutes {
  private router: Router;
  private controller: FaceCaptureController;

  constructor() {
    this.router = express.Router();
    this.controller = new FaceCaptureController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    const c = this.controller;
    this.router.post("/link/create", c.createLink.bind(c));
    this.router.post("/status", c.status.bind(c));
    this.router.post("/list", c.list.bind(c));
    this.router.post("/export", c.export.bind(c));
    this.router.get("/thumb", c.thumb.bind(c));
    this.router.get("/image", c.image.bind(c));
    this.router.get("/zip", c.zip.bind(c));
    this.router.post("/register", c.register.bind(c));
    this.router.post("/test", c.test.bind(c));
    this.router.post("/verify", c.verify.bind(c));
    this.router.post("/redo", c.redo.bind(c));
    this.router.post("/note", c.note.bind(c));
    this.router.post("/deletePhotos", c.deletePhotos.bind(c));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default FaceCaptureRoutes;
