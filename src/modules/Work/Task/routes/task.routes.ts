import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import TaskController from "../controllers/task.controller";

// Attachments reuse the Employee disk-storage pattern: assets/uploads/tasks/<taskId>, served at /uploads.
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const id = (req.body?.id || req.body?.taskId || "misc").toString();
    const dir = path.join(process.cwd(), "src", "assets", "uploads", "tasks", id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`),
});
const upload = multer({ storage });

/** Mounts at /task. */
class TaskRoutes {
  private router: Router;
  private controller: TaskController;
  constructor() {
    this.router = Router();
    this.controller = new TaskController();
    this.initializeRoutes();
  }
  private initializeRoutes(): void {
    this.router.post("/get", this.controller.get.bind(this.controller));
    this.router.post("/getById", this.controller.getById.bind(this.controller));
    this.router.post("/create", this.controller.create.bind(this.controller));
    this.router.put("/update", this.controller.update.bind(this.controller));
    this.router.post("/setStatus", this.controller.setStatus.bind(this.controller));
    this.router.post("/assign", this.controller.assign.bind(this.controller));
    this.router.post("/bulkAssign", this.controller.bulkAssign.bind(this.controller));
    this.router.post("/comment", this.controller.addComment.bind(this.controller));
    this.router.post("/checklist", this.controller.setChecklistItem.bind(this.controller));
    this.router.post("/watchers", this.controller.setWatchers.bind(this.controller));
    this.router.post("/attachments", upload.array("files", 10), this.controller.uploadAttachments.bind(this.controller));
    this.router.post("/delete", this.controller.remove.bind(this.controller));
  }
  public getRouter(): Router { return this.router; }
}

export default TaskRoutes;
