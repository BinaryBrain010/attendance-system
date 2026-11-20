import express, { NextFunction, Request, Response, Router } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import FaceCaptureController from "../controllers/faceCapture.controller";
import { LIMITS } from "../helper/faceCaptureFiles";

/**
 * Face capture, PUBLIC (mounted at /faceCapturePublic with no login). The link token in the path is
 * the only key: it is checked against the stored hash on every call. Rate limited per IP, with
 * hard limits on file count and size; images are sniffed and re-encoded by the service.
 */
const limitMessage = { success: false, message: "Too many tries from this network. Wait a few minutes and try again.", statusCode: 429 };
const infoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.FACE_CAPTURE_INFO_LIMIT || 60),
  standardHeaders: true,
  legacyHeaders: false,
  message: limitMessage,
});
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.FACE_CAPTURE_UPLOAD_LIMIT || 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: limitMessage,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITS.maxFileBytes, files: LIMITS.maxFiles, fields: 4, fieldSize: 200_000 },
});

function receive(req: Request, res: Response, next: NextFunction) {
  upload.array("files", LIMITS.maxFiles)(req, res, (err: any) => {
    if (!err) return next();
    const tooMany = err?.code === "LIMIT_FILE_COUNT" || err?.code === "LIMIT_UNEXPECTED_FILE";
    const tooBig = err?.code === "LIMIT_FILE_SIZE";
    res.status(tooBig ? 413 : 400).json({
      success: false,
      statusCode: tooBig ? 413 : 400,
      message: tooBig ? "One of the photos is too large." : tooMany ? `Send at most ${LIMITS.maxFiles} photos.` : "The upload could not be read. Try again.",
    });
  });
}

class FaceCapturePublicRoutes {
  private router: Router;
  private controller: FaceCaptureController;

  constructor() {
    this.router = express.Router();
    this.controller = new FaceCaptureController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    const c = this.controller;
    this.router.get("/info/:token", infoLimiter, c.publicInfo.bind(c));
    this.router.post("/upload/:token", uploadLimiter, receive, c.publicUpload.bind(c));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default FaceCapturePublicRoutes;
