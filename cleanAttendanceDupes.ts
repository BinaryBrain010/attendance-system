/**
 * Collapse duplicate Attendance rows — more than one non-deleted row for the same employee on the same
 * Pakistan calendar day (see checkAttendanceDupes.ts for the diagnosis). DRY-RUN by default: writes
 * nothing unless --apply. Never hard-deletes — "extras" are ARCHIVED by setting `isDeleted` (the
 * model's soft-delete), so the action is fully reversible with --revert.
 *
 * MERGE RULE — within each (employee, PK-day) group, keep ONE row, archive the rest. The keeper is the
 * most authoritative row, chosen in this order (first match wins):
 *   1. has a check-in            (a real check-in beats an auto row)           ← "keep the row with check-in"
 *   2. has a check-out           (then a check-out)                            ← "...check-in/out"
 *   3. status is not ABSENT      (a real PRESENT/LATE/ON_LEAVE/HOLIDAYS beats an auto-ABSENT)
 *   4. created most recently     (the latest write)                            ← "...else latest"
 *   5. highest id                (stable tie-break)
 * Archived rows are tagged `comment = '[dup-archived] <original>'` and `deletedById = SYSTEM`, so the
 * set is identifiable and --revert can restore exactly these rows.
 *
 *   npx ts-node cleanAttendanceDupes.ts                 # DRY RUN — show what would be archived
 *   npx ts-node cleanAttendanceDupes.ts --apply         # WRITE — archive extras (soft-delete)
 *   npx ts-node cleanAttendanceDupes.ts --revert        # DRY RUN of the undo
 *   npx ts-node cleanAttendanceDupes.ts --revert --apply # WRITE — un-archive rows this tool archived
 *   npx ts-node cleanAttendanceDupes.ts --allow-remote  # against a non-local DATABASE_URL
 */
import prisma from "./src/core/models/base.model";
import { SYSTEM_USER_ID } from "./src/core/context/requestContext";

const DB = process.env.DATABASE_URL || "";
const host = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && !process.argv.includes("--allow-remote")) {
  console.error(`[cleanAttendanceDupes] REFUSING — DATABASE_URL host "${host}" is not local (pass --allow-remote).`);
  process.exit(2);
}
const APPLY = process.argv.includes("--apply");
const REVERT = process.argv.includes("--revert");
const SAMPLE = (() => { const i = process.argv.indexOf("--sample"); return i >= 0 ? Math.max(0, parseInt(process.argv[i + 1], 10) || 0) : 12; })();
const TAG = "[dup-archived]";
const PK_DAY = `(a.date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Karachi')::date`;
const PKT = (d: Date | null) => (d ? new Date(d).toLocaleString("en-GB", { timeZone: "Asia/Karachi", hour12: false }) : "—");

/** Keeper-first comparator implementing the merge rule. a before b ⇒ a is kept. */
function keeperFirst(a: any, b: any): number {
  const ci = (!!b.checkIn ? 1 : 0) - (!!a.checkIn ? 1 : 0); if (ci) return ci;
  const co = (!!b.checkOut ? 1 : 0) - (!!a.checkOut ? 1 : 0); if (co) return co;
  const ab = (a.status === "ABSENT" ? 1 : 0) - (b.status === "ABSENT" ? 1 : 0); if (ab) return ab;
  const ca = new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(); if (ca) return ca;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

async function chunked(ids: string[], size: number, fn: (c: string[]) => Promise<void>) {
  for (let i = 0; i < ids.length; i += size) await fn(ids.slice(i, i + size));
}

async function doRevert() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, comment FROM "Attendance" WHERE "isDeleted" IS NOT NULL AND "deletedById" = $1 AND comment LIKE $2`,
    SYSTEM_USER_ID, `${TAG}%`
  ) as any[];
  console.log(`\n[cleanAttendanceDupes] REVERT  mode=${APPLY ? "APPLY (writing)" : "DRY RUN"}  rows this tool archived: ${rows.length}\n`);
  if (!rows.length) { console.log("Nothing to revert.\n"); return; }
  if (!APPLY) { console.log(`Would un-archive ${rows.length} rows (clear isDeleted, strip the "${TAG} " comment tag). Re-run with --apply.\n`); return; }
  const ids = rows.map((r) => r.id);
  await chunked(ids, 500, async (c) => {
    await prisma.$executeRawUnsafe(
      `UPDATE "Attendance" SET "isDeleted" = NULL, "deletedById" = NULL, "updatedAt" = now(),
         comment = regexp_replace(comment, '^\\[dup-archived\\] ?', '')
       WHERE id = ANY($1::text[])`, c
    );
  });
  console.log(`Reverted ${ids.length} rows.\n`);
}

async function main() {
  if (REVERT) return doRevert();

  // All rows in duplicate (employee, PK-day) groups, with the employee label.
  const rows = await prisma.$queryRawUnsafe(`
    WITH d AS (
      SELECT a.*, ${PK_DAY} AS pk_day FROM "Attendance" a WHERE a."isDeleted" IS NULL
    ), g AS (
      SELECT "employeeId", pk_day FROM d GROUP BY "employeeId", pk_day HAVING COUNT(*) > 1
    )
    SELECT d.id, d."employeeId", d.pk_day::text AS pk_day, d.status, d."checkIn", d."checkOut",
           d.comment, d."createdBy", d."createdAt", e.code, e.name, e.surname
    FROM d JOIN g USING ("employeeId", pk_day)
    JOIN "Employee" e ON e.id = d."employeeId"
  `) as any[];

  console.log(`\n[cleanAttendanceDupes] host=${host}  mode=${APPLY ? "APPLY (writing)" : "DRY RUN"}  tz=Asia/Karachi`);

  if (!rows.length) { console.log(`\nNo duplicates. Nothing to archive.\n`); return; }

  // Group by employee+day, pick keeper, collect archive ids.
  const groups = new Map<string, any[]>();
  for (const r of rows) {
    const k = `${r.employeeId}|${r.pk_day}`;
    (groups.get(k) || groups.set(k, []).get(k)!).push(r);
  }

  const archiveIds: string[] = [];
  const sample: string[] = [];
  let keptWithCheckIn = 0, keptNonAbsent = 0, keptAbsent = 0;
  for (const [, g] of groups) {
    g.sort(keeperFirst);
    const keep = g[0];
    const drop = g.slice(1);
    archiveIds.push(...drop.map((r) => r.id));
    if (keep.checkIn) keptWithCheckIn++; else if (keep.status === "ABSENT") keptAbsent++; else keptNonAbsent++;
    if (sample.length < SAMPLE) {
      const name = `${keep.code || "(no code)"} ${keep.name || ""} ${keep.surname || ""}`.trim();
      const line = [`● ${name}  —  ${keep.pk_day}  (${g.length} rows → keep 1, archive ${drop.length})`];
      line.push(`    KEEP    ${String(keep.status).padEnd(9)} in=${keep.checkIn ? "y" : "-"} out=${keep.checkOut ? "y" : "-"}  created ${PKT(keep.createdAt)}`);
      for (const r of drop) line.push(`    archive ${String(r.status).padEnd(9)} in=${r.checkIn ? "y" : "-"} out=${r.checkOut ? "y" : "-"}  created ${PKT(r.createdAt)}`);
      sample.push(line.join("\n"));
    }
  }

  console.log(`Duplicate groups        : ${groups.size}`);
  console.log(`Rows to archive (extras): ${archiveIds.length}`);
  console.log(`Keepers with a check-in : ${keptWithCheckIn}`);
  console.log(`Keepers non-ABSENT      : ${keptNonAbsent}`);
  console.log(`Keepers ABSENT (no real row existed for the day): ${keptAbsent}`);

  if (sample.length) {
    console.log(`\nSample (${sample.length} groups):\n`);
    console.log(sample.join("\n\n"));
  }

  if (!APPLY) {
    console.log(`\nDRY RUN — nothing written. Re-run with --apply to archive the ${archiveIds.length} extra rows`);
    console.log(`(sets isDeleted + deletedById=SYSTEM, tags comment "${TAG} …"; reversible with --revert --apply).\n`);
    return;
  }

  // APPLY: soft-delete the extras. Raw UPDATE so the comment tag is prepended per-row in one statement.
  let done = 0;
  await chunked(archiveIds, 500, async (c) => {
    const n = await prisma.$executeRawUnsafe(
      `UPDATE "Attendance"
         SET "isDeleted" = now(), "deletedById" = $2, "updatedAt" = now(),
             comment = CASE WHEN comment LIKE $3 THEN comment ELSE $4 || ' ' || COALESCE(comment,'') END
       WHERE id = ANY($1::text[]) AND "isDeleted" IS NULL`,
      c, SYSTEM_USER_ID, `${TAG}%`, TAG
    );
    done += Number(n) || 0;
  });
  console.log(`\nArchived ${done} duplicate rows (soft-delete). Re-run checkAttendanceDupes.ts to confirm 0 groups.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
