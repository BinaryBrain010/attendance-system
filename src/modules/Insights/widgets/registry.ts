/**
 * Built-in analytics widget registry. Each widget declares the module it belongs to and its primary
 * entity; the catalog only offers a widget when the caller has the module's appModules feature AND
 * read on the entity, and every compute() resolves the caller's scope (ctx.scopeOf) and merges it
 * into the query — so a user never sees data they could not see in the module itself. Group-by results
 * are capped (GROUP_CAP) and the whole result is cached 60s per caller+filters by the service.
 */
import { Entity, EntityScope } from "../shared/scope";
import { ModuleKey, holdsRead, GOD_ID } from "../shared/gating";
import {
  Filters, Window, parseWindow, previousWindow, baseWhere, dateWhere,
  groupCount, groupSum, bucketSeries, prisma, GROUP_CAP,
} from "../shared/query";

export type WidgetType =
  | "kpi" | "line" | "bar" | "area" | "pie" | "donut"
  | "funnel" | "table" | "leaderboard" | "gauge" | "heatmap" | "list";

export interface Ctx {
  userId: string;
  feats: Set<string>;
  filters: Filters;
  window: Window;
  scopeOf: (e: Entity) => Promise<EntityScope>;
}

export interface WidgetDef {
  key: string;
  module: ModuleKey;
  entity: Entity;
  title: string;
  description?: string;
  type: WidgetType;
  drill?: string;
  compute: (ctx: Ctx) => Promise<any>;
}

// Which read-feature base gates each entity in the catalog (mirrors shared/scope.ts).
const ENTITY_BASE: Record<Entity, string> = {
  attendance: "attendance", visitor: "visitor", gatePass: "voucher", gatePassItem: "voucher",
  lead: "crm.lead", quotation: "crm.quotation", salesOrder: "crm.order", salesReturn: "crm.return",
  task: "work.task", dailyReport: "work.report", auditLog: "audit",
};

export function canSeeEntity(feats: Set<string>, userId: string, entity: Entity): boolean {
  if (userId === GOD_ID) return true;
  return holdsRead(feats, ENTITY_BASE[entity]);
}

// ---------- small shared compute helpers ----------

function kpi(value: number, prev?: number | null) {
  const out: any = { value };
  if (prev != null) {
    const delta = prev === 0 ? (value > 0 ? 100 : 0) : ((value - prev) / prev) * 100;
    out.trend = { prevValue: prev, deltaPct: Math.round(delta * 10) / 10, direction: value > prev ? "up" : value < prev ? "down" : "flat" };
  }
  return out;
}

async function labelMap(model: string, ids: any[], field = "name"): Promise<Map<string, string>> {
  const uniq = [...new Set(ids.filter(Boolean))] as string[];
  if (!uniq.length) return new Map();
  const rows: any[] = await (prisma as any)[model].findMany({ where: { id: { in: uniq } }, select: { id: true, [field]: true } });
  return new Map(rows.map((r) => [r.id, r[field] ?? r.id]));
}

const donut = (rows: Array<{ key: any; count: number }>) => ({ labels: rows.map((r) => String(r.key ?? "—")), data: rows.map((r) => r.count) });
const barSeries = (labels: string[], data: number[], name: string) => ({ labels, series: [{ name, data }] });

// Count helper honouring scope + window
async function scopedCount(model: string, scope: EntityScope, dateField: string | null, w: Window, extra: Record<string, any> = {}) {
  const where = { AND: [baseWhere(scope.where, dateField, w), extra] };
  return (prisma as any)[model].count({ where });
}

// ============================ WIDGETS ============================

export const WIDGETS: WidgetDef[] = [
  // -------------------- QUICK MARK (attendance) --------------------
  {
    key: "quickmark.todayStatus", module: "quickMark", entity: "attendance", type: "donut",
    title: "Attendance today", description: "Present / absent / late / on-leave today", drill: "/ams/attendance",
    compute: async (c) => {
      const s = await c.scopeOf("attendance");
      const today = parseWindow({ preset: "today" });
      const rows = await groupCount("attendance", "status", baseWhere(s.where, "date", today));
      return donut(rows);
    },
  },
  {
    key: "quickmark.trend", module: "quickMark", entity: "attendance", type: "line",
    title: "Attendance trend", description: "Present marks per day", drill: "/ams/attendance",
    compute: async (c) => {
      const s = await c.scopeOf("attendance");
      const rows: any[] = await prisma.attendance.findMany({ where: { AND: [baseWhere(s.where, "date", c.window), { status: "PRESENT" }] }, select: { date: true }, take: 20000 });
      const ser = bucketSeries(rows.map((r) => r.date), c.filters.bucket || "day");
      return { labels: ser.labels, series: [{ name: "Present", data: ser.data }] };
    },
  },
  {
    key: "quickmark.lateByEmployee", module: "quickMark", entity: "attendance", type: "leaderboard",
    title: "Late arrivals by employee", drill: "/ams/attendance",
    compute: async (c) => {
      const s = await c.scopeOf("attendance");
      const rows = await groupCount("attendance", "employeeId", { AND: [baseWhere(s.where, "date", c.window), { status: "LATE" }] });
      const names = await labelMap("employee", rows.map((r) => r.key));
      return { rows: rows.map((r) => ({ label: names.get(r.key) || r.key || "—", value: r.count })) };
    },
  },
  {
    key: "quickmark.overtimeHours", module: "quickMark", entity: "attendance", type: "kpi",
    title: "Overtime hours", description: "Hours worked beyond 8h/day (approx)",
    compute: async (c) => {
      const s = await c.scopeOf("attendance");
      const rows: any[] = await prisma.attendance.findMany({ where: { AND: [baseWhere(s.where, "date", c.window), { checkIn: { not: null } }, { checkOut: { not: null } }] }, select: { checkIn: true, checkOut: true }, take: 20000 });
      let ot = 0;
      for (const r of rows) { const h = (new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 3.6e6; if (h > 8) ot += h - 8; }
      return { ...kpi(Math.round(ot)), unit: "h" };
    },
  },
  {
    key: "quickmark.onLeaveToday", module: "quickMark", entity: "attendance", type: "kpi",
    title: "On leave today",
    compute: async (c) => {
      const s = await c.scopeOf("attendance");
      const v = await scopedCount("attendance", s, "date", parseWindow({ preset: "today" }), { status: "ON_LEAVE" });
      return kpi(v);
    },
  },
  {
    key: "quickmark.attendanceReqPending", module: "quickMark", entity: "attendance", type: "kpi",
    title: "Attendance requests pending", drill: "/ams/attendance",
    compute: async () => {
      const v = await prisma.attendanceRequest.count({ where: { isDeleted: null, status: "PENDING" } });
      return kpi(v);
    },
  },

  // -------------------- FRONTDESK (visitor) --------------------
  {
    key: "frontdesk.visitorsToday", module: "frontdesk", entity: "visitor", type: "kpi",
    title: "Visitors today", drill: "/admin/frontdesk/visitor",
    compute: async (c) => {
      const s = await c.scopeOf("visitor");
      const today = parseWindow({ preset: "today" });
      const prev = previousWindow(today);
      const v = await scopedCount("visitor", s, "visitDate", today);
      const p = prev ? await scopedCount("visitor", s, "visitDate", prev) : null;
      return kpi(v, p);
    },
  },
  {
    key: "frontdesk.visitorsWeek", module: "frontdesk", entity: "visitor", type: "kpi",
    title: "Visitors this week", drill: "/admin/frontdesk/visitor",
    compute: async (c) => {
      const s = await c.scopeOf("visitor");
      const w = parseWindow({ preset: "7d" }); const prev = previousWindow(w);
      const v = await scopedCount("visitor", s, "visitDate", w);
      const p = prev ? await scopedCount("visitor", s, "visitDate", prev) : null;
      return kpi(v, p);
    },
  },
  {
    key: "frontdesk.byPurpose", module: "frontdesk", entity: "visitor", type: "pie",
    title: "Visitors by outcome", drill: "/admin/frontdesk/visitor",
    compute: async (c) => {
      const s = await c.scopeOf("visitor");
      return donut(await groupCount("visitor", "outcome", baseWhere(s.where, "visitDate", c.window)));
    },
  },
  {
    key: "frontdesk.peakHours", module: "frontdesk", entity: "visitor", type: "bar",
    title: "Peak hours", description: "Visitor arrivals by hour of day",
    compute: async (c) => {
      const s = await c.scopeOf("visitor");
      const rows: any[] = await prisma.visitor.findMany({ where: { AND: [baseWhere(s.where, "visitDate", c.window), { timeIn: { not: null } }] }, select: { timeIn: true }, take: 20000 });
      const buckets = new Array(24).fill(0);
      for (const r of rows) buckets[new Date(r.timeIn).getHours()]++;
      return barSeries(buckets.map((_, h) => `${String(h).padStart(2, "0")}:00`), buckets, "Visitors");
    },
  },
  {
    key: "frontdesk.avgDuration", module: "frontdesk", entity: "visitor", type: "kpi",
    title: "Avg visit duration",
    compute: async (c) => {
      const s = await c.scopeOf("visitor");
      const rows: any[] = await prisma.visitor.findMany({ where: { AND: [baseWhere(s.where, "visitDate", c.window), { timeIn: { not: null } }, { timeOut: { not: null } }] }, select: { timeIn: true, timeOut: true }, take: 20000 });
      if (!rows.length) return { ...kpi(0), unit: "min" };
      const avg = rows.reduce((a, r) => a + (new Date(r.timeOut).getTime() - new Date(r.timeIn).getTime()), 0) / rows.length / 60000;
      return { ...kpi(Math.round(avg)), unit: "min" };
    },
  },
  {
    key: "frontdesk.currentlyInside", module: "frontdesk", entity: "visitor", type: "kpi",
    title: "Currently inside",
    compute: async (c) => {
      const s = await c.scopeOf("visitor");
      const v = await scopedCount("visitor", s, "visitDate", parseWindow({ preset: "today" }), { timeIn: { not: null }, timeOut: null });
      return kpi(v);
    },
  },

  // -------------------- QUICK PASS (gate pass) --------------------
  {
    key: "quickpass.byStatus", module: "quickPass", entity: "gatePass", type: "donut",
    title: "Gate passes by status", drill: "/quickpass/gate-passes",
    compute: async (c) => {
      const s = await c.scopeOf("gatePass");
      return donut(await groupCount("gatePass", "status", baseWhere(s.where, "createdAt", c.window)));
    },
  },
  {
    key: "quickpass.issuedPerDay", module: "quickPass", entity: "gatePass", type: "line",
    title: "Passes issued per day", drill: "/quickpass/gate-passes",
    compute: async (c) => {
      const s = await c.scopeOf("gatePass");
      const rows: any[] = await prisma.gatePass.findMany({ where: baseWhere(s.where, "createdAt", c.window), select: { createdAt: true }, take: 20000 });
      const ser = bucketSeries(rows.map((r) => r.createdAt), c.filters.bucket || "day");
      return { labels: ser.labels, series: [{ name: "Issued", data: ser.data }] };
    },
  },
  {
    key: "quickpass.topRecipients", module: "quickPass", entity: "gatePass", type: "leaderboard",
    title: "Top recipients", drill: "/quickpass/recipients",
    compute: async (c) => {
      const s = await c.scopeOf("gatePass");
      const rows = await groupCount("gatePass", "customerId", baseWhere(s.where, "createdAt", c.window));
      const names = await labelMap("customer", rows.map((r) => r.key));
      return { rows: rows.map((r) => ({ label: names.get(r.key) || r.key || "—", value: r.count })) };
    },
  },
  {
    key: "quickpass.topItems", module: "quickPass", entity: "gatePassItem", type: "leaderboard",
    title: "Top items moved", drill: "/quickpass/items",
    compute: async (c) => {
      // gate-pass items inherit the gate-pass read gate; no extra scope (vouchers are org-wide).
      const rows = await groupSum("gatePassItem", "itemId", "quantity", { isDeleted: null });
      const names = await labelMap("item", rows.map((r) => r.key));
      return { rows: rows.map((r) => ({ label: names.get(r.key) || r.key || "—", value: r.sum })) };
    },
  },
  {
    key: "quickpass.pendingApprovals", module: "quickPass", entity: "gatePass", type: "kpi",
    title: "Pending approvals", drill: "/quickpass/gate-passes",
    compute: async (c) => { const s = await c.scopeOf("gatePass"); return kpi(await scopedCount("gatePass", s, null, c.window, { status: "pending" })); },
  },
  {
    key: "quickpass.dispatchedNotReturned", module: "quickPass", entity: "gatePass", type: "kpi",
    title: "Dispatched, not returned", drill: "/quickpass/gate-passes",
    compute: async (c) => { const s = await c.scopeOf("gatePass"); return kpi(await scopedCount("gatePass", s, null, c.window, { status: "dispatched" })); },
  },

  // -------------------- CRM --------------------
  {
    key: "crm.pipelineByStage", module: "crm", entity: "lead", type: "bar",
    title: "Pipeline value by stage", drill: "/crm/leads",
    compute: async (c) => {
      const s = await c.scopeOf("lead");
      const rows = await groupSum("lead", "stage", "estimatedValue", baseWhere(s.where, "dateReceived", c.window));
      return barSeries(rows.map((r) => String(r.key)), rows.map((r) => r.sum), "Pipeline (PKR)");
    },
  },
  {
    key: "crm.funnel", module: "crm", entity: "lead", type: "funnel",
    title: "Lead funnel", drill: "/crm/leads",
    compute: async (c) => {
      const s = await c.scopeOf("lead");
      const order = ["NEW", "CONTACTED", "QUALIFIED", "QUOTATION", "NEGOTIATION", "WON"];
      const rows = await groupCount("lead", "stage", baseWhere(s.where, "dateReceived", c.window));
      const by = new Map(rows.map((r) => [r.key, r.count]));
      return { stages: order.map((st) => ({ label: st, value: by.get(st) || 0 })) };
    },
  },
  {
    key: "crm.wonLost", module: "crm", entity: "lead", type: "donut",
    title: "Won vs lost", drill: "/crm/leads",
    compute: async (c) => {
      const s = await c.scopeOf("lead");
      const rows = await groupCount("lead", "stage", { AND: [baseWhere(s.where, "dateReceived", c.window), { stage: { in: ["WON", "LOST"] } }] });
      return donut(rows);
    },
  },
  {
    key: "crm.lostReasons", module: "crm", entity: "lead", type: "bar",
    title: "Lost reasons", drill: "/crm/leads",
    compute: async (c) => {
      const s = await c.scopeOf("lead");
      const rows = await groupCount("lead", "lostReason", { AND: [baseWhere(s.where, "dateReceived", c.window), { stage: "LOST" }] });
      return barSeries(rows.map((r) => String(r.key ?? "—")), rows.map((r) => r.count), "Lost");
    },
  },
  {
    key: "crm.followUpsDue", module: "crm", entity: "lead", type: "kpi",
    title: "Follow-ups due", description: "Open leads with a follow-up due", drill: "/crm/leads",
    compute: async (c) => {
      const s = await c.scopeOf("lead");
      const now = new Date();
      const due = await prisma.lead.count({ where: { AND: [{ isDeleted: null }, s.where, { nextFollowUpAt: { lte: now } }, { stage: { notIn: ["WON", "LOST"] } }] } });
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
      const overdue = await prisma.lead.count({ where: { AND: [{ isDeleted: null }, s.where, { nextFollowUpAt: { lt: new Date(new Date().setHours(0, 0, 0, 0)) } }, { stage: { notIn: ["WON", "LOST"] } }] } });
      return { value: due, extra: { overdue } };
    },
  },
  {
    key: "crm.agentLeaderboard", module: "crm", entity: "salesOrder", type: "leaderboard",
    title: "Agent leaderboard vs target", drill: "/crm/agents",
    compute: async (c) => {
      const s = await c.scopeOf("salesOrder");
      const rows = await groupSum("salesOrder", "agentId", "total", baseWhere(s.where, "createdAt", c.window));
      const agents: any[] = await prisma.salesAgent.findMany({ where: { id: { in: rows.map((r) => r.key).filter(Boolean) } }, select: { id: true, agentCode: true, monthlyTarget: true, employee: { select: { name: true } } } });
      const meta = new Map(agents.map((a) => [a.id, a]));
      return {
        rows: rows.map((r) => {
          const a = meta.get(r.key);
          const target = a?.monthlyTarget || 0;
          return { label: a?.employee?.name || a?.agentCode || "—", value: r.sum, target, pct: target ? Math.round((r.sum / target) * 100) : null };
        }),
      };
    },
  },
  {
    key: "crm.salesByAgent", module: "crm", entity: "salesOrder", type: "bar",
    title: "Sales by agent", drill: "/crm/reports",
    compute: async (c) => {
      const s = await c.scopeOf("salesOrder");
      const rows = await groupSum("salesOrder", "agentId", "total", baseWhere(s.where, "createdAt", c.window));
      const agents: any[] = await prisma.salesAgent.findMany({ where: { id: { in: rows.map((r) => r.key).filter(Boolean) } }, select: { id: true, agentCode: true, employee: { select: { name: true } } } });
      const meta = new Map(agents.map((a) => [a.id, a.employee?.name || a.agentCode]));
      return barSeries(rows.map((r) => String(meta.get(r.key) || r.key || "—")), rows.map((r) => r.sum), "Sales (PKR)");
    },
  },
  {
    key: "crm.salesByProduct", module: "crm", entity: "salesOrder", type: "bar",
    title: "Sales by product", drill: "/crm/reports",
    compute: async (c) => {
      const s = await c.scopeOf("salesOrder");
      const d = dateWhere("createdAt", c.window);
      const rows: any[] = await prisma.salesOrderItem.groupBy({
        by: ["productId"],
        where: { isDeleted: null, order: { is: { AND: [{ isDeleted: null }, s.where, ...(Object.keys(d).length ? [d] : [])] } } },
        _sum: { lineTotal: true },
      });
      const top = rows.map((r) => ({ key: r.productId, sum: Number(r._sum?.lineTotal ?? 0) })).sort((a, b) => b.sum - a.sum).slice(0, GROUP_CAP);
      const names = await labelMap("product", top.map((r) => r.key));
      return barSeries(top.map((r) => String(names.get(r.key) || r.key || "—")), top.map((r) => r.sum), "Revenue (PKR)");
    },
  },
  {
    key: "crm.returnsRate", module: "crm", entity: "salesReturn", type: "kpi",
    title: "Returns rate", description: "Returns ÷ orders in period", drill: "/crm/returns",
    compute: async (c) => {
      const os = await c.scopeOf("salesOrder");
      const rs = await c.scopeOf("salesReturn");
      const orders = await scopedCount("salesOrder", os, "createdAt", c.window);
      const returns = await scopedCount("salesReturn", rs, "reportedAt", c.window);
      const rate = orders ? Math.round((returns / orders) * 1000) / 10 : 0;
      return { value: rate, unit: "%", extra: { orders, returns } };
    },
  },
  {
    key: "crm.returnReasons", module: "crm", entity: "salesReturn", type: "bar",
    title: "Return reasons", drill: "/crm/returns",
    compute: async (c) => {
      const s = await c.scopeOf("salesReturn");
      const rows = await groupCount("salesReturn", "reason", baseWhere(s.where, "reportedAt", c.window));
      return barSeries(rows.map((r) => String(r.key ?? "—")), rows.map((r) => r.count), "Returns");
    },
  },
  {
    key: "crm.quotationConversion", module: "crm", entity: "quotation", type: "gauge",
    title: "Quotation conversion", description: "Accepted ÷ total quotations", drill: "/crm/quotations",
    compute: async (c) => {
      const s = await c.scopeOf("quotation");
      const total = await scopedCount("quotation", s, "createdAt", c.window);
      const accepted = await scopedCount("quotation", s, "createdAt", c.window, { status: "ACCEPTED" });
      const pct = total ? Math.round((accepted / total) * 100) : 0;
      return { value: pct, target: 100, pct, unit: "%", extra: { accepted, total } };
    },
  },

  // -------------------- WORK --------------------
  {
    key: "work.tasksByStatus", module: "work", entity: "task", type: "bar",
    title: "Tasks by status", drill: "/work/team-board",
    compute: async (c) => {
      const s = await c.scopeOf("task");
      const rows = await groupCount("task", "status", baseWhere(s.where, "createdAt", c.window));
      return barSeries(rows.map((r) => String(r.key)), rows.map((r) => r.count), "Tasks");
    },
  },
  {
    key: "work.overdue", module: "work", entity: "task", type: "kpi",
    title: "Overdue tasks", drill: "/work/team-board",
    compute: async (c) => {
      const s = await c.scopeOf("task");
      const v = await prisma.task.count({ where: { AND: [{ isDeleted: null }, s.where, { dueDate: { lt: new Date() } }, { completedAt: null }] } });
      return kpi(v);
    },
  },
  {
    key: "work.overdueByTeam", module: "work", entity: "task", type: "bar",
    title: "Overdue by team", drill: "/work/teams",
    compute: async (c) => {
      const s = await c.scopeOf("task");
      const rows = await groupCount("task", "teamId", { AND: [{ isDeleted: null }, s.where, { dueDate: { lt: new Date() } }, { completedAt: null }] });
      const names = await labelMap("team", rows.map((r) => r.key), "name");
      return barSeries(rows.map((r) => String(names.get(r.key) || r.key || "—")), rows.map((r) => r.count), "Overdue");
    },
  },
  {
    key: "work.completionRate", module: "work", entity: "task", type: "gauge",
    title: "Completion rate", description: "Completed ÷ tasks in period", drill: "/work/reports",
    compute: async (c) => {
      const s = await c.scopeOf("task");
      const total = await scopedCount("task", s, "createdAt", c.window);
      const done = await scopedCount("task", s, "createdAt", c.window, { completedAt: { not: null } });
      const pct = total ? Math.round((done / total) * 100) : 0;
      return { value: pct, target: 100, pct, unit: "%", extra: { done, total } };
    },
  },
  {
    key: "work.reportCompliance", module: "work", entity: "dailyReport", type: "kpi",
    title: "Daily reports today", description: "Daily reports submitted today", drill: "/work/daily-reports",
    compute: async (c) => {
      const s = await c.scopeOf("dailyReport");
      return kpi(await scopedCount("dailyReport", s, "date", parseWindow({ preset: "today" })));
    },
  },
  {
    key: "work.hoursLogged", module: "work", entity: "dailyReport", type: "line",
    title: "Hours logged", description: "Hours from daily reports per day", drill: "/work/daily-reports",
    compute: async (c) => {
      const s = await c.scopeOf("dailyReport");
      const rows: any[] = await prisma.dailyReport.findMany({ where: baseWhere(s.where, "date", c.window), select: { date: true, hours: true }, take: 20000 });
      const by = new Map<string, number>();
      for (const r of rows) { if (!r.date) continue; const k = new Date(r.date).toISOString().slice(0, 10); by.set(k, (by.get(k) || 0) + (r.hours || 0)); }
      const labels = [...by.keys()].sort();
      return { labels, series: [{ name: "Hours", data: labels.map((l) => Math.round((by.get(l) || 0) * 10) / 10) }] };
    },
  },

  // -------------------- ACCESS / AUDIT --------------------
  {
    key: "access.activeUsers", module: "access", entity: "auditLog", type: "kpi",
    title: "Active users", description: "Distinct users who logged in (period)",
    compute: async (c) => {
      const rows: any[] = await prisma.auditLog.findMany({ where: { AND: [{ action: "LOGIN" }, dateWhere("createdAt", c.window)] }, select: { userId: true }, take: 50000 });
      return kpi(new Set(rows.map((r) => r.userId).filter(Boolean)).size);
    },
  },
  {
    key: "access.loginsPerDay", module: "access", entity: "auditLog", type: "line",
    title: "Logins per day",
    compute: async (c) => {
      const rows: any[] = await prisma.auditLog.findMany({ where: { AND: [{ action: "LOGIN" }, dateWhere("createdAt", c.window)] }, select: { createdAt: true }, take: 50000 });
      const ser = bucketSeries(rows.map((r) => r.createdAt), c.filters.bucket || "day");
      return { labels: ser.labels, series: [{ name: "Logins", data: ser.data }] };
    },
  },
  {
    key: "access.failedLogins", module: "access", entity: "auditLog", type: "kpi",
    title: "Failed logins",
    compute: async (c) => kpi(await prisma.auditLog.count({ where: { AND: [{ action: "LOGIN_FAILED" }, dateWhere("createdAt", c.window)] } })),
  },
  {
    key: "access.topActions", module: "access", entity: "auditLog", type: "bar",
    title: "Top audit actions", drill: "/admin/settings/audit-log",
    compute: async (c) => {
      const rows = await groupCount("auditLog", "action", { AND: [dateWhere("createdAt", c.window)] });
      return barSeries(rows.map((r) => String(r.key)), rows.map((r) => r.count), "Events");
    },
  },
];

export const WIDGET_BY_KEY: Record<string, WidgetDef> = Object.fromEntries(WIDGETS.map((w) => [w.key, w]));
