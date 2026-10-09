/**
 * REAL lead import (LOCAL only). Reads both Okasha registers and PERSISTS the cleaned/deduped leads
 * in one transaction (upsert by sourceFile+legacyId), printing before/after Lead counts + created/updated.
 *   npx ts-node qa/runLeadImportReal.ts
 */
import fs from "fs";
import path from "path";
import LeadImportService from "../src/modules/CRM/Lead/services/leadImport.service";
import prisma from "../src/core/models/base.model";

const DB = process.env.DATABASE_URL || "";
const host = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) { console.error(`refusing: DATABASE_URL host "${host}" is not local`); process.exit(2); }

const DOCS = path.join(__dirname, "..", "..", "..", "Docs");
const FILES = ["FINAL-Okasha_Sales_Dashboard (01 Lead Register).csv", "Okasha_Sales_Dashboard(01 Lead Register).csv"];

async function main() {
  const files = FILES.map((name) => ({ name, csv: fs.readFileSync(path.join(DOCS, name), "utf8") }));
  const res: any = await new LeadImportService().run(files, false); // PERSIST
  console.log("=== REAL lead import complete ===");
  console.log("before:", res.persisted.before, " after:", res.persisted.after, " created:", res.persisted.created, " updated:", res.persisted.updated);
  console.log("unique attempted:", res.totals.uniqueAfterDedup, " per-agent:", JSON.stringify(res.perAgent));
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
