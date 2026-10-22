-- Phase 3b: user suspension (additive, nullable). Null = active.
ALTER TABLE "User" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "suspendedById" VARCHAR(36);
