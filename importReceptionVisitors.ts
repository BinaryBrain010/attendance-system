// Pin the timezone to match the running backend (server.ts forces Asia/Karachi),
// so parsed visit dates land on the correct calendar day.
process.env.TZ = "Asia/Karachi";

import * as fs from "fs";
import * as path from "path";
import prisma from "./src/core/models/base.model";
import visitorModel from "./src/modules/Frontdesk/Visitor/models/visitor.model";
import { VisitorExcelUtility } from "./src/excel/visitor";

/**
 * One-off backfill script: imports the historical "Reception Visitors List" workbook
 * (one sheet per day) into the Visitor table.
 *
 * Usage:
 *   ts-node importReceptionVisitors.ts "<path-to-xlsx>" [--preview]
 *
 * If no path is given it defaults to the file shipped in the repo Docs folder.
 * --preview parses and reports counts WITHOUT writing to the database.
 */

const DEFAULT_FILE = path.resolve(
  __dirname,
  "../../Docs/Reception Visitors List 2025.xlsx"
);

async function main() {
  const args = process.argv.slice(2);
  const preview = args.includes("--preview");
  const fileArg = args.find((a) => !a.startsWith("--"));
  const filePath = fileArg ? path.resolve(fileArg) : DEFAULT_FILE;

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  console.log(`📖 Reading: ${filePath}`);
  const buffer = fs.readFileSync(filePath);

  const util = new VisitorExcelUtility();
  const { rows, skippedSheets } = await util.parseReceptionWorkbook(buffer);

  console.log(`✅ Parsed ${rows.length} visitor rows`);
  if (skippedSheets.length) {
    console.log(
      `⚠️  Skipped ${skippedSheets.length} sheet(s) (no date/header): ${skippedSheets
        .slice(0, 10)
        .join(", ")}${skippedSheets.length > 10 ? " ..." : ""}`
    );
  }

  // Show a small sample
  console.log("--- sample (first 3 rows) ---");
  rows.slice(0, 3).forEach((r) =>
    console.log({
      name: r.name,
      phone: r.phone,
      purpose: r.purpose,
      referredToText: r.referredToText,
      visitDate: r.visitDate?.toISOString?.().split("T")[0],
      timeIn: r.timeIn?.toISOString?.(),
    })
  );

  if (preview) {
    console.log("👀 Preview mode — nothing was written to the database.");
    await (prisma as any).$disconnect?.();
    return;
  }

  console.log("💾 Inserting into database ...");
  const result = await visitorModel.visitor.gpBulkCreate(rows);
  console.log(`🎉 Done. Created ${result.created} visitor records.`);

  await (prisma as any).$disconnect?.();
}

main().catch(async (err) => {
  console.error("❌ Import failed:", err);
  try {
    await (prisma as any).$disconnect?.();
  } catch {}
  process.exit(1);
});
