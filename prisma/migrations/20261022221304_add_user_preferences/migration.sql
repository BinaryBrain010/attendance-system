-- 8d/8e: per-user preferences + app-launcher order.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferences" JSONB;
