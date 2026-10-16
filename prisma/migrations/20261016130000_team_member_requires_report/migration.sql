-- Add "requires daily report" to team membership (default true): only required members are
-- "expected" to submit a daily report. Additive, safe default.
ALTER TABLE "TeamMember" ADD COLUMN IF NOT EXISTS "requiresDailyReport" BOOLEAN NOT NULL DEFAULT true;
