/**
 * Backfill the human-readable lead code (leadNo = LD-0001..) for leads that don't have one, in
 * CREATED order. DRY RUN by default; pass --apply to write. Refuses a non-local DATABASE_URL unless
 * --allow-remote. Safe to re-run (only fills blanks; continues numbering from the current max).
 *   npx ts-node backfillLeadNo.ts                      # dry run, local
 *   npx ts-node backfillLeadNo.ts --apply              # write, local
 *   npx ts-node backfillLeadNo.ts --apply --allow-remote   # write, prod
 */
import prisma from "./src/core/models/base.model";
import { runAsSystem } from "./src/core/context/requestContext";

const APPLY = process.argv.includes("--apply");
const ALLOW_REMOTE = process.argv.includes("--allow-remote");
const DB = process.env.DATABASE_URL || "";
const host = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && !ALLOW_REMOTE) {
  console.error(`[backfillLeadNo] REFUSING — DATABASE_URL host "${host}" is not local. Re-run with --allow-remote for prod.`); process.exit(2);
}

async function main() {
  // Continue numbering from the current max LD-#### so a re-run never reuses a code.
  const existing = await prisma.lead.findMany({ where: { leadNo: { startsWith: "LD-" } }, select: { leadNo: true } });
  let max = 0;
  for (const r of existing) { const m = (r.leadNo || "").match(/(\d+)/); if (m) max = Math.max(max, parseInt(m[1], 10)); }

  // Every lead without a code, oldest first (tie-break by id for determinism). Includes soft-deleted
  // so a restored lead keeps a stable code.
  const toCode = await prisma.lead.findMany({
    where: { leadNo: null },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, customerName: true, createdAt: true },
  });

  console.log(`\n==================== BACKFILL leadNo ${APPLY ? "(APPLY)" : "(DRY RUN)"} ====================`);
  console.log(`DB host: ${host}${host && !["localhost", "127.0.0.1", "[::1]"].includes(host) ? "  (REMOTE)" : ""}`);
  console.log(`existing coded leads: ${existing.length}  |  current max: LD-${String(max).padStart(4, "0")}`);
  console.log(`leads to code: ${toCode.length}`);
  const fmt = (n: number) => `LD-${String(n).padStart(4, "0")}`;
  if (toCode.length) {
    const preview = toCode.slice(0, 3).map((l, i) => `${fmt(max + 1 + i)} <- ${l.customerName} (${l.createdAt ? new Date(l.createdAt).toISOString().slice(0, 10) : "?"})`);
    const lastN = toCode.length;
    console.log(`first: ${preview.join(" | ")}`);
    console.log(`last:  ${fmt(max + lastN)} <- ${toCode[lastN - 1].customerName}`);
  }

  if (!APPLY) { console.log("\nDRY RUN — no changes. Re-run with --apply to write."); await prisma.$disconnect(); return; }

  let n = max, done = 0;
  for (const l of toCode) {
    n += 1;
    await prisma.lead.update({ where: { id: l.id }, data: { leadNo: fmt(n) } });
    done++;
  }
  console.log(`\nDONE. assigned ${done} codes (LD-${String(max + 1).padStart(4, "0")} .. ${fmt(n)}).`);
  await prisma.$disconnect();
}
runAsSystem(() => main()).catch((e) => { console.error("[backfillLeadNo] error", e); process.exit(1); });
