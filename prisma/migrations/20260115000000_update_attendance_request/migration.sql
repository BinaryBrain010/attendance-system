-- AlterTable
-- This migration safely adds new columns to AttendanceRequest table
-- The migration is safe and will not delete or modify any existing data
-- IMPORTANT: This migration only adds new columns with NULL defaults. It does NOT:
--   - Drop any existing columns
--   - Delete any existing data
--   - Modify any existing columns
--   - Change any existing constraints

-- Add attendanceId column for linking to attendance record
ALTER TABLE "AttendanceRequest" 
ADD COLUMN IF NOT EXISTS "attendanceId" VARCHAR(36);

-- Add proposed attendance change fields
ALTER TABLE "AttendanceRequest" 
ADD COLUMN IF NOT EXISTS "proposedStatus" VARCHAR(255);

ALTER TABLE "AttendanceRequest" 
ADD COLUMN IF NOT EXISTS "proposedCheckIn" TIMESTAMP(3);

ALTER TABLE "AttendanceRequest" 
ADD COLUMN IF NOT EXISTS "proposedCheckOut" TIMESTAMP(3);

ALTER TABLE "AttendanceRequest" 
ADD COLUMN IF NOT EXISTS "proposedComment" TEXT;

ALTER TABLE "AttendanceRequest" 
ADD COLUMN IF NOT EXISTS "proposedLocation" VARCHAR(255);

ALTER TABLE "AttendanceRequest" 
ADD COLUMN IF NOT EXISTS "proposedDate" TIMESTAMP(3);

-- Add user tracking fields
ALTER TABLE "AttendanceRequest" 
ADD COLUMN IF NOT EXISTS "requestedBy" VARCHAR(36);

ALTER TABLE "AttendanceRequest" 
ADD COLUMN IF NOT EXISTS "approvedBy" VARCHAR(36);

-- All columns are nullable to ensure no data loss
-- Existing records will have NULL values for new columns