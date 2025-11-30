import prisma from "../core/models/base.model";
import { tableNames } from "../static/staticData";
import logger from "../core/logger/logger";

class ResetHelper {
  async resetDB() {
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
