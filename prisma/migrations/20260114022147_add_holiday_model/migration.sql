-- CreateTable
-- This migration adds the Holiday table without affecting any existing data
-- The migration is safe and will not delete or modify any existing tables or data
-- IMPORTANT: This migration only creates a new table. It does NOT:
--   - Drop any existing tables
--   - Alter any existing tables
--   - Delete any existing data
--   - Modify any existing columns

CREATE TABLE "Holiday" (
    "id" VARCHAR(36) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "isDeleted" TIMESTAMP(3),
    "createdBy" VARCHAR(36),
    "updatedBy" VARCHAR(36),
    "previousUpdates" JSONB,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Create an index on date for faster queries
CREATE INDEX "Holiday_date_idx" ON "Holiday"("date");

-- CreateIndex
-- Create an index on isDeleted for faster filtering
CREATE INDEX "Holiday_isDeleted_idx" ON "Holiday"("isDeleted");
