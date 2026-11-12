-- HR Policy + Quick Mark Reports. All additive; no existing data changed.

-- 1. New employee state for probation + decision-type enum.
ALTER TYPE "EmployeeStatus" ADD VALUE IF NOT EXISTS 'PROBATION';
CREATE TYPE "ProbationDecisionType" AS ENUM ('CONFIRM', 'EXTEND', 'TERMINATE');

-- 2. Employee: probation tracking (defaults derived from joining + global months).
ALTER TABLE "Employee" ADD COLUMN "probationEndDate"   TIMESTAMP(3);
ALTER TABLE "Employee" ADD COLUMN "probationClearedAt" TIMESTAMP(3);

-- 3. LeaveAllocation: mark policy-generated entitlements so apply is idempotent + manual adjust reason.
ALTER TABLE "LeaveAllocation" ADD COLUMN "source"       VARCHAR(16) DEFAULT 'MANUAL';
ALTER TABLE "LeaveAllocation" ADD COLUMN "policyYear"   INTEGER;
ALTER TABLE "LeaveAllocation" ADD COLUMN "manualReason" TEXT;

-- 4. HR policy rules (bands by length of service, versioned by effectiveFrom).
CREATE TABLE "HrPolicyRule" (
    "id"              TEXT NOT NULL,
    "minYears"        INTEGER NOT NULL,
    "maxYears"        INTEGER,
    "annualLeaveDays" INTEGER NOT NULL DEFAULT 0,
    "leaveByType"     JSONB,
    "medicalEligible" BOOLEAN NOT NULL DEFAULT false,
    "notes"           TEXT,
    "effectiveFrom"   TIMESTAMP(3) NOT NULL,
    "isActive"        BOOLEAN NOT NULL DEFAULT true,
    "createdAt"       TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3),
    "isDeleted"       TIMESTAMP(3),
    "createdById"     VARCHAR(36),
    "updatedById"     VARCHAR(36),
    "deletedById"     VARCHAR(36),
    CONSTRAINT "HrPolicyRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HrPolicyRule_effectiveFrom_idx" ON "HrPolicyRule"("effectiveFrom");

-- 5. Probation decisions (audit of confirm / extend / terminate).
CREATE TABLE "ProbationDecision" (
    "id"              TEXT NOT NULL,
    "employeeId"      VARCHAR(36) NOT NULL,
    "decision"        "ProbationDecisionType" NOT NULL,
    "previousEndDate" TIMESTAMP(3),
    "newEndDate"      TIMESTAMP(3),
    "reason"          TEXT,
    "decidedById"     VARCHAR(36),
    "createdAt"       TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "isDeleted"       TIMESTAMP(3),
    "createdById"     VARCHAR(36),
    "updatedById"     VARCHAR(36),
    "deletedById"     VARCHAR(36),
    CONSTRAINT "ProbationDecision_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProbationDecision_employeeId_idx" ON "ProbationDecision"("employeeId");
ALTER TABLE "ProbationDecision" ADD CONSTRAINT "ProbationDecision_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. Monthly HR remark per employee (one per employee/month).
CREATE TABLE "MonthlyReportRemark" (
    "id"          TEXT NOT NULL,
    "employeeId"  VARCHAR(36) NOT NULL,
    "year"        INTEGER NOT NULL,
    "month"       INTEGER NOT NULL,
    "remark"      TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3),
    "isDeleted"   TIMESTAMP(3),
    "createdById" VARCHAR(36),
    "updatedById" VARCHAR(36),
    "deletedById" VARCHAR(36),
    CONSTRAINT "MonthlyReportRemark_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MonthlyReportRemark_employeeId_year_month_key" ON "MonthlyReportRemark"("employeeId", "year", "month");
ALTER TABLE "MonthlyReportRemark" ADD CONSTRAINT "MonthlyReportRemark_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
