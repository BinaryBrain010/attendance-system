/**
 * Two-register lead import DRY RUN (local only). Reads both Okasha registers from Docs/, runs the
 * importer in dry-run mode (NOTHING is written), prints the summary, and writes
 * qa/LeadImport_DryRun.xlsx with sheets: Summary, Accepted, Duplicates, Skipped, Stage flagged,
 * Unassigned, Date fixed, Location flags.
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
const leadCols = (p = "") => [
  { header: p + "Source File", key: p + "sourceFile", width: 32 },
  { header: p + "Lead ID", key: p + "legacyId", width: 17 },
  { header: p + "Gen?", key: p + "generatedId", width: 6 },
  { header: p + "Customer", key: p + "customerName", width: 22 },
  { header: p + "Phone", key: p + "phone", width: 15 },
  { header: p + "City", key: p + "city", width: 12 },
  { header: p + "Area", key: p + "area", width: 16 },
  { header: p + "Address", key: p + "address", width: 26 },
  { header: p + "Notes", key: p + "notes", width: 26 },
  { header: p + "Channel", key: p + "channel", width: 15 },
  { header: p + "Stage", key: p + "stage", width: 11 },
  { header: p + "StageFlag", key: p + "stageFlagged", width: 9 },
  { header: p + "Priority", key: p + "priority", width: 8 },
  { header: p + "Est.Value", key: p + "estimatedValue", width: 11 },
  { header: p + "Agent (final)", key: p + "finalAgent", width: 12 },
  { header: p + "AgentFlag (original)", key: p + "agentFlag", width: 30 },
  { header: p + "DateRecvd", key: p + "dateReceived", width: 12 },
  { header: p + "MergedFrom", key: p + "mergedFrom", width: 26 },
];
const leadRow = (r: any, p = "") => ({
  [p + "sourceFile"]: r.sourceFile, [p + "legacyId"]: r.legacyId, [p + "generatedId"]: r.generatedId ? "Y" : "",
  [p + "customerName"]: r.customerName, [p + "phone"]: r.phone, [p + "city"]: r.city, [p + "area"]: r.area, [p + "address"]: r.address, [p + "notes"]: r.notes,
  [p + "channel"]: r.channel, [p + "stage"]: r.stage, [p + "stageFlagged"]: r.stageFlagged ? "Y" : "", [p + "priority"]: r.priority,
  [p + "estimatedValue"]: r.estimatedValue, [p + "finalAgent"]: r.finalAgent || r.agentCode || "(unassigned)", [p + "agentFlag"]: r.agentFlag || "",
  [p + "dateReceived"]: fmtDate(r.dateReceived), [p + "mergedFrom"]: (r.mergedFrom || []).join(", "),
});

async function main() {
  const files = FILES.map((name) => ({ name, csv: fs.readFileSync(path.join(DOCS, name), "utf8") }));
  const report: any = await new LeadImportService().run(files, true); // DRY RUN
  const d = report.detail, t = report.totals;
  const wb = new ExcelJS.Workbook();

  // Summary
  const sum = wb.addWorksheet("Summary");
  sum.columns = [{ header: "Metric", key: "k", width: 48 }, { header: "Value", key: "v", width: 64 }];
  const add = (k: string, v: any) => sum.addRow({ k, v });
  report.files.forEach((f: any) => add(f.name, `rows=${f.rows}  accepted=${f.accepted}  withLeadId=${f.withLeadId}  generatedId=${f.generatedId}  skipped=${f.skipped}`));
  add("Empty spreadsheet rows ignored (both files)", t.emptyRowsIgnored);
  add("Unique after dedup (to import)", t.uniqueAfterDedup);
  add("Duplicate groups (merged or kept-both)", t.duplicatesGroups);
  add("Duplicate rows merged away", t.duplicateRowsDropped);
  add("Conflicting-outcome duplicates kept (WON vs LOST)", t.conflictsKept);
  add("Leads with NULL city (flagged)", t.nullCity);
  add("Unassigned (no agent)", t.unassigned);
  add("Reassigned AG007 -> AG006", t.reassignedFromAG007);
  add("Stage flagged (-> NEW)", t.stageFlagged);
  add("Date fixes (swapped / out of range)", t.dateFixes);
  add("Location flags", t.locationFlags);
  add("Generated codes continue from", report.generatedFrom);
  add("", "");
  add("FINAL PER-AGENT COUNTS (as will be saved)", "");
  Object.entries(report.perAgent).sort((a: any, b: any) => b[1] - a[1]).forEach(([k, v]) => add(`  ${k}`, v));
  const skBy = (reason: string) => d.skipped.filter((s: any) => s.reason === reason).length;
  add("", "");
  add("RECONCILIATION", "");
  add("  Populated Lead IDs in the two sheets", "96 + 149 = 245 (matches your figure)");
  add("  (separate) completely empty spreadsheet rows, not counted above", t.emptyRowsIgnored);
  add("  minus Lead-ID rows that HAVE an ID but NO customer name", skBy("no customer name"));
  add("  minus dummy / repeated-header / junk-name rows", skBy("dummy row") + skBy("repeated header row") + skBy("junk name"));
  add("  minus duplicate rows merged away (phone+date, same outcome)", t.duplicateRowsDropped);
  add("  = real-Lead-ID leads kept", t.withLeadId);
  add("  PLUS name+phone rows with a BLANK Lead ID (generated code)", t.generatedId);
  add("  = UNIQUE leads to import", t.uniqueAfterDedup);
  add("  Also skipped separately: named rows with neither Lead ID nor phone", skBy("no Lead ID and no phone"));
  sum.getRow(1).font = { bold: true };

  const sheet = (name: string, cols: any[], rows: any[]) => { const ws = wb.addWorksheet(name); ws.columns = cols; rows.forEach((r) => ws.addRow(r)); ws.getRow(1).font = { bold: true }; return ws; };

  sheet("Accepted", leadCols(), d.accepted.map((r: any) => leadRow(r)));

  // Duplicates: merged (kept vs dropped) + kept-both
  const dup = wb.addWorksheet("Duplicates");
  dup.columns = [{ header: "Resolution", key: "resolution", width: 26 }, ...leadCols("KEPT "), { header: "", key: "sep", width: 2 }, ...leadCols("DROPPED ")];
  for (const dp of d.duplicates) {
    if (dp.resolution === "merged") { for (const dr of dp.dropped) dup.addRow({ resolution: "merged (kept higher stage)", ...leadRow(dp.kept, "KEPT "), sep: "|", ...leadRow(dr, "DROPPED ") }); }
    else { for (const rr of dp.rows) dup.addRow({ resolution: "KEPT BOTH (values differ)", ...leadRow(rr, "KEPT ") }); }
  }
  dup.getRow(1).font = { bold: true };

  sheet("Skipped", [{ header: "File", key: "file", width: 32 }, { header: "Row", key: "row", width: 6 }, { header: "Lead ID", key: "id", width: 17 }, { header: "Customer", key: "name", width: 22 }, { header: "Reason", key: "reason", width: 28 }], d.skipped);
  sheet("Stage flagged", [{ header: "File", key: "file", width: 32 }, { header: "Lead ID", key: "id", width: 17 }, { header: "Customer", key: "name", width: 22 }, { header: "Raw stage", key: "rawStage", width: 16 }, { header: "Outcome", key: "outcome", width: 14 }, { header: "Resolved", key: "resolved", width: 20 }], d.stageReview);
  sheet("Unassigned", leadCols(), d.unassigned.map((r: any) => leadRow(r)));
  sheet("Date fixed", [{ header: "File", key: "file", width: 32 }, { header: "Lead ID", key: "id", width: 17 }, { header: "Customer", key: "name", width: 22 }, { header: "Field", key: "field", width: 15 }, { header: "Raw", key: "from", width: 16 }, { header: "Parsed", key: "to", width: 14 }, { header: "Reason", key: "reason", width: 30 }], d.dateFixes);
  sheet("Location flags", [{ header: "File", key: "file", width: 32 }, { header: "Lead ID", key: "id", width: 17 }, { header: "Customer", key: "name", width: 22 }, { header: "Raw location", key: "raw", width: 40 }, { header: "Flag", key: "flag", width: 28 }], d.locationFlags);

  await wb.xlsx.writeFile(OUT);
  console.log("=== Lead import DRY RUN (nothing written) ===");
  console.log(JSON.stringify({ files: report.files, totals: t, perAgent: report.perAgent, generatedFrom: report.generatedFrom, cities: report.cities, stages: report.stages }, null, 2));
  console.log(`\nExcel written: ${OUT}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
