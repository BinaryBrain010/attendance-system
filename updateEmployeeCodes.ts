import prisma from "./src/core/models/base.model";
import { Company } from "@prisma/client";
import logger from "./src/core/logger/logger";

/**
 * Script to update employee codes based on company and global joining date sequence
 * 
 * Company codes:
 * - SOLARMAX -> SOL-{sequence}
 * - POWERHIGHWAY -> PWH-{sequence}
 * - OKASHASMART -> OK-{sequence}
 * 
 * Sequence numbers are assigned globally based on joining date across all companies
 */

type EmployeeSelection = {
  id: string;
  name: string;
  surname: string;
  company: Company;
  joiningDate: Date;
  code: string;
};

class EmployeeCodeUpdater {
  private companyPrefixMap: Record<Company, string> = {
    SOLARMAX: "SOL",
    POWERHIGHWAY: "PWH",
    OKASHASMART: "OK",
  };

  async updateAllEmployeeCodes() {
    try {
      logger.info("Starting employee code update process...");

      // Get all employees ordered by joining date (oldest first)
      // Secondary sort by id to ensure consistent ordering when joining dates are the same
      const employees = await prisma.employee.findMany({
        where: {
          isDeleted: null,
        },
        orderBy: [
          {
            joiningDate: "asc",
          },
          {
            id: "asc",
          },
        ],
        select: {
          id: true,
          name: true,
          surname: true,
          company: true,
          joiningDate: true,
          code: true,
        },
      });

      logger.info(`Found ${employees.length} employees to update`);

      if (employees.length === 0) {
        logger.info("No employees found to update");
        return;
      }

      // Update codes in a transaction
      // First, set all codes to temporary values to avoid unique constraint conflicts
      const tempUpdates = employees.map((employee) => {
        return prisma.employee.update({
          where: { id: employee.id },
          data: {
            code: `TEMP-${employee.id}`,
            updatedAt: new Date(),
          },
        });
      });

      await prisma.$transaction(tempUpdates);
      logger.info("Temporary codes assigned");

      // Now update to final codes
      const finalUpdates = employees.map((employee, index) => {
        const sequenceNumber = index + 1;
        const prefix = this.companyPrefixMap[employee.company];
        const newCode = `${prefix}-${sequenceNumber}`;

        return prisma.employee.update({
          where: { id: employee.id },
          data: {
            code: newCode,
            updatedAt: new Date(),
          },
        });
      });

      // Execute all final updates
      await prisma.$transaction(finalUpdates);
      logger.info("Final codes assigned");

      logger.info(`Successfully updated ${employees.length} employee codes`);

      // Log summary
      const summary = this.generateSummary(employees);
      logger.info("Update Summary:");
      logger.info(JSON.stringify(summary, null, 2));

      // Log first 10 updates as examples
      logger.info("\nFirst 10 updated codes:");
      employees.slice(0, 10).forEach((emp, idx) => {
        const prefix = this.companyPrefixMap[emp.company];
        const newCode = `${prefix}-${idx + 1}`;
        logger.info(
          `  ${emp.name} ${emp.surname} (${emp.company}): ${emp.code} -> ${newCode}`
        );
      });
    } catch (error) {
      logger.error("Error updating employee codes:", error);
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }

  private generateSummary(employees: EmployeeSelection[]) {
    const summary: Record<string, any> = {
      total: employees.length,
      byCompany: {},
    };

    employees.forEach((emp) => {
      const prefix = this.companyPrefixMap[emp.company];
      const companyKey = emp.company as string;
      if (!summary.byCompany[companyKey]) {
        summary.byCompany[companyKey] = {
          prefix,
          count: 0,
          codes: [],
        };
      }
      summary.byCompany[companyKey].count++;
    });

    // Add code ranges for each company
    Object.keys(summary.byCompany).forEach((company) => {
      const companyEmployees = employees.filter((e) => e.company === company);
      if (companyEmployees.length > 0) {
        const prefix = this.companyPrefixMap[company as Company];
        const firstIndex = employees.indexOf(companyEmployees[0]);
        const lastIndex = employees.indexOf(
          companyEmployees[companyEmployees.length - 1]
        );
        summary.byCompany[company].codes = [
          `${prefix}-${firstIndex + 1}`,
          `${prefix}-${lastIndex + 1}`,
        ];
      }
    });

    return summary;
  }

  /**
   * Preview what changes will be made without actually updating
   */
  async previewChanges() {
    try {
      logger.info("Previewing employee code changes...");

      const employees = await prisma.employee.findMany({
        where: {
          isDeleted: null,
        },
        orderBy: [
          {
            joiningDate: "asc",
          },
          {
            id: "asc",
          },
        ],
        select: {
          id: true,
          name: true,
          surname: true,
          company: true,
          joiningDate: true,
          code: true,
        },
      });

      logger.info(`\nFound ${employees.length} employees:\n`);

      employees.forEach((employee, index) => {
        const sequenceNumber = index + 1;
        const prefix = this.companyPrefixMap[employee.company];
        const newCode = `${prefix}-${sequenceNumber}`;
        const willChange = employee.code !== newCode;

        logger.info(
          `${index + 1}. ${employee.name} ${employee.surname} (${employee.company})`
        );
        logger.info(`   Joining Date: ${employee.joiningDate.toISOString()}`);
        logger.info(`   Current Code: ${employee.code}`);
        logger.info(`   New Code: ${newCode} ${willChange ? "⚠️ CHANGE" : "✓"}`);
        logger.info("");
      });

      const summary = this.generateSummary(employees);
      logger.info("\nSummary:");
      logger.info(JSON.stringify(summary, null, 2));
    } catch (error) {
      logger.error("Error previewing changes:", error);
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }
}

// Main execution
const args = process.argv.slice(2);
const isPreview = args.includes("--preview") || args.includes("-p");

const updater = new EmployeeCodeUpdater();

if (isPreview) {
  updater
    .previewChanges()
    .then(() => {
      logger.info("Preview completed");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Preview failed:", error);
      process.exit(1);
    });
} else {
  updater
    .updateAllEmployeeCodes()
    .then(() => {
      logger.info("Employee code update completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Employee code update failed:", error);
      process.exit(1);
    });
}

