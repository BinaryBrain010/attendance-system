-- Impersonation ("login as user"): session table + audit/activity attribution columns.

-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN     "impersonatorId" VARCHAR(36);

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "impersonationId" VARCHAR(36),
ADD COLUMN     "impersonatorId" VARCHAR(36);

-- CreateTable
CREATE TABLE "ImpersonationSession" (
    "id" VARCHAR(36) NOT NULL,
    "impersonatorId" VARCHAR(36) NOT NULL,
    "targetUserId" VARCHAR(36) NOT NULL,
    "reason" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "ImpersonationSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImpersonationSession_impersonatorId_idx" ON "ImpersonationSession"("impersonatorId");

-- CreateIndex
CREATE INDEX "ImpersonationSession_targetUserId_idx" ON "ImpersonationSession"("targetUserId");

-- CreateIndex
CREATE INDEX "ImpersonationSession_startedAt_idx" ON "ImpersonationSession"("startedAt");

-- CreateIndex
CREATE INDEX "AuditLog_impersonatorId_idx" ON "AuditLog"("impersonatorId");
