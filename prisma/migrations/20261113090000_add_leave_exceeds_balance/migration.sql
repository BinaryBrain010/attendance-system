-- B3: a leave request that exceeds the remaining balance is flagged (not blocked) at create, and can
-- only be APPROVED by a holder of hr.policy.manage.*. Additive; defaults false for all existing rows.
ALTER TABLE "LeaveRequest" ADD COLUMN "exceedsBalance" BOOLEAN NOT NULL DEFAULT false;
