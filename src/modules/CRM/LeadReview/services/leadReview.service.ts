import prisma from "../../../../core/models/base.model";
import { resolveScope, assertRowInScope } from "../../shared/scope";
import { notify } from "../../../Work/shared/workHelpers";
import { NotFoundError, ValidationError, ForbiddenError } from "../../../../core/errors/app.error";

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";

type NameRow = { id: string; name: string };
async function resolveUserNames(ids: (string | null | undefined)[]): Promise<Record<string, NameRow>> {
  const uniq = Array.from(new Set(ids.filter((x): x is string => !!x)));
  if (!uniq.length) return {};
  const users = await prisma.user.findMany({ where: { id: { in: uniq } }, select: { id: true, username: true, employee: { select: { name: true, surname: true } } } });
  const out: Record<string, NameRow> = {};
  for (const u of users) {
    const nm = u.employee ? `${u.employee.name || ""} ${u.employee.surname || ""}`.trim() : "";
    out[u.id] = { id: u.id, name: nm || u.username };
  }
  if (uniq.includes(SYSTEM_USER_ID)) out[SYSTEM_USER_ID] = { id: SYSTEM_USER_ID, name: "System" };
  return out;
}

/**
 * Lead Review: a reviewer (crm.lead.review.*) flags a lead or one timeline entry with a colour +
 * comment, optionally sending it to the OWNER agent's My Day with a required instruction + due date.
 * Everything is scope-checked through the parent lead; counts are computed on the server; the central
 * AuditLog records create/update/delete, and every owner/reviewer action fires a notification.
 */
class LeadReviewService {
  /** The lead's owner = the agent's linked user (null if unassigned / no linked user). */
  private async ownerUserIdForLead(lead: { agentId: string | null }): Promise<string | null> {
    if (!lead.agentId) return null;
    const agent = await prisma.salesAgent.findUnique({ where: { id: lead.agentId }, select: { userId: true } });
    return agent?.userId ?? null;
  }

  private async getLeadInScope(userId: string, leadId: string) {
    const scope = await resolveScope(userId, "lead");
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.isDeleted) throw new NotFoundError("Lead");
    assertRowInScope(scope, lead, "Lead");
    return { scope, lead };
  }

  /** Create a flag. When sendToMyDay is true, instruction is required and the owner is notified. */
  async create(userId: string, input: any) {
    const { leadId, targetType = "LEAD", targetId, colour, comment, instruction, dueAt, sendToMyDay } = input || {};
    const { lead } = await this.getLeadInScope(userId, leadId);
    if (!["RED", "AMBER", "GREEN"].includes(colour)) throw new ValidationError("A flag colour (RED, AMBER or GREEN) is required.");
    const wantsMyDay = !!sendToMyDay || !!instruction || !!dueAt;
    if (wantsMyDay && (!instruction || !String(instruction).trim())) {
      throw new ValidationError("An instruction is required to send a lead back to the owner's My Day.");
    }
    const ownerId = await this.ownerUserIdForLead(lead);

    const review = await prisma.leadReview.create({
      data: {
        leadId: lead.id,
        targetType: (["LEAD", "ACTIVITY", "NOTE", "STAGE", "QUOTATION", "FOLLOWUP"].includes(targetType) ? targetType : "LEAD") as any,
        targetId: targetType && targetType !== "LEAD" ? (targetId ?? null) : null,
        colour, comment: comment ?? null,
        instruction: wantsMyDay ? String(instruction).trim() : null,
        dueAt: wantsMyDay && dueAt ? new Date(dueAt) : null,
        sentToMyDay: wantsMyDay,
        reviewerId: userId, ownerId,
      },
    });

    if (wantsMyDay && ownerId && ownerId !== userId) {
      const names = await resolveUserNames([userId]);
      await notify([ownerId], "LEAD_REVIEW", `Lead reviewed: ${lead.customerName}`,
        `${names[userId]?.name || "A reviewer"} flagged this lead (${colour.toLowerCase()}): ${String(instruction).trim()}`, "Lead", lead.id);
    }
    return review;
  }

  /** Send an EXISTING flag to the owner's My Day (instruction required). */
  async sendBack(userId: string, input: any) {
    const { id, instruction, dueAt } = input || {};
    if (!instruction || !String(instruction).trim()) throw new ValidationError("An instruction is required.");
    const review = await prisma.leadReview.findUnique({ where: { id } });
    if (!review || review.isDeleted) throw new NotFoundError("Review");
    const { lead } = await this.getLeadInScope(userId, review.leadId);
    const ownerId = review.ownerId ?? (await this.ownerUserIdForLead(lead));
    const updated = await prisma.leadReview.update({
      where: { id },
      data: { sentToMyDay: true, instruction: String(instruction).trim(), dueAt: dueAt ? new Date(dueAt) : review.dueAt, ownerId, status: "OPEN", resolvedAt: null, updatedBy: userId },
    });
    if (ownerId && ownerId !== userId) {
      const names = await resolveUserNames([userId]);
      await notify([ownerId], "LEAD_REVIEW", `Lead reviewed: ${lead.customerName}`,
        `${names[userId]?.name || "A reviewer"} sent this lead to your My Day (${review.colour.toLowerCase()}): ${String(instruction).trim()}`, "Lead", lead.id);
    }
    return updated;
  }

  /** All flags on a lead (open + resolved), newest first, with reviewer/owner display names. */
  async forLead(userId: string, leadId: string) {
    await this.getLeadInScope(userId, leadId);
    const rows = await prisma.leadReview.findMany({ where: { leadId, isDeleted: null }, orderBy: { createdAt: "desc" } });
    const names = await resolveUserNames(rows.flatMap((r) => [r.reviewerId, r.ownerId]));
    return rows.map((r) => ({ ...r, reviewer: names[r.reviewerId] || null, owner: r.ownerId ? names[r.ownerId] || null : null }));
  }

  /** Open-flag summary per lead id (for the list/board coloured dot). Scope-restricted. */
  async flagsForLeads(userId: string, leadIds: string[]) {
    const ids = Array.from(new Set((leadIds || []).filter(Boolean))).slice(0, 500);
    if (!ids.length) return {};
    const scope = await resolveScope(userId, "lead");
    const leads = await prisma.lead.findMany({ where: { AND: [{ id: { in: ids }, isDeleted: null }, scope.where] }, select: { id: true } });
    const scoped = leads.map((l) => l.id);
    if (!scoped.length) return {};
    const rows = await prisma.leadReview.findMany({ where: { leadId: { in: scoped }, status: "OPEN", isDeleted: null }, select: { leadId: true, colour: true } });
    const out: Record<string, { open: number; colours: string[] }> = {};
    for (const r of rows) {
      const e = (out[r.leadId] ||= { open: 0, colours: [] });
      e.open++;
      if (!e.colours.includes(r.colour)) e.colours.push(r.colour);
    }
    return out;
  }

  /** The owner's "From review" items: OPEN flags sent to their My Day, soonest due first. */
  async myDay(userId: string) {
    const rows = await prisma.leadReview.findMany({
      where: { ownerId: userId, sentToMyDay: true, status: "OPEN", isDeleted: null },
      orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    });
    const leadIds = Array.from(new Set(rows.map((r) => r.leadId)));
    const leads = leadIds.length ? await prisma.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, customerName: true, stage: true } }) : [];
    const leadMap = Object.fromEntries(leads.map((l) => [l.id, l]));
    const names = await resolveUserNames(rows.map((r) => r.reviewerId));
    return rows.map((r) => ({
      id: r.id, leadId: r.leadId, lead: leadMap[r.leadId] || null, colour: r.colour,
      comment: r.comment, instruction: r.instruction, dueAt: r.dueAt, targetType: r.targetType, targetId: r.targetId,
      reviewer: names[r.reviewerId] || null, createdAt: r.createdAt,
    }));
  }

  /** Owner replies and marks the review DONE; the reviewer is notified. */
  async reply(userId: string, input: any) {
    const { id, reply } = input || {};
    const review = await prisma.leadReview.findUnique({ where: { id } });
    if (!review || review.isDeleted) throw new NotFoundError("Review");
    const { scope, lead } = await this.getLeadInScope(userId, review.leadId);
    // Owner (or an ALL-scope manager) may resolve it.
    if (review.ownerId && review.ownerId !== userId && scope.mode !== "ALL") {
      throw new ForbiddenError("Only the lead owner can mark this review done.");
    }
    const updated = await prisma.leadReview.update({
      where: { id },
      data: { status: "DONE", resolvedAt: new Date(), reply: reply ? String(reply).trim() : review.reply, updatedBy: userId },
    });
    if (review.reviewerId && review.reviewerId !== userId) {
      const names = await resolveUserNames([userId]);
      await notify([review.reviewerId], "LEAD_REVIEW_DONE", `Review resolved: ${lead.customerName}`,
        `${names[userId]?.name || "The owner"} marked your ${review.colour.toLowerCase()} review done${reply ? `: ${String(reply).trim()}` : "."}`, "Lead", lead.id);
    }
    return updated;
  }

  /** Reviewer reopens a resolved review; the owner is notified. */
  async reopen(userId: string, input: any) {
    const { id } = input || {};
    const review = await prisma.leadReview.findUnique({ where: { id } });
    if (!review || review.isDeleted) throw new NotFoundError("Review");
    const { lead } = await this.getLeadInScope(userId, review.leadId);
    const updated = await prisma.leadReview.update({ where: { id }, data: { status: "OPEN", resolvedAt: null, updatedBy: userId } });
    if (review.ownerId && review.ownerId !== userId) {
      const names = await resolveUserNames([userId]);
      await notify([review.ownerId], "LEAD_REVIEW_REOPEN", `Review reopened: ${lead.customerName}`,
        `${names[userId]?.name || "The reviewer"} reopened a ${review.colour.toLowerCase()} review on this lead.`, "Lead", lead.id);
    }
    return updated;
  }
}

export default LeadReviewService;
