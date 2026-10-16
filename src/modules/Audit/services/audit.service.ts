/**
 * Read API over the AuditLog (Run 11 Part 4). Two surfaces:
 *  - list(): the admin Audit Log page. Gated by audit.read.* at the route; supports filtering by
 *    user, module, entity, action, date range and a record-id search, with pagination.
 *  - entityHistory(): the per-record History tab. NOT admin-gated (route maps to profile.*); instead
 *    it enforces that the caller can READ that record: they must hold the entity's read feature, and
 *    for row-scoped CRM entities the record must be within their scope. So a user only ever sees the
 *    history of records they can already see.
 */
import prisma from "../../../core/models/base.model";
import AccessService from "../../rbac/Access/service/access.service";
import { ForbiddenError } from "../../../core/errors/app.error";

const access = new AccessService();

// entity -> the read feature a caller must hold to see that entity's history.
const ENTITY_READ_FEATURE: Record<string, string> = {
  Lead: "crm.lead.read", Quotation: "crm.quotation.read", SalesOrder: "crm.order.read",
  SalesReturn: "crm.return.read", Customer: "crm.lead.read",
  Product: "crm.catalogue.read", Category: "crm.catalogue.read", Brand: "crm.catalogue.read",
  PriceList: "crm.catalogue.read", Bundle: "crm.catalogue.read", SalesAgent: "crm.agent.read",
  Employee: "employee.read", User: "user.read", Role: "role.read", Group: "group.read",
  Visitor: "visitor.read", Holiday: "holiday.read", Unit: "unit.read",
  Attendance: "attendance.read", AttendanceRequest: "attendanceReq.read",
  LeaveRequest: "leaveReq.read", LeaveAllocation: "leaveAlloc.read",
  Task: "work.task.read", Team: "work.team.read", DailyReport: "work.report.read",
  GatePass: "gatePass.read", Shift: "shift.read",
};
// CRM entities whose row visibility is scoped (own/team/all) by SalesAgent scope.
const CRM_SCOPED: Record<string, "lead" | "quotation" | "order" | "return"> = {
  Lead: "lead", Quotation: "quotation", SalesOrder: "order", SalesReturn: "return",
};

const GOD_ID = "58c55d6a-910c-46f8-a422-4604bea6cd15";

// "a.b.c.*" -> ["a.*","a.b.*"]
function ancestors(f: string): string[] {
  const out: string[] = [];
  const segs = f.split(".");
  for (let i = 1; i < segs.length; i++) out.push(segs.slice(0, i).join(".") + ".*");
  return out;
}
function holds(set: Set<string>, feature: string): boolean {
  if (set.has(feature) || set.has(feature + ".*")) return true;
  for (const a of ancestors(feature + ".*")) if (set.has(a)) return true;
  return false;
}

class AuditService {
  /** Admin Audit Log list with filters + pagination. */
  async list(filters: any = {}) {
    const { userId, module, entity, action, entityId, dateFrom, dateTo, search } = filters || {};
    const page = Math.max(1, Number(filters?.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(filters?.pageSize) || 50));
    const where: any = {};
    if (userId) where.userId = userId;
    if (module) where.module = module;
    if (entity) where.entity = entity;
    if (action) where.action = action;
    if (entityId) where.entityId = entityId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }
    if (search) {
      const s = String(search);
      where.OR = [{ entityId: s }, { entity: { contains: s, mode: "insensitive" } }, { userId: s }];
    }
    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.auditLog.count({ where }),
    ]);
    const withActor = await this.decorateActors(rows);
    return { data: withActor, total, page, pageSize };
  }

  /** Per-record History tab. Enforces the caller can read the record. */
  async entityHistory(userId: string, entity: string, entityId: string, limit = 200) {
    if (!entity || !entityId) throw new ForbiddenError("entity and entityId are required");
    if (userId !== GOD_ID) {
      const feats = await access.getAllowedFeaturesForUser(userId);
      const set = new Set<string>(Array.isArray(feats) ? feats : []);
      const needed = ENTITY_READ_FEATURE[entity];
      // Unknown entity, or caller lacks the entity's read feature -> no history.
      if (!needed || !holds(set, needed)) throw new ForbiddenError("You cannot view this record's history");
      // Row-scope for CRM entities: the record must be inside the caller's scope.
      const crm = CRM_SCOPED[entity];
      if (crm) await this.assertCrmRowReadable(userId, crm, entity, entityId);
    }
    const rows = await prisma.auditLog.findMany({ where: { entity, entityId }, orderBy: { createdAt: "desc" }, take: Math.min(500, limit) });
    return this.decorateActors(rows);
  }

  private async assertCrmRowReadable(userId: string, kind: "lead" | "quotation" | "order" | "return", entity: string, entityId: string) {
    const { resolveScope, assertRowInScope } = await import("../../CRM/shared/scope");
    const scope = await resolveScope(userId, kind);
    const delegate: any = (prisma as any)[entity.charAt(0).toLowerCase() + entity.slice(1)];
    const row = await delegate.findUnique({ where: { id: entityId }, select: { agentId: true } }).catch(() => null);
    if (!row) return; // deleted record: let the (empty/残) history through rather than leak existence
    assertRowInScope(scope, row.agentId, entity);
  }

  /** Attach actor display names (username + employee name) to a set of rows. */
  private async decorateActors(rows: any[]) {
    const ids = Array.from(new Set(rows.map((r) => r.userId).filter(Boolean)));
    if (!ids.length) return rows.map((r) => ({ ...r, actor: null }));
    const users = await prisma.user.findMany({
      where: { id: { in: ids as string[] } },
      select: { id: true, username: true, employee: { select: { name: true, surname: true } } },
    });
    const map = new Map(users.map((u) => [u.id, u]));
    return rows.map((r) => {
      const u = r.userId ? map.get(r.userId) : null;
      const name = u?.employee ? `${u.employee.name || ""} ${u.employee.surname || ""}`.trim() : null;
      return { ...r, actor: u ? { id: u.id, username: u.username, name: name || u.username } : (r.userId ? { id: r.userId, username: "(deleted user)", name: "(deleted user)" } : null) };
    });
  }

  /** Resolve a set of actor ids to display names (for list-page Created/Updated by columns + footers). */
  async resolveActors(ids: string[]) {
    const clean = Array.from(new Set((ids || []).filter(Boolean)));
    if (!clean.length) return {};
    const SYSTEM = "00000000-0000-0000-0000-000000000000";
    const users = await prisma.user.findMany({
      where: { id: { in: clean } },
      select: { id: true, username: true, employee: { select: { name: true, surname: true } } },
    });
    const out: Record<string, { username: string; name: string }> = {};
    for (const u of users) {
      const name = u.employee ? `${u.employee.name || ""} ${u.employee.surname || ""}`.trim() : "";
      out[u.id] = { username: u.username, name: name || u.username };
    }
    if (clean.includes(SYSTEM) && !out[SYSTEM]) out[SYSTEM] = { username: "system", name: "System" };
    return out;
  }
}

export default AuditService;
