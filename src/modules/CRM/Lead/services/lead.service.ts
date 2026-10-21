import prisma from "../../../../core/models/base.model";
import { resolveScope, assertRowInScope, resolveAssignment } from "../../shared/scope";
import { NotFoundError, AppError } from "../../../../core/errors/app.error";
import { assertTransition, allowedNext } from "../../shared/stateMachine";
import { probabilityFor, weightedValue, daysBetween, followUpStatus } from "../../shared/computed";
import { normalizePhone, searchPhoneDigits } from "../../shared/phone";

export interface LeadFilters {
  company?: string; outlet?: string; city?: string; stage?: string;
  priority?: string; channel?: string; agentId?: string; followUp?: string; from?: string; to?: string;
  search?: string; phone?: string;
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

  async create(userId: string, data: any) {
    const scope = await resolveScope(userId, "lead");
    data.agentId = resolveAssignment(scope, data.agentId);
    if (data.phone !== undefined) data.phoneNormalized = normalizePhone(data.phone);
    return prisma.lead.gpCreate(data);
  }

  async update(userId: string, id: string, data: any) {
    const scope = await resolveScope(userId, "lead");
    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Lead");
    assertRowInScope(scope, existing, "Lead");
    if (Object.prototype.hasOwnProperty.call(data, "agentId")) data.agentId = resolveAssignment(scope, data.agentId);
    if (Object.prototype.hasOwnProperty.call(data, "stage")) delete data.stage; // stage only via /transition
    if (Object.prototype.hasOwnProperty.call(data, "phone")) data.phoneNormalized = normalizePhone(data.phone);
    return prisma.lead.gpUpdate(id, data);
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

  /** Merged timeline: user-logged LeadActivity + system ActivityLog, newest first. */
  async timeline(userId: string, id: string) {
    const scope = await resolveScope(userId, "lead");
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.isDeleted) throw new NotFoundError("Lead");
    assertRowInScope(scope, lead, "Lead");
    const [acts, legacy, audit] = await Promise.all([
      prisma.leadActivity.findMany({ where: { leadId: id, isDeleted: null } }),
      // Explicit select so metadata survives the global list-blob strip (it's needed for the timeline
      // detail). Bounded to one lead's rows, and metadata is kept small by the write-time sanitizer.
      prisma.activityLog.findMany({
        where: { entityType: "Lead", entityId: id },
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true, action: true, description: true, metadata: true, userId: true, entityType: true, entityId: true },
      }),
      // Run 11: central audit field-change entries for this lead, shown alongside the activity feed.
      prisma.auditLog.findMany({ where: { entity: "Lead", entityId: id }, orderBy: { createdAt: "desc" }, take: 200 }),
    ]);
    const merged = [
      ...acts.map((a) => ({ source: "activity", at: a.occurredAt, type: a.type, outcome: a.outcome, notes: a.notes, nextFollowUpAt: a.nextFollowUpAt })),
      ...legacy.map((x) => ({ source: "activity-log", at: x.createdAt, action: x.action, description: x.description, metadata: x.metadata })),
      ...audit.map((x) => ({ source: "audit", at: x.createdAt, action: x.action, changes: x.changes, userId: x.userId })),
    ].sort((a, b) => new Date(b.at as any).getTime() - new Date(a.at as any).getTime());
    return merged;
  }
}

export default LeadService;
