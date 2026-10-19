-- Gate-pass status workflow: new statuses + a status-history table.

-- AlterEnum (PostgreSQL 12+ allows adding enum values in a transaction as long as they are not used
-- in the same migration, which they are not here).
ALTER TYPE "Status" ADD VALUE 'dispatched';
ALTER TYPE "Status" ADD VALUE 'returned';
ALTER TYPE "Status" ADD VALUE 'closed';
ALTER TYPE "Status" ADD VALUE 'rejected';

-- CreateTable
CREATE TABLE "GatePassStatusHistory" (
    "id" VARCHAR(36) NOT NULL,
    "gatePassId" TEXT NOT NULL,
    "fromStatus" "Status",
    "toStatus" "Status" NOT NULL,
    "reason" TEXT,
    "changedById" VARCHAR(36),
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GatePassStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GatePassStatusHistory_gatePassId_idx" ON "GatePassStatusHistory"("gatePassId");

-- CreateIndex
CREATE INDEX "GatePassStatusHistory_changedAt_idx" ON "GatePassStatusHistory"("changedAt");

-- AddForeignKey
ALTER TABLE "GatePassStatusHistory" ADD CONSTRAINT "GatePassStatusHistory_gatePassId_fkey" FOREIGN KEY ("gatePassId") REFERENCES "GatePass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
