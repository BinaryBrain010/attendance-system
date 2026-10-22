-- 5d: Holiday metadata — type, optional range endDate, yearly recurring, and unit scope.
ALTER TABLE "Holiday" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);
ALTER TABLE "Holiday" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'PUBLIC';
ALTER TABLE "Holiday" ADD COLUMN IF NOT EXISTS "recurring" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Holiday" ADD COLUMN IF NOT EXISTS "unitIds" TEXT[] NOT NULL DEFAULT '{}';
