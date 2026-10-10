/**
 * Returns + Reattempt import DRY RUN (local). Reads Docs/Returns + Reattempt CSVs, runs the importer
 * in dry-run mode (nothing written), prints the summary, and writes qa/ReturnImport_DryRun.xlsx with
 * sheets: Summary, Returns, Reason clusters, Couriers, Courier fault, Reattempts.
 *   npx ts-node returnImportDryRun.ts
 */
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import ReturnImportService from "./src/modules/CRM/Return/services/returnImport.service";
import prisma from "./src/core/models/base.model";

const DOCS = path.join(__dirname, "..", "..", "Docs");
const RETURNS = "Returns sepstember(SEP 2026).csv";
const REATTEMPT = "Reattempt List(Sheet1).csv";
const OUT = path.join(__dirname, "qa", "ReturnImport_DryRun.xlsx");
const fmt = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : "");

async function main() {
  const returnsFile = { name: RETURNS, csv: fs.readFileSync(path.join(DOCS, RETURNS), "utf8") };
  const reattemptFile = { name: REATTEMPT, csv: fs.readFileSync(path.join(DOCS, REATTEMPT), "utf8") };
  const report: any = await new ReturnImportService().run(returnsFile, reattemptFile, true);
  const d = report.detail;
  const wb = new ExcelJS.Workbook();

  const sum = wb.addWorksheet("Summary");
  sum.columns = [{ header: "Metric", key: "k", width: 44 }, { header: "Value", key: "v", width: 56 }];
  const add = (k: string, v: any) => sum.addRow({ k, v });
  add("Returns rows parsed", report.returns.rows);
  add("  matched to an existing order (by Order# or CN)", report.returns.matchedToOrder);
  add("  will CREATE a historical order (source=RETURNS_IMPORT)", report.returns.willCreateOrder);
  add("  linked to an existing lead by phone", report.returns.leadMatchedByPhone);
  add("  skipped (no customer name)", report.returns.skipped);
  add("Reattempt rows parsed", report.reattempts.rows);
  add("  matched to an existing order", report.reattempts.matchedToOrder);
  add("  will CREATE a historical order", report.reattempts.willCreateOrder);
  add("  linked to an existing lead by phone", report.reattempts.leadMatchedByPhone);
  add("  skipped", report.reattempts.skipped);
  add("", "");
  add("COURIER FAULT returns, by courier", "");
  Object.entries(report.returns.courierFaultByCourier || {}).sort((a: any, b: any) => b[1] - a[1]).forEach(([k, v]) => add(`  ${k}`, v));
  add("", "");
  add("REASON CLUSTERS (Detail -> bucket)", "");
  Object.entries(report.returns.reasonClusters).sort((a: any, b: any) => b[1] - a[1]).forEach(([k, v]) => add(`  ${k}`, v));
  add("", "");
  add("COURIERS (normalized)", "");
  Object.entries(report.returns.couriers).sort((a: any, b: any) => b[1] - a[1]).forEach(([k, v]) => add(`  ${k}`, v));
  sum.getRow(1).font = { bold: true };

  const ret = wb.addWorksheet("Returns");
  ret.columns = [
    { header: "CN #", key: "cn", width: 18 }, { header: "Order Num", key: "orderNum", width: 12 }, { header: "Match", key: "match", width: 10 },
    { header: "Customer", key: "customerName", width: 22 }, { header: "Phone", key: "phone", width: 15 }, { header: "Item", key: "itemName", width: 26 },
    { header: "Qty", key: "qty", width: 6 }, { header: "City", key: "city", width: 14 }, { header: "Status", key: "statusRaw", width: 14 },
    { header: "Detail (raw)", key: "detail", width: 30 }, { header: "Reason cluster", key: "reasonCluster", width: 28 },
    { header: "Courier (raw)", key: "courierRaw", width: 14 }, { header: "Courier", key: "courier", width: 12 },
    { header: "Return date", key: "returnDate", width: 12 }, { header: "Order date", key: "orderDate", width: 12 },
  ];
  d.returns.forEach((r: any) => ret.addRow({ ...r, returnDate: fmt(r.returnDate), orderDate: fmt(r.orderDate) }));
  ret.getRow(1).font = { bold: true };

  const rc = wb.addWorksheet("Reason clusters");
  rc.columns = [{ header: "Cluster", key: "k", width: 30 }, { header: "Count", key: "n", width: 8 }, { header: "Sample raw details", key: "s", width: 80 }];
  Object.entries(report.returns.reasonClusters).sort((a: any, b: any) => b[1] - a[1]).forEach(([k, v]) => rc.addRow({ k, n: v, s: (report.returns.reasonSamples[k] || []).join(" | ") }));
  rc.getRow(1).font = { bold: true };

  const co = wb.addWorksheet("Couriers");
  co.columns = [{ header: "Normalized courier", key: "k", width: 20 }, { header: "Count", key: "n", width: 8 }];
  Object.entries(report.returns.couriers).sort((a: any, b: any) => b[1] - a[1]).forEach(([k, v]) => co.addRow({ k, n: v }));
  co.getRow(1).font = { bold: true };

  const cf = wb.addWorksheet("Courier fault");
  cf.columns = [{ header: "Courier", key: "k", width: 20 }, { header: "Courier-fault returns", key: "n", width: 20 }];
  Object.entries(report.returns.courierFaultByCourier || {}).sort((a: any, b: any) => b[1] - a[1]).forEach(([k, v]) => cf.addRow({ k, n: v }));
  cf.getRow(1).font = { bold: true };

  const ra = wb.addWorksheet("Reattempts");
  ra.columns = [{ header: "Name", key: "name", width: 22 }, { header: "Phone", key: "phone", width: 15 }, { header: "CN #", key: "cn", width: 18 }, { header: "Order NO", key: "orderNum", width: 12 }, { header: "Match", key: "match", width: 10 }, { header: "Date", key: "date", width: 12 }];
  d.reattempts.forEach((r: any) => ra.addRow({ ...r, date: fmt(r.date) }));
  ra.getRow(1).font = { bold: true };

  await wb.xlsx.writeFile(OUT);
  console.log("=== Returns/Reattempt DRY RUN (nothing written) ===");
  console.log(JSON.stringify({ returns: { ...report.returns, reasonSamples: undefined }, reattempts: report.reattempts }, null, 2));
  console.log(`\nExcel written: ${OUT}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
