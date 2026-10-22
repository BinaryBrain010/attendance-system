/**
 * 6c visitor → unit backfill. READ-ONLY by default: reports how many existing visitors have no unit
 * and which unit they would be assigned (the "head office" unit, else the oldest unit). Re-runnable.
 *   npx ts-node dryRunVisitorBackfill.ts                      (local, dry run)
 *   npx ts-node dryRunVisitorBackfill.ts --apply              (local, writes)
 *   npx ts-node dryRunVisitorBackfill.ts --apply --allow-remote   (prod, writes)
 * Pass --unit=<unitId> to force a specific target unit.
 */
import prisma from "./src/core/models/base.model";
import { runAsSystem } from "./src/core/context/requestContext";

const APPLY = process.argv.includes("--apply");
const DB = process.env.DATABASE_URL || "";
const host = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
if (APPLY && !["localhost", "127.0.0.1", "[::1]"].includes(host) && !process.argv.includes("--allow-remote")) {
  console.error(`[visitorBackfill] REFUSING to write — DATABASE_URL host "${host}" is not local. Add --allow-remote for prod.`);
  process.exit(2);
}

async function main() {
  const forced = process.argv.find((a) => a.startsWith("--unit="))?.split("=")[1];

  let target: { id: string; name: string } | null = null;
  if (forced) {
    target = await prisma.unit.findUnique({ where: { id: forced }, select: { id: true, name: true } });
  } else {
    target =
      (await prisma.unit.findFirst({
        where: { isDeleted: null, name: { contains: "head office", mode: "insensitive" } },
        select: { id: true, name: true },
      })) ||
      (await prisma.unit.findFirst({
        where: { isDeleted: null },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true },
      }));
  }

  const unscoped = await prisma.visitor.count({ where: { isDeleted: null, unitId: null } });
  const total = await prisma.visitor.count({ where: { isDeleted: null } });

  console.log(`[visitorBackfill] host=${host} apply=${APPLY}`);
  console.log(`[visitorBackfill] visitors total=${total}, without a unit=${unscoped}`);
  if (!target) {
    console.error(`[visitorBackfill] No unit found to assign. Create a unit (e.g. "Head Office") first, or pass --unit=<id>.`);
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log(`[visitorBackfill] target unit: ${target.name} (${target.id})`);

  if (!APPLY) {
    console.log(`[visitorBackfill] DRY RUN — would set unitId=${target.id} on ${unscoped} visitor(s). Re-run with --apply to write.`);
  } else {
    const res = await prisma.visitor.updateMany({
      where: { isDeleted: null, unitId: null },
      data: { unitId: target.id },
    });
    console.log(`[visitorBackfill] APPLIED — updated ${res.count} visitor(s) to unit ${target.id}.`);
  }
  await prisma.$disconnect();
}

runAsSystem(() => main()).catch((e) => { console.error("[visitorBackfill] error", e); process.exit(1); });
