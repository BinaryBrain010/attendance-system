/**
 * Daily face-photo cleanup (02:30): photos are deleted 7 days after a face is registered. The
 * FaceCapture record and its image count stay. Idempotent; logs only when something was removed.
 */
import schedule from "node-schedule";
import { runAsSystem } from "../../../../core/context/requestContext";
import logger from "../../../../core/logger/logger";
import FaceCaptureService from "../services/faceCapture.service";

class FaceCaptureSchedulerHelper {
  private _running = false;
  private service = new FaceCaptureService();

  constructor() {
    schedule.scheduleJob("30 2 * * *", () => {
      runAsSystem(() => this.run()).catch((e: any) => logger.error(`[faceCapture] cleanup failed: ${e?.message || e}`));
    });
  }

  async run(): Promise<number> {
    if (this._running) return 0;
    this._running = true;
    try {
      const n = await this.service.autoDelete();
      if (n) logger.info(`[faceCapture] deleted photos of ${n} registered capture(s)`);
      return n;
    } finally {
      this._running = false;
    }
  }
}

export default new FaceCaptureSchedulerHelper();
