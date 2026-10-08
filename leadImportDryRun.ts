/**
 * Two-register lead import DRY RUN (local only). Reads both Okasha lead registers from Docs/, runs
 * the importer in dry-run mode (NOTHING is written), and prints the cleaning report.
 *   npx ts-node leadImportDryRun.ts
 */
import fs from "fs";
import path from "path";
import LeadImportService from "./src/modules/CRM/Lead/services/leadImport.service";
import prisma from "./src/core/models/base.model";

const DOCS = path.join(__dirname, "..", "..", "Docs");
const FILES = ["FINAL-Okasha_Sales_Dashboard (01 Lead Register).csv", "Okasha_Sales_Dashboard(01 Lead Register).csv"];

async function main() {
  const files = FILES.map((name) => ({ name, csv: fs.readFileSync(path.join(DOCS, name), "utf8") }));
  const svc = new LeadImportService();
  const report: any = await svc.run(files, true); // DRY RUN
  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
