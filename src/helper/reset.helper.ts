import prisma from "../core/models/base.model";
import { tableNames } from "../static/staticData";
import logger from "../core/logger/logger";

/** True only when DATABASE_URL points at a local host (localhost / 127.0.0.1 / [::1] / *.localhost). */
function isLocalDatabase(): boolean {
  const url = process.env.DATABASE_URL || "";
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]" || host.endsWith(".localhost");
  } catch {
    return false;
  }
}

class ResetHelper {
  async resetDB() {
    // Hard safety: a full-DB wipe must NEVER run against a non-local database (staging/prod). This is
    // the one raw write that is intentionally excluded from auditing (it truncates everything), so it
    // is instead gated so it cannot be called anywhere but local (Run 12 item 2).
    if (!isLocalDatabase()) {
      const msg = `ResetHelper.resetDB refused: DATABASE_URL is not local. A full reset is only allowed on a local database.`;
      logger.error(msg);
      throw new Error(msg);
    }
    try {
      for (const tableName of tableNames) {
        await prisma.$queryRawUnsafe(`DELETE FROM "${tableName}";`);
        logger.info(`Table ${tableName} has been reset.`);
      }
    } catch (err) {
      logger.error("Error resetting tables:", err);
      throw err;
    }
  }
}

export default ResetHelper;
