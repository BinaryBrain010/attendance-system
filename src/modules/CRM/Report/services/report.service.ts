import prisma from "../../../../core/models/base.model";
import { resolveScope } from "../../shared/scope";
import { OPEN_STAGES, weightedValue } from "../../shared/computed";

/** Common report filter -> Prisma where fragment (company / outlet / city / agent / date range). */
function baseWhere(f: any = {}, dateField = "createdAt"): Record<string, any> {
  const w: Record<string, any> = { isDeleted: null };
  if (f.company) w.company = f.company;
  if (f.outlet) w.outlet = f.outlet;
  if (f.city) w.city = { contains: f.city, mode: "insensitive" };
  if (f.agentId) w.agentId = f.agentId;
  if (f.from || f.to) {
    w[dateField] = {};
    if (f.from) w[dateField].gte = new Date(f.from);
    if (f.to) w[dateField].lte = new Date(f.to);
  }
  return w;
}

class ReportService {
  /** Open-pipeline value + weighted, scoped, with a by-stage breakdown. */
  async pipeline(userId: string, f: any = {}) {
    const scope = await resolveScope(userId, "lead");
    const where = { AND: [baseWhere(f, "dateReceived"), { stage: { in: OPEN_STAGES } }, scope.where] };
    const leads = await prisma.lead.findMany({ where, select: { stage: true, estimatedValue: true } });
    const byStage: Record<string, { stage: string; count: number; value: number; weighted: number }> = {};
    let totalValue = 0, weighted = 0;
    for (const l of leads) {
      const v = l.estimatedValue || 0;
      const wtd = weightedValue(l.stage, v);
      totalValue += v; weighted += wtd;
      const s = (byStage[l.stage] ||= { stage: l.stage, count: 0, value: 0, weighted: 0 });
      s.count++; s.value += v; s.weighted += wtd;
    }
    return { scope: scope.mode, count: leads.length, totalValue, weightedValue: weighted, byStage: Object.values(byStage) };
  }

  /** Lead counts by stage (funnel), scoped. */
  async funnel(userId: string, f: any = {}) {
    const scope = await resolveScope(userId, "lead");
    const where = { AND: [baseWhere(f, "dateReceived"), scope.where] };
    const grouped = await prisma.lead.groupBy({ by: ["stage"], where, _count: { _all: true } });
    const byStage = grouped.map((g) => ({ stage: g.stage, count: g._count._all }));
    const total = byStage.reduce((s, r) => s + r.count, 0);
    return { scope: scope.mode, total, byStage };
  }

  /** Delivered-order revenue by outlet, scoped. */
  async salesByOutlet(userId: string, f: any = {}) {
    const scope = await resolveScope(userId, "order");
    const where = { AND: [baseWhere(f, "createdAt"), { status: "DELIVERED" as const }, scope.where] };
    const grouped = await prisma.salesOrder.groupBy({ by: ["outlet"], where, _sum: { total: true }, _count: { _all: true } });
    return { scope: scope.mode, byOutlet: grouped.map((g) => ({ outlet: g.outlet, orders: g._count._all, revenue: g._sum.total || 0 })) };
  }

  /**
   * Margin on delivered orders (scoped). Cost-gated: the controller rejects callers without
   * crm.catalogue.cost.* before this runs.
   */
  async margin(userId: string, f: any = {}) {
    const scope = await resolveScope(userId, "order");
    const where = { AND: [baseWhere(f, "createdAt"), { status: "DELIVERED" as const }, scope.where] };
    const orders = await prisma.salesOrder.findMany({ where, include: { items: { where: { isDeleted: null } } } });
    // Margin is computed ONLY over lines with a known unit cost. Lines whose cost is still pending
    // (null) are excluded from BOTH the revenue base and the cost — never counted as zero cost, so
    // the margin is honest. Excluded revenue is reported separately.
    let revenue = 0, cost = 0, pendingRevenue = 0, pendingLines = 0, costedLines = 0;
    for (const o of orders) {
      for (const it of o.items) {
        const lineRev = it.lineTotal ?? (it.unitPrice || 0) * (it.quantity || 0);
        if (it.unitCost === null || it.unitCost === undefined) { pendingRevenue += lineRev; pendingLines++; continue; }
        revenue += lineRev; cost += it.unitCost * (it.quantity || 0); costedLines++;
      }
    }
    const margin = revenue - cost;
    return {
      scope: scope.mode, orders: orders.length,
      revenue, cost, margin, marginPct: revenue ? Math.round((margin / revenue) * 100) : 0,
      costedLines, pendingLines, pendingRevenue,
      note: pendingLines ? `${pendingLines} line(s) excluded from margin — cost pending` : undefined,
    };
  }
}

export default ReportService;
