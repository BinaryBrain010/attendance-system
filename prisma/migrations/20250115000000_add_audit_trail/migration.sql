-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "createdBy" VARCHAR(36),
ADD COLUMN "updatedBy" VARCHAR(36),
ADD COLUMN "previousUpdates" JSONB;

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN "createdBy" VARCHAR(36),
ADD COLUMN "updatedBy" VARCHAR(36),
ADD COLUMN "previousUpdates" JSONB;
