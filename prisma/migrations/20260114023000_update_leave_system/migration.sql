-- AlterTable
-- Add leaveAllocationId and leaveType to LeaveRequest
-- This migration is safe and will not delete or modify any existing data
ALTER TABLE "LeaveRequest" ADD COLUMN "leaveAllocationId" VARCHAR(36);
ALTER TABLE "LeaveRequest" ADD COLUMN "leaveType" VARCHAR(50) DEFAULT 'CASUAL';

-- AlterTable
-- Add usedDays and remainingDays to LeaveAllocation
-- Initialize with default values based on existing data
ALTER TABLE "LeaveAllocation" ADD COLUMN "usedDays" INTEGER DEFAULT 0;
ALTER TABLE "LeaveAllocation" ADD COLUMN "remainingDays" INTEGER DEFAULT 0;

-- Update existing LeaveAllocation records to calculate usedDays and remainingDays
-- This calculates used days from approved leave requests
-- Note: For existing records, we'll set defaults. The application will calculate actual values on first use.
UPDATE "LeaveAllocation" 
SET 
  "usedDays" = 0,
  "remainingDays" = "assignedDays"
WHERE "isDeleted" IS NULL 
  AND "usedDays" IS NULL;

-- Ensure remainingDays is not negative
UPDATE "LeaveAllocation" 
SET "remainingDays" = 0 
WHERE "remainingDays" < 0;

-- AddForeignKey
-- Create foreign key relationship from LeaveRequest to LeaveAllocation
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_leaveAllocationId_fkey" 
FOREIGN KEY ("leaveAllocationId") REFERENCES "LeaveAllocation"("id") 
ON DELETE SET NULL ON UPDATE CASCADE;
