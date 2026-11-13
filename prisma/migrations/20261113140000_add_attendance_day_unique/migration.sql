-- Guard against duplicate Attendance rows: at most ONE active (non-deleted) row per employee per
-- Pakistan calendar day. This is the DB-level stop for the duplicates that absent-cron races, repeated
-- historical imports, and the no-dedup /attendance/create path were producing.
--
-- Why this expression (not a plain @@unique on (employeeId, date)):
--   * `date` is `timestamp without time zone` holding the UTC wall-clock, and different writers store
--     different instants for the SAME day (Quick Mark stores Pakistan-midnight = 19:00Z the prior day;
--     the holiday/import paths stored server-local midnight). A plain unique on the raw timestamp would
--     NOT catch those cross-instant duplicates.
--   * Pakistan is a fixed UTC+5 offset with no DST, so the Pakistan calendar day is exactly
--     (date + interval '5 hours')::date. `timestamp + interval` and the `::date` cast are IMMUTABLE, so
--     the expression is indexable (AT TIME ZONE is only STABLE and would be rejected).
--   * PARTIAL (WHERE "isDeleted" IS NULL) so soft-deleted/archived rows never occupy the slot — the
--     dedup cleanup archives extras by setting isDeleted, and a later real row for that day must still
--     be insertable.
--
-- PRE-REQUISITE: the table must already be free of active duplicates, or CREATE UNIQUE INDEX fails.
-- Run `npx ts-node cleanAttendanceDupes.ts --apply` first (it soft-deletes extras by the merge rule).
CREATE UNIQUE INDEX IF NOT EXISTS "Attendance_employee_pktday_active_uq"
  ON "Attendance" ("employeeId", ((date + interval '5 hours')::date))
  WHERE "isDeleted" IS NULL;
