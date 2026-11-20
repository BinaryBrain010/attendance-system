import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import { EXPORT_CAP, sendTableExport } from "../../../../core/export/tableExport";
import FaceCaptureService from "../services/faceCapture.service";

const uid = (req: Request) => (req as any).userId as string;

class FaceCaptureController extends BaseController<FaceCaptureService> {
  protected service = new FaceCaptureService();

  // ---------------- public (token) ----------------

  /** No caching and no indexing for anything a capture link touches. */
  private publicHeaders(res: Response) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
  }

  async publicInfo(req: Request, res: Response) {
    this.publicHeaders(res);
    await this.handleRequest(() => this.service.publicInfo(String(req.params.token || "")), res, { req });
  }

  async publicUpload(req: Request, res: Response) {
    this.publicHeaders(res);
    await this.handleRequest(
      () => this.service.publicUpload(String(req.params.token || ""), ((req as any).files || []) as Express.Multer.File[], req.body?.meta, String(req.headers["user-agent"] || "")),
      res,
      { successMessage: "Photos received.", statusCode: 201, req },
    );
  }

  // ---------------- signed in ----------------

  async createLink(req: Request, res: Response) {
    await this.handleRequest(() => this.service.createLink(uid(req), req.body || {}), res, {
      successMessage: "Capture link created.", statusCode: 201, req,
      logActivity: { action: "FACE_LINK_CREATE", entityType: "Employee", entityId: req.body?.employeeId, description: (r: any) => `Face capture link created, valid ${r?.hours} h` },
    });
  }

  async status(req: Request, res: Response) {
    await this.handleRequest(() => this.service.status(uid(req), req.body?.employeeId), res, { req });
  }

  private async sendFile(req: Request, res: Response, load: () => Promise<{ data: Buffer; type: string; name?: string }>) {
    try {
      const f = await load();
      res.setHeader("Content-Type", f.type);
      res.setHeader("Cache-Control", "private, no-store");
      if (f.name) {
        res.setHeader("Content-Disposition", `attachment; filename="${f.name}"`);
        res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
      }
      res.send(f.data);
    } catch (e) {
      this.handleError(e, res, req);
    }
  }

  async thumb(req: Request, res: Response) {
    await this.sendFile(req, res, async () => ({ data: await this.service.image(uid(req), String(req.query.captureId || ""), String(req.query.name || ""), true), type: "image/jpeg" }));
  }

  async image(req: Request, res: Response) {
    await this.sendFile(req, res, async () => ({ data: await this.service.image(uid(req), String(req.query.captureId || ""), String(req.query.name || ""), false), type: "image/jpeg" }));
  }

  async zip(req: Request, res: Response) {
    await this.sendFile(req, res, async () => {
      const z = await this.service.zip(uid(req), String(req.query.captureId || ""));
      return { data: z.data, type: "application/zip", name: z.name };
    });
  }

  async register(req: Request, res: Response) {
    await this.handleRequest(() => this.service.register(uid(req), req.body || {}), res, {
      req,
      logActivity: { action: "FACE_REGISTER", entityType: "Employee", entityId: req.body?.employeeId, description: (r: any) => (r?.passed ? `Face registered (${r.enrolled} photos), test passed` : `Face registration failed the test: ${r?.reason}`) },
    });
  }

  async test(req: Request, res: Response) {
    await this.handleRequest(() => this.service.testMatch(uid(req), req.body || {}), res, {
      req,
      logActivity: { action: "FACE_TEST", entityType: "Employee", entityId: req.body?.employeeId, description: (r: any) => (r?.passed ? "Face test match passed" : `Face test match failed: ${r?.reason}`) },
    });
  }

  async verify(req: Request, res: Response) {
    await this.handleRequest(() => this.service.markVerified(uid(req), req.body || {}), res, {
      successMessage: "Marked verified.", req,
      logActivity: { action: "FACE_VERIFY", entityType: "Employee", entityId: req.body?.employeeId, description: "Face marked verified at the scanner" },
    });
  }

  async redo(req: Request, res: Response) {
    await this.handleRequest(() => this.service.markRedo(uid(req), req.body || {}), res, {
      successMessage: "Marked needs redo.", req,
      logActivity: { action: "FACE_REDO", entityType: "Employee", entityId: req.body?.employeeId, description: `Face marked needs redo: ${req.body?.reason ?? ""}` },
    });
  }

  async note(req: Request, res: Response) {
    await this.handleRequest(() => this.service.setNote(uid(req), req.body || {}), res, { successMessage: "Note saved.", req });
  }

  async deletePhotos(req: Request, res: Response) {
    await this.handleRequest(() => this.service.deletePhotos(uid(req), req.body || {}), res, {
      successMessage: "Photos deleted.", req,
      logActivity: { action: "FACE_PHOTOS_DELETE", entityType: "Employee", entityId: req.body?.employeeId, description: "Face capture photos deleted" },
    });
  }

  async list(req: Request, res: Response) {
    await this.handleRequest(() => this.service.list(uid(req), req.body || {}), res, { req });
  }

  async export(req: Request, res: Response) {
    try {
      const { rows, capped } = await this.service.exportRows(uid(req), req.body || {}, EXPORT_CAP);
      const fmt = (d: any) => (d ? new Date(d).toISOString().replace("T", " ").slice(0, 16) : "");
      await sendTableExport(res, {
        rows: rows.map((r) => ({ ...r, linkSentAt: fmt(r.linkSentAt), capturedAt: fmt(r.capturedAt), registeredAt: fmt(r.registeredAt), verifiedAt: fmt(r.verifiedAt) })),
        columns: [
          { key: "code", header: "Code" }, { key: "name", header: "Name" }, { key: "units", header: "Unit" }, { key: "status", header: "Status" },
          { key: "linkSentAt", header: "Last link sent" }, { key: "capturedAt", header: "Captured at" }, { key: "imageCount", header: "Photos" },
          { key: "registeredBy", header: "Registered by" }, { key: "registeredAt", header: "Registered at" },
          { key: "verifiedBy", header: "Verified by" }, { key: "verifiedAt", header: "Verified at" }, { key: "redoReason", header: "Redo reason" },
        ],
        format: req.body?.format === "excel" ? "excel" : "csv",
        filename: "face_registration",
        capped,
      });
    } catch (e) {
      this.handleError(e, res, req);
    }
  }
}

export default FaceCaptureController;
