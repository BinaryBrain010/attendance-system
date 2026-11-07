-- Lead Review: reviewer colour-flags on a lead or a single timeline entry, optionally sent to the
-- owner's My Day with an instruction + due date. Additive; no existing data touched.
CREATE TYPE "ReviewColour" AS ENUM ('RED', 'AMBER', 'GREEN');
CREATE TYPE "ReviewStatus" AS ENUM ('OPEN', 'DONE');
CREATE TYPE "LeadReviewTarget" AS ENUM ('LEAD', 'ACTIVITY', 'NOTE', 'STAGE', 'QUOTATION', 'FOLLOWUP');

CREATE TABLE "LeadReview" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "targetType" "LeadReviewTarget" NOT NULL DEFAULT 'LEAD',
    "targetId" TEXT,
    "colour" "ReviewColour" NOT NULL,
    "comment" TEXT,
    "instruction" TEXT,
    "dueAt" TIMESTAMP(3),
    "sentToMyDay" BOOLEAN NOT NULL DEFAULT false,
    "status" "ReviewStatus" NOT NULL DEFAULT 'OPEN',
    "reviewerId" VARCHAR(36) NOT NULL,
    "ownerId" VARCHAR(36),
    "reply" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "isDeleted" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdById" VARCHAR(36),
    "updatedById" VARCHAR(36),
    "deletedById" VARCHAR(36),
    CONSTRAINT "LeadReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeadReview_leadId_idx" ON "LeadReview"("leadId");
CREATE INDEX "LeadReview_ownerId_status_idx" ON "LeadReview"("ownerId", "status");
CREATE INDEX "LeadReview_reviewerId_idx" ON "LeadReview"("reviewerId");
CREATE INDEX "LeadReview_status_idx" ON "LeadReview"("status");
