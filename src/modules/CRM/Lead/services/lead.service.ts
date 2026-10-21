import prisma from "../../../../core/models/base.model";
import { resolveScope, assertRowInScope, resolveAssignment } from "../../shared/scope";
import { getFeatureSet, holds, isGod } from "../../shared/access";
import { notify } from "../../../Work/shared/workHelpers";
import { logActivity } from "../../../ActivityLog/helper/activityLog.helper";
import { notifyMentions } from "../../shared/mentions";
import { NotFoundError, AppError, ForbiddenError, ValidationError } from "../../../../core/errors/app.error";
import { assertTransition, allowedNext } from "../../shared/stateMachine";
import { probabilityFor, weightedValue, daysBetween, followUpStatus } from "../../shared/computed";
import { normalizePhone, searchPhoneDigits } from "../../shared/phone";

export interface LeadFilters {
  company?: string; outlet?: string; city?: string; stage?: string;
  priority?: string; channel?: string; agentId?: string; followUp?: string; from?: string; to?: string;
  search?: string; phone?: string;
}

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";
const ADMIN_USER_ID = "58c55d6a-910c-46f8-a422-4604bea6cd15";

// --- Timeline humanizers (sentence case) ---
const ACTIVITY_TITLE: Record<string, string> = {
  CALL: "Called", WHATSAPP: "WhatsApp sent", VISIT: "Visit logged", EMAIL: "Email sent",
  QUOTATION_SENT: "Quotation sent", NOTE: "Note added", OTHER: "Activity logged",
};
const ACTION_TITLE: Record<string, string> = {
  CREATE: "Lead created", UPDATE: "Lead updated", STATUS_CHANGE: "Stage changed",
  DELETE: "Lead deleted", RESTORE: "Lead restored", ASSIGN: "Agent assigned", PERMISSION_CHANGE: "Permissions changed",
  TRANSFER: "Lead transferred",
};
// Fields that are derived/noise and should not appear under "Show changes" (lastContactAt +
// nextFollowUpAt are driven by logging an activity and already shown in the entry headline).
const CHANGE_NOISE = new Set(["updatedAt", "updatedById", "createdById", "lastContactAt", "nextFollowUpAt", "probability", "weightedValue"]);

function sentenceCase(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = String(s).replace(/_/g, " ").toLowerCase().trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : null;
}
// Flatten an AuditLog.changes object {field:{before,after}} into a display array, dropping noise.
function flattenChanges(changes: any): Array<{ field: string; before: any; after: any }> {
  if (!changes || typeof changes !== "object") return [];
  const out: Array<{ field: string; before: any; after: any }> = [];
  for (const [field, v] of Object.entries(changes as Record<string, any>)) {
    if (CHANGE_NOISE.has(field)) continue;
    if (v && typeof v === "object" && ("before" in v || "after" in v)) out.push({ field, before: (v as any).before ?? null, after: (v as any).after ?? null });
    else out.push({ field, before: null, after: v });
  }
  return out;
}

function filterWhere(f: LeadFilters = {}): Record<string, any> {
  const w: Record<string, any> = {};
  if (f.company) w.company = f.company;
  if (f.outlet) w.outlet = f.outlet;
  if (f.city) w.city = { contains: f.city, mode: "insensitive" };
  if (f.stage) w.stage = f.stage;
  if (f.priority) w.priority = f.priority;
  if (f.channel) w.channel = f.channel;
  if (f.agentId) w.agentId = f.agentId;
  if (f.phone) { const n = normalizePhone(f.phone); if (n) w.phoneNormalized = n; } // exact national-number match
  if (f.search) {
    const s = String(f.search).trim();
    const sd = searchPhoneDigits(s);
    w.OR = [
      { customerName: { contains: s, mode: "insensitive" } },
      { leadNo: { contains: s, mode: "insensitive" } },
      ...(sd ? [{ phoneNormalized: { contains: sd } }] : []),
    ];
  }
  if (f.from || f.to) {
    w.dateReceived = {};
    if (f.from) w.dateReceived.gte = new Date(f.from);
    if (f.to) w.dateReceived.lte = new Date(f.to);
  }
  return w;
}

/** Attach computed (never-stored) fields to a lead row. */
export function withComputed(l: any) {
  if (!l) return l;
  const probability = probabilityFor(l.stage);
  const fu = followUpStatus(l.nextFollowUpAt);
  return {
    ...l,
    probability,
    weightedValue: weightedValue(l.stage, l.estimatedValue),
    daysSinceContact: daysBetween(l.lastContactAt),
    leadAgeDays: daysBetween(l.dateReceived),
    followUpStatus: fu,
    allowedNextStages: allowedNext("lead", l.stage),
  };
}

class LeadService {
  async get(userId: string, page = 1, pageSize = 10, filters: LeadFilters = {}) {
    const scope = await resolveScope(userId, "lead");
    const where = { AND: [{ isDeleted: null }, filterWhere(filters), scope.where] };
    const skip = (page - 1) * pageSize;
    let [data, totalSize] = await Promise.all([
      prisma.lead.findMany({ where, skip, take: pageSize, orderBy: { dateReceived: "desc" } }),
      prisma.lead.count({ where }),
    ]);
    let rows = data.map(withComputed);
    // follow-up status is computed, so filter it in memory when requested
    if (filters.followUp) rows = rows.filter((r) => r.followUpStatus === filters.followUp);
    return { data: rows, totalSize, scope: scope.mode };
  }

  async total(userId: string, filters: LeadFilters = {}) {
    const scope = await resolveScope(userId, "lead");
    return prisma.lead.count({ where: { AND: [{ isDeleted: null }, filterWhere(filters), scope.where] } });
  }

  async getById(userId: string, id: string) {
    const scope = await resolveScope(userId, "lead");
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.isDeleted) return null;
    assertRowInScope(scope, lead, "Lead");
    return withComputed(lead);
  }

  /** crm.lead.assign (2c): only holders may choose the agent a lead is assigned to. Everyone else's
   *  lead goes to their own agent (requested agentId ignored), enforced here on the backend. */
  private async canAssign(userId: string): Promise<boolean> {
    if (isGod(userId)) return true;
    return holds(await getFeatureSet(userId), "crm.lead.assign.*");
  }

  async create(userId: string, data: any) {
    const mentionIds: string[] | undefined = data.mentions; delete data.mentions; // not a Lead column
    const scope = await resolveScope(userId, "lead");
    const canAssign = await this.canAssign(userId);
    let unassigned = false;
    if (canAssign) {
      // Holder: honor the requested agent (still scope-checked). May legitimately be null.
      data.agentId = resolveAssignment(scope, data.agentId);
    } else if (scope.agentId) {
      // Non-holder with an agent profile: the lead goes to their OWN agent (requested ignored).
      data.agentId = scope.agentId;
    } else {
      // Non-holder with NO agent profile (e.g. front desk): create UNASSIGNED and alert managers,
      // rather than blocking. (Never throws — self-create of an unassigned lead is always allowed.)
      data.agentId = null;
      unassigned = true;
    }
    if (data.phone !== undefined) data.phoneNormalized = normalizePhone(data.phone);
    const created = await prisma.lead.gpCreate(data);
    const lead = Array.isArray(created) ? created[0] : created;
    if (unassigned && lead?.id) {
      // Notify managers (agents with ALL scope) so an unassigned lead doesn't sit unseen.
      try {
        const managers = await prisma.salesAgent.findMany({ where: { scope: "ALL", isDeleted: null, userId: { not: null } }, select: { userId: true } });
        await notify(managers.map((m) => m.userId), "LEAD_UNASSIGNED", `Unassigned lead: ${lead.customerName}`, "A lead was created without an agent. Please assign it.", "Lead", lead.id);
      } catch { /* best-effort */ }
    }
    if (lead?.id) await notifyMentions(userId, mentionIds, lead.id, lead.customerName || "a lead", data.notes);
    return created;
  }

  async update(userId: string, id: string, data: any) {
    const mentionIds: string[] | undefined = data.mentions; delete data.mentions; // not a Lead column
    const scope = await resolveScope(userId, "lead");
    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Lead");
    assertRowInScope(scope, existing, "Lead");
    if (Object.prototype.hasOwnProperty.call(data, "agentId")) {
      // Reassigning requires crm.lead.assign; otherwise the field is ignored (keeps current agent).
      if (await this.canAssign(userId)) data.agentId = resolveAssignment(scope, data.agentId);
      else delete data.agentId;
    }
    if (Object.prototype.hasOwnProperty.call(data, "stage")) delete data.stage; // stage only via /transition
    if (Object.prototype.hasOwnProperty.call(data, "phone")) data.phoneNormalized = normalizePhone(data.phone);
    const updated = await prisma.lead.gpUpdate(id, data);
    await notifyMentions(userId, mentionIds, id, existing.customerName || "a lead", data.notes);
    return updated;
  }

  async remove(userId: string, id: string) {
    const scope = await resolveScope(userId, "lead");
    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Lead");
    assertRowInScope(scope, existing, "Lead");
    return prisma.lead.gpSoftDelete(id);
  }

  async restore(userId: string, id: string) {
    const scope = await resolveScope(userId, "lead");
    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Lead");
    assertRowInScope(scope, existing, "Lead");
    return prisma.lead.gpRestore(id);
  }

  async assign(userId: string, id: string, agentId: string | null) {
    const scope = await resolveScope(userId, "lead");
    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Lead");
    assertRowInScope(scope, existing, "Lead");
    const target = resolveAssignment(scope, agentId);
    return prisma.lead.update({ where: { id }, data: { agentId: target, updatedBy: userId } });
  }

  /** Users the caller may @mention (for the mention picker): everyone for a manager (ALL scope),
   *  otherwise their own team's members. Returns [{ userId, name, username }], excluding self. */
  async mentionables(userId: string) {
    const scope = await resolveScope(userId, "lead");
    const sel = { id: true, username: true, employee: { select: { name: true, surname: true } } } as const;
    let users: any[] = [];
    if (isGod(userId) || scope.mode === "ALL") {
      users = await prisma.user.findMany({ where: { isDeleted: null }, select: sel, take: 1000 });
    } else if (scope.agentId) {
      const me = await prisma.salesAgent.findUnique({ where: { id: scope.agentId }, select: { id: true, teamLeadId: true } });
      const teamLead = me?.teamLeadId ?? me?.id;
      if (teamLead) {
        const team = await prisma.salesAgent.findMany({ where: { isDeleted: null, userId: { not: null }, OR: [{ id: teamLead }, { teamLeadId: teamLead }] }, select: { userId: true } });
        const ids = team.map((t) => t.userId).filter((x): x is string => !!x);
        if (ids.length) users = await prisma.user.findMany({ where: { id: { in: ids }, isDeleted: null }, select: sel });
      }
    }
    return users
      .map((u) => ({ userId: u.id, username: u.username, name: u.employee ? `${u.employee.name || ""} ${u.employee.surname || ""}`.trim() || u.username : u.username }))
      .filter((u) => u.userId !== userId);
  }

  /** The full team an agent belongs to: the team lead + all its members (regardless of whether the
   *  given agent is the lead or a member). Used to constrain transfers to "the same team". */
  private async teamAgentIds(agentId: string): Promise<string[]> {
    const me = await prisma.salesAgent.findUnique({ where: { id: agentId }, select: { id: true, teamLeadId: true } });
    if (!me) return [];
    const leadId = me.teamLeadId ?? me.id; // the team's lead id
    const team = await prisma.salesAgent.findMany({ where: { isDeleted: null, OR: [{ id: leadId }, { teamLeadId: leadId }] }, select: { id: true } });
    return team.map((a) => a.id);
  }

  /**
   * 2d — Transfer a lead to another agent. Requires crm.lead.transfer (route-gated) + a reason. An
   * ALL-scope manager may transfer to anyone; everyone else only within their own team. The transfer
   * is recorded on the timeline (ActivityLog TRANSFER) and both the previous and new agent's users are
   * notified.
   */
  async transfer(userId: string, id: string, toAgentId: string, reason: string) {
    if (!reason || !reason.trim()) throw new ValidationError("A reason is required to transfer a lead.");
    const scope = await resolveScope(userId, "lead");
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.isDeleted) throw new NotFoundError("Lead");
    assertRowInScope(scope, lead, "Lead");

    const toAgent = await prisma.salesAgent.findFirst({ where: { id: toAgentId, isDeleted: null }, select: { id: true, userId: true, agentCode: true, isActive: true } });
    if (!toAgent) throw new NotFoundError("Target agent");
    if (toAgent.id === lead.agentId) throw new ValidationError("The lead is already assigned to that agent.");

    // Authorization: ALL scope -> anyone; otherwise the target must be in the caller's own team.
    if (scope.mode !== "ALL") {
      if (!scope.agentId) throw new ForbiddenError("Your account isn't linked to a sales agent, so you can't transfer leads.");
      const team = await this.teamAgentIds(scope.agentId);
      if (!team.includes(toAgentId)) throw new ForbiddenError("You can only transfer leads to an agent in your own team.");
    }

    const fromAgentId = lead.agentId;
    const updated = await prisma.lead.update({ where: { id }, data: { agentId: toAgentId, updatedBy: userId } });

    // Timeline entry (reason) — correlates with the agentId audit change into one "Lead transferred" row.
    try {
      const fromAgent = fromAgentId ? await prisma.salesAgent.findUnique({ where: { id: fromAgentId }, select: { userId: true, agentCode: true } }) : null;
      await logActivity({ userId, action: "TRANSFER", entityType: "Lead", entityId: id, description: `Transferred ${fromAgent?.agentCode ? `from ${fromAgent.agentCode} ` : ""}to ${toAgent.agentCode}: ${reason.trim()}` } as any);
      // Notify both the previous and the new agent's users.
      await notify([fromAgent?.userId, toAgent.userId], "LEAD_TRANSFER", `Lead transferred: ${lead.customerName}`, reason.trim(), "Lead", id);
    } catch { /* best-effort */ }

    return updated;
  }

  /** Server-enforced stage change. Reason required for LOST / ON_HOLD. */
  async transition(userId: string, id: string, to: string, reason: string | null) {
    const scope = await resolveScope(userId, "lead");
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.isDeleted) throw new NotFoundError("Lead");
    assertRowInScope(scope, lead, "Lead");
    assertTransition("lead", lead.stage, to, reason);
    const data: any = { stage: to, updatedBy: userId, updatedAt: new Date() };
    if (to === "LOST") { data.lostReason = reason; data.stageReason = reason; }
    else if (to === "ON_HOLD") { data.stageReason = reason; }
    if (["CONTACTED", "QUALIFIED", "QUOTATION", "NEGOTIATION"].includes(to)) data.lastContactAt = new Date();
    const updated = await prisma.lead.update({ where: { id }, data });
    return { ...withComputed(updated), from: lead.stage, to };
  }

  /** Convert a Visitor into a Lead (one lead per visitor). */
  async fromVisitor(userId: string, visitorId: string) {
    const scope = await resolveScope(userId, "lead");
    if (!visitorId) throw new AppError(400, "visitorId is required");
    const existing = await prisma.lead.findFirst({ where: { visitorId } });
    if (existing) throw new AppError(409, "This visitor has already been converted to a lead");
    const v = await prisma.visitor.findUnique({ where: { id: visitorId } });
    if (!v) throw new NotFoundError("Visitor");
    const agentId = resolveAssignment(scope, null); // own/team -> self; admin -> unassigned
    const lead = await prisma.lead.gpCreate({
      customerName: v.name, phone: v.phone ?? null, requirement: v.purpose ?? v.notes ?? null,
      channel: "WALK_IN", stage: "NEW", visitorId, agentId, company: "OKASHASMART", createdBy: userId,
      lastContactAt: v.timeIn ?? v.visitDate ?? new Date(),
    });
    return lead;
  }

  /**
   * Merged timeline: ONE entry per user action (newest first). A single action can touch three
   * sources — a LeadActivity (the touch), a system ActivityLog, and AuditLog field diffs — which were
   * previously shown as 3 separate rows. Here they are correlated (same actor, within a short time
   * window) and collapsed into one readable, sentence-case entry. Raw field changes are returned
   * separately under `changes` so the UI can hide them behind "Show changes".
   */
  async timeline(userId: string, id: string) {
    const scope = await resolveScope(userId, "lead");
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.isDeleted) throw new NotFoundError("Lead");
    assertRowInScope(scope, lead, "Lead");

    const [acts, legacy, audit] = await Promise.all([
      prisma.leadActivity.findMany({ where: { leadId: id, isDeleted: null } }),
      // Explicit select so metadata survives the global list-blob strip (needed for the timeline).
      prisma.activityLog.findMany({
        where: { entityType: "Lead", entityId: id },
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true, action: true, description: true, metadata: true, userId: true },
      }),
      prisma.auditLog.findMany({ where: { entity: "Lead", entityId: id }, orderBy: { createdAt: "desc" }, take: 200 }),
    ]);

    // Normalize every raw row to a common correlation shape (use createdAt for correlation — the time
    // the row was written, which is shared across the three sources of one action).
    type Raw = { src: "activity" | "log" | "audit"; at: number; actorId: string | null; payload: any };
    const raws: Raw[] = [];
    for (const a of acts) raws.push({ src: "activity", at: new Date((a as any).createdAt ?? a.occurredAt ?? 0).getTime(), actorId: (a as any).createdById ?? (a as any).createdBy ?? null, payload: a });
    for (const l of legacy) raws.push({ src: "log", at: new Date(l.createdAt as any).getTime(), actorId: (l as any).userId ?? null, payload: l });
    for (const au of audit) raws.push({ src: "audit", at: new Date((au as any).createdAt).getTime(), actorId: (au as any).userId ?? null, payload: au });

    // Correlate into actions: same actor + same 3s bucket (one request writes all its rows within ms).
    const BUCKET = 3000;
    const groups = new Map<string, Raw[]>();
    for (const r of raws) {
      const key = `${r.actorId ?? "-"}|${Math.floor(r.at / BUCKET)}`;
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
    }

    // Resolve actor display names in one query.
    const actorIds = Array.from(new Set(raws.map((r) => r.actorId).filter(Boolean))) as string[];
    const users = actorIds.length
      ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, username: true, employee: { select: { name: true, surname: true } } } })
      : [];
    const nameOf = (uid: string | null) => {
      if (!uid) return null;
      if (uid === SYSTEM_USER_ID) return { id: uid, name: "System" };
      if (uid === ADMIN_USER_ID) return { id: uid, name: "Admin" };
      const u = users.find((x) => x.id === uid);
      if (!u) return { id: uid, name: "Unknown user" };
      const nm = u.employee ? `${u.employee.name || ""} ${u.employee.surname || ""}`.trim() : "";
      return { id: uid, name: nm || u.username };
    };

    const entries = Array.from(groups.values()).map((g) => {
      const activity = g.find((r) => r.src === "activity")?.payload;
      const log = g.find((r) => r.src === "log")?.payload;
      const audits = g.filter((r) => r.src === "audit").map((r) => r.payload);
      const at = new Date(Math.min(...g.map((r) => r.at))).toISOString();
      const actor = nameOf(g[0].actorId);

      // Collect field changes from audit rows + any activity-log metadata.changes, dropping noise.
      let changes: Array<{ field: string; before: any; after: any }> = [];
      for (const au of audits) changes = changes.concat(flattenChanges(au.changes));
      if (log?.metadata && (log.metadata as any).changes) changes = changes.concat(flattenChanges((log.metadata as any).changes));

      let kind = "edit";
      let title = "Updated";
      let type: string | null = null, outcome: string | null = null, notes: string | null = null, nextFollowUpAt: any = null, occurredAt: any = null;

      if (activity) {
        kind = "activity";
        type = activity.type;
        title = ACTIVITY_TITLE[activity.type] || "Activity logged";
        outcome = sentenceCase(activity.outcome);
        notes = activity.notes || null;
        nextFollowUpAt = activity.nextFollowUpAt || null;
        occurredAt = activity.occurredAt || null;
      } else if (log) {
        kind = log.action === "STATUS_CHANGE" ? "stage" : "system";
        title = ACTION_TITLE[log.action] || sentenceCase(log.action) || "Updated";
        notes = log.description || null;
      } else if (audits.length) {
        const a0 = audits[0];
        kind = a0.action === "STATUS_CHANGE" ? "stage" : "edit";
        title = ACTION_TITLE[a0.action] || sentenceCase(a0.action) || "Updated";
      }

      return {
        id: (activity?.id || log?.id || audits[0]?.id || at) as string,
        at, occurredAt, kind, title,
        type, outcome, notes, nextFollowUpAt,
        actor,
        ...(changes.length ? { changes } : {}),
      };
    });

    entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return entries;
  }
}

export default LeadService;
