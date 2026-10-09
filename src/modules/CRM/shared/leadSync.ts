/**
 * Auto-advance a lead's stage from downstream document events, and log the change to the lead's
 * timeline (ActivityLog). Never moves a lead backward and never overrides a closed (WON/LOST) lead.
 *   quotation SENT          -> lead QUOTATION (if earlier)
 *   order CONFIRMED or later -> lead WON
 * "all orders cancelled" leaves the lead unchanged (we only sync forward on confirm+).
 */
import prisma from "../../../core/models/base.model";

const LEAD_RANK: Record<string, number> = { DRAFT: 0, ON_HOLD: 1, NEW: 1, CONTACTED: 2, QUALIFIED: 3, QUOTATION: 4, NEGOTIATION: 5, WON: 6, LOST: 6 };

export async function syncLeadStage(userId: string, leadId: string | null | undefined, target: string, note: string): Promise<void> {
  if (!leadId) return;
  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.isDeleted) return;
    if (lead.stage === "WON" || lead.stage === "LOST") return;          // don't override a closed lead
    if ((LEAD_RANK[lead.stage] ?? 0) >= (LEAD_RANK[target] ?? 0)) return; // never move backward
    await prisma.lead.update({ where: { id: leadId }, data: { stage: target as any, updatedBy: userId } });
    await prisma.activityLog.create({
      data: { userId, action: "AUTO_STAGE", entityType: "Lead", entityId: leadId, description: `Auto: ${lead.stage} -> ${target} (${note})`, metadata: { from: lead.stage, to: target, note } as any },
    });
  } catch { /* stage sync must never break the main flow */ }
}
