/**
 * REAL returns + reattempt import (LOCAL only). Reads the Docs CSVs and PERSISTS in one transaction
 * (creates historical orders where missing, then returns/reattempts), printing before/after counts.
 *   npx ts-node qa/runReturnImportReal.ts
 */
import fs from "fs";
import path from "path";
import ReturnImportService from "../src/modules/CRM/Return/services/returnImport.service";
import prisma from "../src/core/models/base.model";

const DB = process.env.DATABASE_URL || "";
const host = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) { console.error(`refusing: DATABASE_URL host "${host}" is not local`); process.exit(2); }

const DOCS = path.join(__dirname, "..", "..", "..", "Docs");
const RETURNS = "Returns sepstember(SEP 2026).csv";
const REATTEMPT = "Reattempt List(Sheet1).csv";

async function main() {
  const returnsFile = { name: RETURNS, csv: fs.readFileSync(path.join(DOCS, RETURNS), "utf8") };
  const reattemptFile = { name: REATTEMPT, csv: fs.readFileSync(path.join(DOCS, REATTEMPT), "utf8") };
  const res: any = await new ReturnImportService().run(returnsFile, reattemptFile, false);
  console.log("=== REAL returns/reattempt import complete ===");
  console.log("orders before/after:", res.persisted.before.orders, "->", res.persisted.after.orders);
  console.log("returns before/after:", res.persisted.before.returns, "->", res.persisted.after.returns);
  console.log("ordersCreated:", res.persisted.ordersCreated, "returnsCreated:", res.persisted.returnsCreated, "reattemptsApplied:", res.persisted.reattemptsApplied);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
