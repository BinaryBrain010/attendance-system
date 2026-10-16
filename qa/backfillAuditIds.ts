/**
 * One-time (repeatable, idempotent) backfill of the Run 11 audit id columns from the legacy
 * actor data that already exists on the rows. It ONLY populates the brand-new
 * createdById / updatedById columns and ONLY from values the rows already carry
 * (the legacy createdBy / updatedBy strings, and userId on the comment feeds). It never invents
 * an actor and never touches any business field, so rows this session did not create keep all
 * their existing values; only the new, previously-null audit columns are filled.
 *
 * A legacy value is used only when it is a real User id (sub-select guard), so a stray/renamed id
 * cannot be written. Rows with no legacy actor stay null and render as "System (legacy)" in the UI.
 * deletedById has no legacy source and is left null.
 *
 *   npx ts-node qa/backfillAuditIds.ts            # apply
 *   npx ts-node qa/backfillAuditIds.ts --dry      # count only, no writes
 */
import prisma from "../src/core/models/base.model";
import { IS_LOCAL } from "./lib";

const DRY = process.argv.includes("--dry");

// table -> { created: <legacy col for createdById>, updated: <legacy col for updatedById> }
const MAP: Record<string, { created?: string; updated?: string }> = {
  Employee: { created: "createdBy", updated: "updatedBy" },
  Attendance: { created: "createdBy", updated: "updatedBy" },
  Holiday: { created: "createdBy", updated: "updatedBy" },
  Unit: { created: "createdBy", updated: "updatedBy" },
  Visitor: { created: "createdBy", updated: "updatedBy" },
  Category: { created: "createdBy", updated: "updatedBy" },
  Brand: { created: "createdBy", updated: "updatedBy" },
  Product: { created: "createdBy", updated: "updatedBy" },
  PriceList: { created: "createdBy", updated: "updatedBy" },
  Bundle: { created: "createdBy", updated: "updatedBy" },
  SalesAgent: { created: "createdBy", updated: "updatedBy" },
  Lead: { created: "createdBy", updated: "updatedBy" },
  Quotation: { created: "createdBy", updated: "updatedBy" },
  SalesOrder: { created: "createdBy", updated: "updatedBy" },
  SalesReturn: { created: "createdBy", updated: "updatedBy" },
  Team: { created: "createdBy", updated: "updatedBy" },
  Task: { created: "createdBy", updated: "updatedBy" },
  LeadActivity: { created: "createdBy" },
  TaskComment: { created: "userId" },
  DailyReportComment: { created: "userId" },
};

async function run() {
  if (!IS_LOCAL) { console.error("[backfill] refuse: non-local DB"); process.exit(2); }
  let totalC = 0, totalU = 0;
  for (const [table, cols] of Object.entries(MAP)) {
    if (cols.created) {
      const where = `"createdById" IS NULL AND "${cols.created}" IS NOT NULL AND "${cols.created}" IN (SELECT id FROM "User")`;
      const n = Number((await prisma.$queryRawUnsafe<any[]>(`SELECT count(*)::int n FROM "${table}" WHERE ${where}`))[0].n);
      if (n && !DRY) await prisma.$executeRawUnsafe(`UPDATE "${table}" SET "createdById" = "${cols.created}" WHERE ${where}`);
      if (n) { console.log(`${table}.createdById: ${DRY ? "would set" : "set"} ${n}`); totalC += n; }
    }
    if (cols.updated) {
      const where = `"updatedById" IS NULL AND "${cols.updated}" IS NOT NULL AND "${cols.updated}" IN (SELECT id FROM "User")`;
      const n = Number((await prisma.$queryRawUnsafe<any[]>(`SELECT count(*)::int n FROM "${table}" WHERE ${where}`))[0].n);
      if (n && !DRY) await prisma.$executeRawUnsafe(`UPDATE "${table}" SET "updatedById" = "${cols.updated}" WHERE ${where}`);
      if (n) { console.log(`${table}.updatedById: ${DRY ? "would set" : "set"} ${n}`); totalU += n; }
    }
  }
  console.log(`\n[backfill] ${DRY ? "DRY " : ""}createdById total=${totalC}  updatedById total=${totalU}`);
  await prisma.$disconnect();
}
run().catch(async (e) => { console.error(e); try { await prisma.$disconnect(); } catch { /* */ } process.exit(1); });
