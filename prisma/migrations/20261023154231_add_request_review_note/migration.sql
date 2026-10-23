-- A1: approver note on attendance + leave requests (additive, nullable).
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "reviewNote" TEXT;
ALTER TABLE "AttendanceRequest" ADD COLUMN IF NOT EXISTS "reviewNote" TEXT;
