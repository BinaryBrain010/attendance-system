/**
 * Daily probation-alert job. Runs ONCE a day (07:00), not every minute. Idempotent: re-running the
 * same day re-notifies nobody (the service skips employees already notified today). Logs at debug.
 */
import schedule from "node-schedule";
import { runAsSystem } from "../../../../core/context/requestContext";
import logger from "../../../../core/logger/logger";
import HrPolicyService from "../services/hrPolicy.service";

class ProbationSchedulerHelper {
  private _running = false;
  private service = new HrPolicyService();

  constructor() {
    // 07:00 every day.
    schedule.scheduleJob("0 7 * * *", () => {
      runAsSystem(() => this.run()).catch((e: any) => logger.error(`[probation] job failed: ${e?.message || e}`));
    });
  }

  private async run(): Promise<void> {
    if (this._running) { logger.debug("[probation] previous run still in progress; skipping this tick"); return; }
    this._running = true;
    try {
      const res = await this.service.runProbationAlerts();
      logger.debug(`[probation] checked=${res.checked} notified=${res.notified}`);
    } finally {
      this._running = false;
    }
  }
}

export default new ProbationSchedulerHelper();
