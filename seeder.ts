import SeederHelper from "./src/helper/seeder.helper";
import ResetHelper from "./src/helper/reset.helper";
import logger from "./src/core/logger/logger";

class Seeder {
  private seederService: SeederHelper;
  private resetHelper: ResetHelper;

  constructor(force: boolean) {
    this.resetHelper = new ResetHelper();
    this.seederService = new SeederHelper();
    if (force) {
      this.reset().then(() => {
        this.startSeeding();
      }).catch((error) => {
        logger.error("Error in seeder initialization:", error);
        process.exit(1);
      });
    } else {
      this.startSeeding();
    }
  }

  private async startSeeding() {
    try {
      await this.seederService.Seeder();
      logger.info("Seeding completed successfully");
    } catch (error) {
      logger.error("Error during seeding:", error);
      process.exit(1);
    }
  }

  private async reset() {
    try {
      await this.resetHelper.resetDB();
      logger.info("Database reset completed");
    } catch (error) {
      logger.error("Error resetting database:", error);
      throw error;
    }
  }
}

const forceIndex = process.argv.indexOf("--force");

if (forceIndex !== -1) {
  new Seeder(true);
} else {
  new Seeder(false);
}
