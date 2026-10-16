-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "createdById" VARCHAR(36),
ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "AttendanceRequest" ADD COLUMN     "createdById" VARCHAR(36),
ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "createdById" VARCHAR(36),
ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "Bundle" ADD COLUMN     "createdById" VARCHAR(36),
ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "createdById" VARCHAR(36),
ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "createdById" VARCHAR(36),
ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "DailyReport" ADD COLUMN     "createdById" VARCHAR(36),
ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "DailyReportComment" ADD COLUMN     "createdById" VARCHAR(36);

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "createdById" VARCHAR(36),
ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "FeaturePermission" ADD COLUMN     "createdById" VARCHAR(36),
ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "GatePass" ADD COLUMN     "createdById" VARCHAR(36),
ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "createdById" VARCHAR(36),
ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "Holiday" ADD COLUMN     "createdById" VARCHAR(36),
ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "createdById" VARCHAR(36),
ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "createdById" VARCHAR(36),
ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "LeadActivity" ADD COLUMN     "createdById" VARCHAR(36);

-- AlterTable
ALTER TABLE "LeaveAllocation" ADD COLUMN     "createdById" VARCHAR(36),
ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "LeaveConfiguration" ADD COLUMN     "createdById" VARCHAR(36),
ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "createdById" VARCHAR(36),
ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "PriceList" ADD COLUMN     "createdById" VARCHAR(36),
ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "createdById" VARCHAR(36),
ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "createdById" VARCHAR(36),
ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "createdById" VARCHAR(36),
ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "SalesAgent" ADD COLUMN     "createdById" VARCHAR(36),
ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN     "createdById" VARCHAR(36),
ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "SalesReturn" ADD COLUMN     "createdById" VARCHAR(36),
ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "createdById" VARCHAR(36),
ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "ShiftAssignment" ADD COLUMN     "createdById" VARCHAR(36),
ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "SystemConfig" ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "TaskComment" ADD COLUMN     "createdById" VARCHAR(36);

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "createdById" VARCHAR(36),
ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "createdById" VARCHAR(36),
ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdById" VARCHAR(36),
ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- AlterTable
ALTER TABLE "Visitor" ADD COLUMN     "createdById" VARCHAR(36),
ADD COLUMN     "deletedById" VARCHAR(36),
ADD COLUMN     "updatedById" VARCHAR(36);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" VARCHAR(36) NOT NULL,
    "module" TEXT,
    "entity" TEXT NOT NULL,
    "entityId" VARCHAR(36),
    "action" TEXT NOT NULL,
    "changes" JSONB,
    "userId" VARCHAR(36),
    "ip" TEXT,
    "userAgent" TEXT,
    "platform" TEXT,
    "requestId" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

