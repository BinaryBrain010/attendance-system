-- CreateEnum
CREATE TYPE "VisitorOutcome" AS ENUM ('ENQUIRY', 'PURCHASED', 'REPLACED', 'RECEIVED', 'NO_ACTION', 'OTHER');

-- CreateTable
CREATE TABLE "Visitor" (
    "id" VARCHAR(36) NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "cnic" TEXT,
    "vehicleNo" TEXT,
    "company" TEXT,
    "purpose" TEXT,
    "referredToText" TEXT,
    "referredToEmployeeId" VARCHAR(36),
    "visitDate" TIMESTAMP(3) NOT NULL,
    "timeIn" TIMESTAMP(3),
    "timeOut" TIMESTAMP(3),
    "outcome" "VisitorOutcome" NOT NULL DEFAULT 'ENQUIRY',
    "purchased" BOOLEAN NOT NULL DEFAULT false,
    "purchaseAmount" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "isDeleted" TIMESTAMP(3),
    "createdBy" VARCHAR(36),
    "updatedBy" VARCHAR(36),
    "previousUpdates" JSONB,

    CONSTRAINT "Visitor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Visitor_visitDate_idx" ON "Visitor"("visitDate");

-- CreateIndex
CREATE INDEX "Visitor_referredToEmployeeId_idx" ON "Visitor"("referredToEmployeeId");

-- CreateIndex
CREATE INDEX "Visitor_outcome_idx" ON "Visitor"("outcome");

-- CreateIndex
CREATE INDEX "Visitor_isDeleted_idx" ON "Visitor"("isDeleted");

-- AddForeignKey
ALTER TABLE "Visitor" ADD CONSTRAINT "Visitor_referredToEmployeeId_fkey" FOREIGN KEY ("referredToEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
