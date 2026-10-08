/**
 * Two-register lead import DRY RUN (local only). Reads both Okasha lead registers from Docs/, runs
 * the importer in dry-run mode (NOTHING is written), prints the summary, and writes
 * qa/LeadImport_DryRun.xlsx with sheets: Summary, Accepted, Duplicates, Skipped, Stage flagged, Unassigned.
 *   npx ts-node leadImportDryRun.ts
 */
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import LeadImportService from "./src/modules/CRM/Lead/services/leadImport.service";
import prisma from "./src/core/models/base.model";

const DOCS = path.join(__dirname, "..", "..", "Docs");
const FILES = ["FINAL-Okasha_Sales_Dashboard (01 Lead Register).csv", "Okasha_Sales_Dashboard(01 Lead Register).csv"];
const OUT = path.join(__dirname, "qa", "LeadImport_DryRun.xlsx");

const fmtDate = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const leadCols = (prefix = "") => [
  { header: prefix + "Source File", key: prefix + "sourceFile", width: 34 },
  { header: prefix + "Lead ID", key: prefix + "legacyId", width: 18 },
  { header: prefix + "Generated?", key: prefix + "generatedId", width: 11 },
  { header: prefix + "Customer", key: prefix + "customerName", width: 24 },
  { header: prefix + "Phone", key: prefix + "phone", width: 16 },
  { header: prefix + "City", key: prefix + "city", width: 14 },
  { header: prefix + "Area", key: prefix + "area", width: 20 },
  { header: prefix + "Channel", key: prefix + "channel", width: 16 },
  { header: prefix + "Stage", key: prefix + "stage", width: 12 },
  { header: prefix + "Stage flagged", key: prefix + "stageFlagged", width: 12 },
  { header: prefix + "Priority", key: prefix + "priority", width: 9 },
  { header: prefix + "Est. Value", key: prefix + "estimatedValue", width: 12 },
  { header: prefix + "Agent", key: prefix + "agentCode", width: 8 },
  { header: prefix + "Date Received", key: prefix + "dateReceived", width: 14 },
];
const leadRow = (r: any, prefix = "") => ({
  [prefix + "sourceFile"]: r.sourceFile, [prefix + "legacyId"]: r.legacyId, [prefix + "generatedId"]: r.generatedId ? "YES" : "",
  [prefix + "customerName"]: r.customerName, [prefix + "phone"]: r.phone, [prefix + "city"]: r.city, [prefix + "area"]: r.area,
  [prefix + "channel"]: r.channel, [prefix + "stage"]: r.stage, [prefix + "stageFlagged"]: r.stageFlagged ? "YES" : "",
  [prefix + "priority"]: r.priority, [prefix + "estimatedValue"]: r.estimatedValue, [prefix + "agentCode"]: r.agentCode || "(unassigned)",
  [prefix + "dateReceived"]: fmtDate(r.dateReceived),
});

async function main() {
  const files = FILES.map((name) => ({ name, csv: fs.readFileSync(path.join(DOCS, name), "utf8") }));
  const report: any = await new LeadImportService().run(files, true); // DRY RUN
  const d = report.detail;
  const t = report.totals;

  const wb = new ExcelJS.Workbook();

  // Summary
  const sum = wb.addWorksheet("Summary");
  sum.columns = [{ header: "Metric", key: "k", width: 42 }, { header: "Value", key: "v", width: 60 }];
  const add = (k: string, v: any) => sum.addRow({ k, v });
  add("Files", FILES.join("  |  "));
  report.files.forEach((f: any) => add(`  ${f.name}`, `rows=${f.rows}  accepted=${f.accepted}  withLeadId=${f.withLeadId}  generatedId=${f.generatedId}  skipped=${f.skipped}`));
  add("Parsed accepted (both files)", t.parsedAccepted);
  add("Unique after dedup (phone+date)", t.uniqueAfterDedup);
  add("Duplicates dropped", t.duplicatesDropped);
  add("  of unique: with real Lead ID", t.withLeadId);
  add("  of unique: generated Lead ID (blank ID + phone)", t.generatedId);
  add("Unassigned (no linked agent incl. AG007)", t.unassigned);
  add("Stage flagged (no clear stage -> NEW)", t.stageFlagged);
  const skBy = (reason: string) => d.skipped.filter((s: any) => s.reason === reason).length;
  const dummy = skBy("dummy row"), noName = skBy("no customer name"), noIdNoPhone = skBy("no Lead ID and no phone");
  add("", "");
  add("RECONCILIATION — why 'accepted' is not simply 245", "");
  add("  Populated Lead IDs in the two sheets", "96 + 149 = 245 (matches your figure)");
  add("  minus Lead-ID rows with NO customer name (skipped)", noName);
  add("  minus dummy rows (skipped)", dummy);
  add("  minus cross-file duplicates (phone+date)", t.duplicatesDropped);
  add("  = real-Lead-ID leads kept", t.withLeadId);
  add("  PLUS name+phone rows with a BLANK Lead ID (generated code, flagged)", t.generatedId);
  add("  = UNIQUE leads to import", t.uniqueAfterDedup);
  add("Also skipped: named rows with neither Lead ID nor phone", noIdNoPhone);
  add("Note", "The earlier 282 counted every named row (incl. blank-ID + no-phone noise) and used a looser dedup.");
  sum.getRow(1).font = { bold: true };

  // Accepted
  const acc = wb.addWorksheet("Accepted");
  acc.columns = leadCols();
  d.accepted.forEach((r: any) => acc.addRow(leadRow(r)));
  acc.getRow(1).font = { bold: true };

  // Duplicates (kept + dropped side by side)
  const dup = wb.addWorksheet("Duplicates");
  dup.columns = [...leadCols("KEPT "), { header: "", key: "sep", width: 3 }, ...leadCols("DROPPED ")];
  d.duplicates.forEach((p: any) => dup.addRow({ ...leadRow(p.kept, "KEPT "), sep: "|", ...leadRow(p.dropped, "DROPPED ") }));
  dup.getRow(1).font = { bold: true };

  // Skipped
  const skip = wb.addWorksheet("Skipped");
  skip.columns = [{ header: "File", key: "file", width: 34 }, { header: "Row", key: "row", width: 7 }, { header: "Lead ID", key: "id", width: 18 }, { header: "Customer", key: "name", width: 24 }, { header: "Reason", key: "reason", width: 30 }];
  d.skipped.forEach((s: any) => skip.addRow(s));
  skip.getRow(1).font = { bold: true };

  // Stage flagged
  const stg = wb.addWorksheet("Stage flagged");
  stg.columns = [{ header: "File", key: "file", width: 34 }, { header: "Lead ID", key: "id", width: 18 }, { header: "Customer", key: "name", width: 24 }, { header: "Raw stage", key: "rawStage", width: 16 }, { header: "Outcome", key: "outcome", width: 14 }, { header: "Resolved", key: "resolved", width: 20 }];
  d.stageReview.forEach((s: any) => stg.addRow(s));
  stg.getRow(1).font = { bold: true };

  // Unassigned
  const un = wb.addWorksheet("Unassigned");
  un.columns = leadCols();
  d.unassigned.forEach((r: any) => un.addRow(leadRow(r)));
  un.getRow(1).font = { bold: true };

  await wb.xlsx.writeFile(OUT);

  console.log("=== Lead import DRY RUN (nothing written to DB) ===");
  console.log(JSON.stringify({ files: report.files, totals: t, channels: report.channels, stages: report.stages, cities: report.cities }, null, 2));
  console.log(`\nExcel written: ${OUT}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
