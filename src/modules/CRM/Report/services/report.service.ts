import prisma from "../../../../core/models/base.model";
import { resolveScope } from "../../shared/scope";
import { OPEN_STAGES, weightedValue, probabilityFor } from "../../shared/computed";

/** Common filter -> where fragment (company / outlet / city / agent / channel / date range). */
function baseWhere(f: any = {}, dateField = "createdAt"): Record<string, any> {
  const w: Record<string, any> = { isDeleted: null };
  if (f.company) w.company = f.company;
  if (f.outlet) w.outlet = f.outlet;
  if (f.city) w.city = { contains: f.city, mode: "insensitive" };
  if (f.channel) w.channel = f.channel;
  if (f.agentId) w.agentId = f.agentId;
  if (f.from || f.to) { w[dateField] = {}; if (f.from) w[dateField].gte = new Date(f.from); if (f.to) w[dateField].lte = new Date(f.to); }
  return w;
}
const day = 86400000;
const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const daysBetween = (a: Date, b: Date) => Math.floor((startOfDay(b).getTime() - startOfDay(a).getTime()) / day);
const FUNNEL_ORDER = ["NEW", "CONTACTED", "QUALIFIED", "QUOTATION", "NEGOTIATION", "WON"];

async function agentNames(): Promise<Record<string, { code: string; name: string; target: number | null }>> {
  const agents = await prisma.salesAgent.findMany({ where: { isDeleted: null }, include: { employee: { select: { name: true, surname: true } } } });
  const map: Record<string, any> = {};
  for (const a of agents) map[a.id] = { code: a.agentCode, name: a.employee ? `${a.employee.name} ${a.employee.surname}` : a.agentCode, target: a.monthlyTarget };
  return map;
}

class ReportService {
  // ---- helpers to load scoped rows once ----
  private async leads(userId: string, f: any, where: any = {}) {
    const scope = await resolveScope(userId, "lead");
    return { scope: scope.mode, rows: await prisma.lead.findMany({ where: { AND: [baseWhere(f, "dateReceived"), where, scope.where] } }) };
  }
  private async orders(userId: string, f: any, where: any = {}, withItems = false) {
    const scope = await resolveScope(userId, "order");
    return { scope: scope.mode, rows: await prisma.salesOrder.findMany({ where: { AND: [baseWhere(f, "createdAt"), where, scope.where] }, include: withItems ? { items: { where: { isDeleted: null } } } : undefined }) };
  }
  private async returns(userId: string, f: any) {
    const scope = await resolveScope(userId, "return");
    const w: any = { isDeleted: null };
    if (f.city) w.city = { contains: f.city, mode: "insensitive" };
    if (f.agentId) w.agentId = f.agentId;
    if (f.from || f.to) { w.reportedAt = {}; if (f.from) w.reportedAt.gte = new Date(f.from); if (f.to) w.reportedAt.lte = new Date(f.to); }
    return { scope: scope.mode, rows: await prisma.salesReturn.findMany({ where: { AND: [w, scope.where] }, include: { items: { where: { isDeleted: null } } } }) };
  }

  /** 1. Dashboard KPIs. */
  async dashboard(userId: string, f: any = {}) {
    const { scope, rows: allLeads } = await this.leads(userId, {}); // period counts ignore the date filter
    const now = new Date(), t0 = startOfDay(now).getTime();
    const weekAgo = t0 - 6 * day, monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const created = (since: number) => allLeads.filter((l) => l.dateReceived && new Date(l.dateReceived).getTime() >= since).length;
    const won = allLeads.filter((l) => l.stage === "WON");
    const open = allLeads.filter((l) => OPEN_STAGES.includes(l.stage));
    const overdue = open.filter((l) => l.nextFollowUpAt && new Date(l.nextFollowUpAt).getTime() < t0).length;
    const wonValue = won.reduce((s, l) => s + (l.estimatedValue || 0), 0);
    const pipelineValue = open.reduce((s, l) => s + (l.estimatedValue || 0), 0);
    const { rows: deliveredAll } = await this.orders(userId, f, { status: "DELIVERED" });
    const delivered = deliveredAll.filter((o: any) => o.sourceFile !== "RETURNS_IMPORT"); // exclude imported RTOs
    const { rows: returnRows } = await this.returns(userId, f);
    const returnsRate = delivered.length ? Math.round((returnRows.length / delivered.length) * 100) : 0;
    return {
      scope,
      leads: { today: created(t0), thisWeek: created(weekAgo), thisMonth: created(monthStart), total: allLeads.length },
      won: won.length, wonValue, conversionPct: allLeads.length ? Math.round((won.length / allLeads.length) * 100) : 0,
      pipelineValue, overdueFollowUps: overdue, deliveredOrders: delivered.length, returns: returnRows.length, returnsRatePct: returnsRate,
    };
  }

  /** 2. Agent performance. */
  async agentPerformance(userId: string, f: any = {}) {
    const { scope, rows } = await this.leads(userId, f);
    const names = await agentNames();
    const now = new Date();
    const by: Record<string, any> = {};
    for (const l of rows) {
      const k = l.agentId || "(unassigned)";
      const a = (by[k] ||= { agent: names[k]?.code || k, name: names[k]?.name || k, target: names[k]?.target ?? null, leads: 0, won: 0, wonValue: 0, closeDaysSum: 0, closeN: 0, overdue: 0 });
      a.leads++;
      if (l.stage === "WON") { a.won++; a.wonValue += l.estimatedValue || 0; if (l.dateReceived) { a.closeDaysSum += daysBetween(new Date(l.dateReceived), l.lastContactAt ? new Date(l.lastContactAt) : now); a.closeN++; } }
      if (OPEN_STAGES.includes(l.stage) && l.nextFollowUpAt && new Date(l.nextFollowUpAt) < startOfDay(now)) a.overdue++;
    }
    const agents = Object.values(by).map((a: any) => ({
      agent: a.agent, name: a.name, leads: a.leads, won: a.won, wonValue: a.wonValue,
      conversionPct: a.leads ? Math.round((a.won / a.leads) * 100) : 0, avgDaysToClose: a.closeN ? Math.round(a.closeDaysSum / a.closeN) : null,
      overdueFollowUps: a.overdue, target: a.target, achievedPct: a.target ? Math.round((a.wonValue / a.target) * 100) : null,
    })).sort((x, y) => y.wonValue - x.wonValue);
    return { scope, agents };
  }

  /** 3. Funnel + drop-off per stage. */
  async funnel(userId: string, f: any = {}) {
    const { scope, rows } = await this.leads(userId, f);
    const counts: Record<string, number> = {};
    for (const l of rows) counts[l.stage] = (counts[l.stage] || 0) + 1;
    let prev = 0;
    const stages = FUNNEL_ORDER.map((stage, i) => {
      const count = counts[stage] || 0;
      const dropFromPrev = i === 0 ? 0 : (prev ? Math.round(((prev - count) / prev) * 100) : 0);
      prev = count;
      return { stage, count, dropFromPrevPct: dropFromPrev };
    });
    return { scope, total: rows.length, lost: counts["LOST"] || 0, onHold: counts["ON_HOLD"] || 0, stages };
  }

  /** 4. Pipeline: open value + weighted, by stage and by agent. */
  async pipeline(userId: string, f: any = {}) {
    const { scope, rows } = await this.leads(userId, f, { stage: { in: OPEN_STAGES } });
    const names = await agentNames();
    const byStage: Record<string, any> = {}, byAgent: Record<string, any> = {};
    let totalValue = 0, weighted = 0;
    for (const l of rows) {
      const v = l.estimatedValue || 0, w = weightedValue(l.stage, v);
      totalValue += v; weighted += w;
      const s = (byStage[l.stage] ||= { stage: l.stage, probability: probabilityFor(l.stage), count: 0, value: 0, weighted: 0 }); s.count++; s.value += v; s.weighted += w;
      const ak = l.agentId || "(unassigned)";
      const a = (byAgent[ak] ||= { agent: names[ak]?.code || ak, name: names[ak]?.name || ak, count: 0, value: 0, weighted: 0 }); a.count++; a.value += v; a.weighted += w;
    }
    return { scope, count: rows.length, totalValue, weightedValue: weighted, byStage: Object.values(byStage), byAgent: Object.values(byAgent).sort((x: any, y: any) => y.value - x.value) };
  }

  /** 5. Sales by a dimension (product/category/channel/city/outlet).
   * basis "orders" (default) = delivered orders; "wonLeads" = won leads by estimated value
   * (product/category not available on the won-leads basis — leads have no line items). */
  async salesBy(userId: string, dimension: string, f: any = {}) {
    const basis = f.basis === "wonLeads" ? "wonLeads" : "orders";
    if (basis === "wonLeads") {
      if (dimension === "product" || dimension === "category") {
        return { scope: (await resolveScope(userId, "lead")).mode, dimension, basis, rows: [], note: "Product/category breakdown is only available on the delivered-orders basis." };
      }
      const { scope, rows } = await this.leads(userId, f, { stage: "WON" });
      const agg: Record<string, { key: string; orders: number; revenue: number }> = {};
      for (const l of rows as any[]) {
        const key = String(l[dimension] ?? "(none)");
        const a = (agg[key] ||= { key, orders: 0, revenue: 0 }); a.revenue += l.estimatedValue || 0; a.orders++;
      }
      return { scope, dimension, basis, rows: Object.values(agg).sort((x, y) => y.revenue - x.revenue) };
    }
    const { scope, rows } = await this.orders(userId, f, { status: "DELIVERED" }, dimension === "product" || dimension === "category");
    const agg: Record<string, { key: string; orders: number; revenue: number }> = {};
    if (dimension === "product" || dimension === "category") {
      const pids = new Set<string>();
      rows.forEach((o: any) => o.items.forEach((it: any) => it.productId && pids.add(it.productId)));
      const prods = await prisma.product.findMany({ where: { id: { in: Array.from(pids) } }, include: { category: { select: { name: true } } } });
      const pmap: Record<string, any> = {}; prods.forEach((p) => (pmap[p.id] = p));
      for (const o of rows as any[]) for (const it of o.items) {
        const p = it.productId ? pmap[it.productId] : null;
        const key = dimension === "product" ? (p?.name || it.description || "(unknown)") : (p?.category?.name || "(uncategorized)");
        const a = (agg[key] ||= { key, orders: 0, revenue: 0 }); a.revenue += it.lineTotal || 0; a.orders++;
      }
    } else {
      for (const o of rows as any[]) {
        const key = String((o as any)[dimension] ?? "(none)");
        const a = (agg[key] ||= { key, orders: 0, revenue: 0 }); a.revenue += o.total || 0; a.orders++;
      }
    }
    return { scope, dimension, basis, rows: Object.values(agg).sort((x, y) => y.revenue - x.revenue) };
  }

  /** 6. Lost reasons. */
  async lostReasons(userId: string, f: any = {}) {
    const { scope, rows } = await this.leads(userId, f, { stage: "LOST" });
    const agg: Record<string, { reason: string; count: number; value: number }> = {};
    for (const l of rows) { const r = (l.lostReason || l.stageReason || "Unspecified").trim() || "Unspecified"; const a = (agg[r] ||= { reason: r, count: 0, value: 0 }); a.count++; a.value += l.estimatedValue || 0; }
    return { scope, total: rows.length, reasons: Object.values(agg).sort((x, y) => y.count - x.count) };
  }

  /** 7. Returns: rate + breakdowns by city/reason/courier/month, RTO value.
   * Orders created by the returns import (sourceFile "RETURNS_IMPORT") are excluded from the
   * returns-rate denominator, and their RTO value is reported as "pending price" (unit prices are 0
   * until catalogue prices exist and are backfilled). */
  async returnsReport(userId: string, f: any = {}) {
    const { scope, rows } = await this.returns(userId, f);
    const { rows: deliveredAll } = await this.orders(userId, f, { status: "DELIVERED" });
    const { rows: returnedOrders } = await this.orders(userId, f, { status: "RETURNED" }, true);
    const delivered = deliveredAll.filter((o: any) => o.sourceFile !== "RETURNS_IMPORT"); // exclude imported RTOs
    const byCity: Record<string, number> = {}, byReason: Record<string, number> = {}, byCourier: Record<string, number> = {}, byMonth: Record<string, number> = {}, courierFault: Record<string, number> = {};
    for (const r of rows) {
      byCity[r.city || "(none)"] = (byCity[r.city || "(none)"] || 0) + 1;
      const reason = (r.reason || "Unspecified").split("|")[0].trim();
      byReason[reason] = (byReason[reason] || 0) + 1;
      byCourier[r.courier || "(none)"] = (byCourier[r.courier || "(none)"] || 0) + 1;
      if (/^Courier fault/i.test(reason)) courierFault[r.courier || "(none)"] = (courierFault[r.courier || "(none)"] || 0) + 1;
      const m = r.reportedAt ? new Date(r.reportedAt).toISOString().slice(0, 7) : "(none)"; byMonth[m] = (byMonth[m] || 0) + 1;
    }
    // RTO value: only orders with a real price; imported (pending-price) ones are counted separately.
    let rtoValue = 0, rtoPendingOrders = 0;
    for (const o of returnedOrders as any[]) {
      if (o.sourceFile === "RETURNS_IMPORT" || !(o.total > 0)) rtoPendingOrders++;
      else rtoValue += o.total || 0;
    }
    const ratePct = delivered.length ? Math.round((rows.length / delivered.length) * 100) : 0;
    const srt = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, count: v }));
    return { scope, totalReturns: rows.length, deliveredOrders: delivered.length, ratePct, rtoValue, rtoPendingOrders, rtoPending: rtoPendingOrders > 0,
      byCity: srt(byCity), byReason: srt(byReason), byCourier: srt(byCourier), byMonth: srt(byMonth), courierFaultByCourier: srt(courierFault) };
  }

  /** 8. Lead aging + overdue follow-up list per agent. */
  async leadAging(userId: string, f: any = {}) {
    const { scope, rows } = await this.leads(userId, f, { stage: { in: OPEN_STAGES } });
    const names = await agentNames();
    const now = new Date();
    const buckets = { "0-7": 0, "8-30": 0, "31-60": 0, "60+": 0 } as Record<string, number>;
    const overdueByAgent: Record<string, { agent: string; name: string; overdue: number; leads: string[] }> = {};
    for (const l of rows) {
      const age = l.dateReceived ? daysBetween(new Date(l.dateReceived), now) : 0;
      buckets[age <= 7 ? "0-7" : age <= 30 ? "8-30" : age <= 60 ? "31-60" : "60+"]++;
      if (l.nextFollowUpAt && new Date(l.nextFollowUpAt) < startOfDay(now)) {
        const k = l.agentId || "(unassigned)";
        const a = (overdueByAgent[k] ||= { agent: names[k]?.code || k, name: names[k]?.name || k, overdue: 0, leads: [] });
        a.overdue++; if (a.leads.length < 25) a.leads.push(`${l.customerName}${l.leadNo ? ` (${l.leadNo})` : ""}`);
      }
    }
    return { scope, open: rows.length, ageBuckets: Object.entries(buckets).map(([k, v]) => ({ bucket: k, count: v })), overdueByAgent: Object.values(overdueByAgent).sort((x, y) => y.overdue - x.overdue) };
  }

  /** 9. Repeat customers (by phone): >1 won lead or >1 delivered order. */
  async repeatCustomers(userId: string, f: any = {}) {
    const { scope, rows: leads } = await this.leads(userId, f, { stage: "WON" });
    const { rows: orders } = await this.orders(userId, f, { status: "DELIVERED" });
    const by: Record<string, { phone: string; name: string; won: number; orders: number; value: number }> = {};
    const key = (p: string | null) => (p ? p.replace(/\D/g, "") : "");
    for (const l of leads) { const k = key(l.phone); if (!k) continue; const a = (by[k] ||= { phone: l.phone!, name: l.customerName, won: 0, orders: 0, value: 0 }); a.won++; a.value += l.estimatedValue || 0; }
    for (const o of orders) { const k = key(o.phone); if (!k) continue; const a = (by[k] ||= { phone: o.phone!, name: o.customerName, won: 0, orders: 0, value: 0 }); a.orders++; a.value += o.total || 0; }
    const repeat = Object.values(by).filter((c) => c.won + c.orders > 1).sort((a, b) => (b.won + b.orders) - (a.won + a.orders));
    return { scope, repeatCount: repeat.length, customers: repeat };
  }

  /** 10. Daily sales summary over the date range. */
  async dailySummary(userId: string, f: any = {}) {
    const { scope, rows: leads } = await this.leads(userId, f);
    const { rows: delivered } = await this.orders(userId, f, { status: "DELIVERED" });
    const { rows: returnRows } = await this.returns(userId, f);
    const days: Record<string, any> = {};
    const d = (x: any) => (x ? new Date(x).toISOString().slice(0, 10) : null);
    const bump = (key: string | null, field: string, amt = 1) => { if (!key) return; const r = (days[key] ||= { date: key, leads: 0, won: 0, delivered: 0, revenue: 0, returns: 0 }); r[field] += amt; };
    for (const l of leads) { bump(d(l.dateReceived), "leads"); if (l.stage === "WON") bump(d(l.dateReceived), "won"); }
    for (const o of delivered) { bump(d(o.deliveredAt || o.createdAt), "delivered"); bump(d(o.deliveredAt || o.createdAt), "revenue", o.total || 0); }
    for (const r of returnRows) bump(d(r.reportedAt), "returns");
    return { scope, days: Object.values(days).sort((a: any, b: any) => a.date.localeCompare(b.date)) };
  }

  /** 11. Margin (cost-gated in the controller). */
  async margin(userId: string, f: any = {}) {
    const { scope, rows: orders } = await this.orders(userId, f, { status: "DELIVERED" }, true);
    let revenue = 0, cost = 0, pendingRevenue = 0, pendingLines = 0, costedLines = 0;
    for (const o of orders as any[]) for (const it of o.items) {
      const lineRev = it.lineTotal ?? (it.unitPrice || 0) * (it.quantity || 0);
      if (it.unitCost == null) { pendingRevenue += lineRev; pendingLines++; continue; }
      revenue += lineRev; cost += it.unitCost * (it.quantity || 0); costedLines++;
    }
    const margin = revenue - cost;
    return { scope, orders: orders.length, revenue, cost, margin, marginPct: revenue ? Math.round((margin / revenue) * 100) : 0, costedLines, pendingLines, pendingRevenue, note: pendingLines ? `${pendingLines} line(s) excluded — cost pending` : undefined };
  }
}

export default ReportService;
