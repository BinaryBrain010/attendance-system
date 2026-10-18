/**
 * Backfill `agentId` on existing CRM documents (leads, quotations, sales orders) where it is empty
 * and the document's creator (`createdById`) has a SalesAgent profile. One user maps to at most one
 * agent (`SalesAgent.userId` is unique), so the mapping is unambiguous.
 *
 * DRY RUN BY DEFAULT — prints counts and writes nothing. Pass --apply to perform the updates.
 *
 *   npx ts-node qa/backfillAgentIds.ts                  # dry run (counts only)
 *   npx ts-node qa/backfillAgentIds.ts --apply          # perform the backfill
 *   (prod DB host resolves to "localhost", so no --allow-remote is needed; it is accepted anyway)
 *
 * Never touches rows that already have an agentId, rows with no createdById, or rows whose creator
 * has no agent. Idempotent: re-running after an apply finds nothing left to do.
 */
import "dotenv/config"; // load ~/server/.env (DATABASE_URL) when run as a standalone script
import prisma from "../src/core/models/base.model";

const APPLY = process.argv.includes("--apply");
const ALLOW_REMOTE = process.argv.includes("--allow-remote");
const DB = process.env.DATABASE_URL || "";
const host = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && !ALLOW_REMOTE) {
  console.error(`[backfillAgentIds] REFUSING — DATABASE_URL host "${host}" is not local (pass --allow-remote).`);
  process.exit(2);
}

type Entity = { label: string; model: any };
const ENTITIES: Entity[] = [
  { label: "lead", model: prisma.lead },
  { label: "quotation", model: prisma.quotation },
  { label: "salesOrder", model: prisma.salesOrder },
];

async function main() {
  console.log(`[backfillAgentIds] mode: ${APPLY ? "APPLY (writing)" : "DRY RUN (no writes)"}  db-host: ${host}\n`);
  let grandBackfill = 0;

  for (const e of ENTITIES) {
    // Rows missing an agent but carrying a creator we can resolve.
    const candidates: { createdById: string | null }[] = await e.model.findMany({
      where: { agentId: null, createdById: { not: null }, isDeleted: null },
      select: { createdById: true },
    });
    const noCreator: number = await e.model.count({ where: { agentId: null, createdById: null, isDeleted: null } });

    const creators = Array.from(new Set(candidates.map((c) => c.createdById))) as string[];
    const agents = creators.length
      ? await prisma.salesAgent.findMany({ where: { userId: { in: creators }, isDeleted: null }, select: { id: true, userId: true } })
      : [];
    const agentByUser = new Map<string, string>(agents.map((a: any) => [a.userId as string, a.id as string]));

    let backfillable = 0;
    let skippedNoAgent = 0;
    for (const uid of creators) {
      const n = candidates.filter((c) => c.createdById === uid).length;
      if (agentByUser.has(uid)) backfillable += n;
      else skippedNoAgent += n;
    }

    console.log(`  ${e.label}:`);
    console.log(`    null-agent rows with a creator : ${candidates.length}`);
    console.log(`    -> backfillable (creator has agent): ${backfillable}`);
    console.log(`    -> skipped (creator has no agent)  : ${skippedNoAgent}`);
    console.log(`    null-agent rows with NO creator    : ${noCreator} (cannot backfill)`);

    if (APPLY && backfillable > 0) {
      let written = 0;
      for (const uid of creators) {
        const agentId = agentByUser.get(uid);
        if (!agentId) continue;
        const r = await e.model.updateMany({
          where: { agentId: null, createdById: uid, isDeleted: null },
          data: { agentId },
        });
        written += r.count;
      }
      const after: number = await e.model.count({ where: { agentId: null, createdById: { not: null }, isDeleted: null } });
      console.log(`    APPLIED: ${written} updated; remaining null-agent-with-creator: ${after}`);
    }
    grandBackfill += backfillable;
    console.log("");
  }

  console.log(`[backfillAgentIds] total backfillable across entities: ${grandBackfill}`);
  console.log(APPLY ? "[backfillAgentIds] done (APPLIED)." : "[backfillAgentIds] DRY RUN — nothing written. Re-run with --apply to write.");
  await prisma.$disconnect();
}

main().catch((e) => { console.error("[backfillAgentIds] error", e); process.exit(1); });
