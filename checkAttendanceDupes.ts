/**
 * READ-ONLY diagnostic: find duplicate Attendance rows — more than one non-deleted row for the same
 * employee on the same Pakistan calendar day. Writes NOTHING.
 *
 * "PK day" = the Asia/Karachi calendar day of the row's `date`. The column is `timestamp without time
 * zone` holding the UTC wall-clock (see src/core/utils/pakistanDay.ts), so the day is
 * `(date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Karachi')::date`. This buckets rows correctly even when
 * two writers stored different instants for the same day (e.g. Quick Mark stores PKT-midnight
 * 19:00Z-prev-day, while the holiday job stores server-local midnight) — the very mismatch that
 * produces duplicates.
 *
 * Output:
 *   1. Totals: duplicate groups, extra rows, employees/days affected, date span.
 *   2. Breakdown of extra rows by inferred source (so you can see what's generating them).
 *   3. Top 20 worst (employee, day) groups, every row shown: status, check-in/out, inferred source,
 *      createdBy, createdAt — so the collision pattern (e.g. absent-cron ABSENT + scan PRESENT) is plain.
 *
 *   npx ts-node checkAttendanceDupes.ts                 # local DB
 *   npx ts-node checkAttendanceDupes.ts --top 40        # show more groups
 *   npx ts-node checkAttendanceDupes.ts --allow-remote  # against a non-local DATABASE_URL
 */
import prisma from "./src/core/models/base.model";

const DB = process.env.DATABASE_URL || "";
const host = (() => { try { return DB.split("://")[1].split("@").pop()!.split("/")[0].split(":")[0]; } catch { return ""; } })();
if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && !process.argv.includes("--allow-remote")) {
  console.error(`[checkAttendanceDupes] REFUSING — DATABASE_URL host "${host}" is not local (pass --allow-remote).`);
  process.exit(2);
}
const TOP = (() => { const i = process.argv.indexOf("--top"); return i >= 0 ? Math.max(1, parseInt(process.argv[i + 1], 10) || 20) : 20; })();

const PK_DAY = `(a.date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Karachi')::date`;
const PKT = (d: Date | null) => (d ? new Date(d).toLocaleString("en-GB", { timeZone: "Asia/Karachi", hour12: false }) : "—");
const HHMM = (d: Date | null) => (d ? new Date(d).toLocaleTimeString("en-GB", { timeZone: "Asia/Karachi", hour12: false }).slice(0, 5) : "—");

/** Best-effort source of a row (there is no stored `source` column — inferred from the row's shape). */
function inferSource(r: any): string {
  const c = String(r.comment || "").toLowerCase();
  if (r.status === "HOLIDAYS") return "holiday-job";
  if (r.status === "ON_LEAVE") return "leave-approval";
  if (r.status === "ABSENT" && !r.checkIn && !r.createdBy) return "absent-cron";
  if (c.includes("early check-out") || r.checkIn || r.checkOut) return "quickmark/scan";
  if (r.createdBy) return "manual (user)";
  if (r.status === "ABSENT") return "absent (no actor)";
  return "unknown";
}

async function main() {
  console.log(`\n[checkAttendanceDupes] host=${host}  READ-ONLY  grouping=employee+PK-day(Asia/Karachi)\n`);

  // 1) Totals ---------------------------------------------------------------------------------------
  const totals = (await prisma.$queryRawUnsafe(`
    WITH d AS (
      SELECT a.id, a."employeeId", ${PK_DAY} AS pk_day
      FROM "Attendance" a WHERE a."isDeleted" IS NULL
    ), g AS (
      SELECT "employeeId", pk_day, COUNT(*)::int AS cnt
      FROM d GROUP BY "employeeId", pk_day HAVING COUNT(*) > 1
    )
    SELECT
      COALESCE(COUNT(*),0)::int                              AS dup_groups,
      COALESCE(SUM(cnt - 1),0)::int                          AS extra_rows,
      COALESCE(COUNT(DISTINCT "employeeId"),0)::int          AS employees_affected,
      COALESCE(MIN(pk_day)::text,'—')                        AS first_day,
      COALESCE(MAX(pk_day)::text,'—')                        AS last_day,
      COALESCE(MAX(cnt),0)::int                              AS worst_rows_in_a_day
    FROM g
  `) as any[])[0];

  const grand = (await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS n FROM "Attendance" a WHERE a."isDeleted" IS NULL`
  ) as any[])[0];

  console.log(`Total non-deleted Attendance rows : ${grand.n}`);
  console.log(`Duplicate (employee, day) groups  : ${totals.dup_groups}`);
  console.log(`Extra rows (would be archived)    : ${totals.extra_rows}`);
  console.log(`Employees affected                : ${totals.employees_affected}`);
  console.log(`Affected day span                 : ${totals.first_day} … ${totals.last_day}`);
  console.log(`Worst single day (rows)           : ${totals.worst_rows_in_a_day}`);

  if (totals.dup_groups === 0) {
    console.log(`\nNo duplicates. Nothing to clean.\n`);
    return;
  }

  // 2) Extra rows by inferred source ---------------------------------------------------------------
  //    For every dup group, the "extra" rows are all but the one the merge rule keeps. We approximate
  //    the source breakdown over ALL rows in dup groups (the keeper included) to show what collides.
  const dupRows = await prisma.$queryRawUnsafe(`
    WITH d AS (
      SELECT a.*, ${PK_DAY} AS pk_day FROM "Attendance" a WHERE a."isDeleted" IS NULL
    ), g AS (
      SELECT "employeeId", pk_day FROM d GROUP BY "employeeId", pk_day HAVING COUNT(*) > 1
    )
    SELECT d.id, d."employeeId", d.pk_day, d.status, d."checkIn", d."checkOut",
           d.comment, d."createdBy", d."createdAt"
    FROM d JOIN g USING ("employeeId", pk_day)
  `) as any[];

  const bySource = new Map<string, number>();
  const byStatus = new Map<string, number>();
  for (const r of dupRows) {
    bySource.set(inferSource(r), (bySource.get(inferSource(r)) || 0) + 1);
    byStatus.set(r.status, (byStatus.get(r.status) || 0) + 1);
  }
  console.log(`\nRows inside duplicate groups, by inferred source (${dupRows.length} rows):`);
  [...bySource.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`   ${String(v).padStart(6)}  ${k}`));
  console.log(`Rows inside duplicate groups, by status:`);
  [...byStatus.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`   ${String(v).padStart(6)}  ${k}`));

  // 3) Top groups -----------------------------------------------------------------------------------
  const groups = await prisma.$queryRawUnsafe(`
    WITH d AS (
      SELECT a.id, a."employeeId", ${PK_DAY} AS pk_day FROM "Attendance" a WHERE a."isDeleted" IS NULL
    )
    SELECT d."employeeId", d.pk_day::text AS pk_day, COUNT(*)::int AS cnt,
           e.code, e.name, e.surname
    FROM d JOIN "Employee" e ON e.id = d."employeeId"
    GROUP BY d."employeeId", d.pk_day, e.code, e.name, e.surname
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC, d.pk_day DESC
    LIMIT ${TOP}
  `) as any[];

  console.log(`\nTop ${groups.length} duplicate groups (worst first):\n`);
  for (const g of groups) {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT a.id, a.status, a."checkIn", a."checkOut", a.comment, a."createdBy",
             a."createdById", a."createdAt", a."updatedAt"
      FROM "Attendance" a
      WHERE a."isDeleted" IS NULL AND a."employeeId" = $1
        AND ${PK_DAY} = $2::date
      ORDER BY a."createdAt" ASC NULLS FIRST, a.id ASC
    `, g.employeeId, g.pk_day) as any[];

    const name = `${g.name || ""} ${g.surname || ""}`.trim();
    console.log(`● ${g.code || "(no code)"}  ${name}  —  ${g.pk_day}  —  ${g.cnt} rows`);
    console.log(`    ${"status".padEnd(9)} ${"check-in".padEnd(6)} ${"check-out".padEnd(9)} ${"source".padEnd(18)} ${"createdBy".padEnd(10)} created`);
    for (const r of rows) {
      const src = inferSource(r);
      const by = r.createdBy ? String(r.createdBy).slice(0, 8) : (r.createdById ? String(r.createdById).slice(0, 8) : "—");
      console.log(`    ${String(r.status).padEnd(9)} ${HHMM(r.checkIn).padEnd(6)} ${HHMM(r.checkOut).padEnd(9)} ${src.padEnd(18)} ${by.padEnd(10)} ${PKT(r.createdAt)}`);
    }
    console.log("");
  }

  console.log(`Merge rule the cleanup will apply: keep the row with a check-in (then check-out), else the`);
  console.log(`most recently created; archive the rest (set isDeleted). Run cleanAttendanceDupes.ts --apply.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
