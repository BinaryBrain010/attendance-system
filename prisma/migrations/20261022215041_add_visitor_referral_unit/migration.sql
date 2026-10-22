-- 6b/6c: visitor referral-notification + attend tracking, and owning unit.
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "referredAt" TIMESTAMP(3);
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "attendedAt" TIMESTAMP(3);
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "attendedBy" VARCHAR(36);
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "attendedNote" TEXT;
ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "unitId" VARCHAR(36);
