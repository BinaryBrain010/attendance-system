import prisma from "../../../../core/models/base.model";

const include = {
  employee: { select: { id: true, name: true, surname: true, code: true, company: true } },
  teamLead: { select: { id: true, agentCode: true } },
  // The agent's login (via SalesAgent.userId). Null -> no login -> the agent cannot use the CRM.
  user: { select: { id: true, username: true } },
};

class SalesAgentService {
  getAll() {
    return prisma.salesAgent.findMany({ where: { isDeleted: null }, include, orderBy: { agentCode: "asc" } });
  }
  async get(page = 1, pageSize = 10) {
    const skip = (page - 1) * pageSize;
    const [data, totalSize] = await Promise.all([
      prisma.salesAgent.findMany({ where: { isDeleted: null }, include, skip, take: pageSize, orderBy: { agentCode: "asc" } }),
      prisma.salesAgent.count({ where: { isDeleted: null } }),
    ]);
    return { data, totalSize };
  }
  getById(id: string) {
    return prisma.salesAgent.findUnique({ where: { id }, include: { ...include, members: { where: { isDeleted: null }, select: { id: true, agentCode: true, employee: { select: { name: true, surname: true } } } } } });
  }
  /**
   * Aggregate stats for the agent detail page. Sales rows carry a loose `agentId` column (no Prisma
   * relation), so each metric is a direct count/sum filtered by agentId. "This month" uses updatedAt
   * as the won-at proxy (leads have no wonAt timestamp). Pipeline = sum of open-stage estimatedValue.
   */
  async stats(id: string) {
    const agent: any = await this.getById(id);
    if (!agent) return null;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const OPEN_STAGES: any[] = ["NEW", "CONTACTED", "QUALIFIED", "QUOTATION", "NEGOTIATION", "ON_HOLD"];
    const base = { agentId: id, isDeleted: null };
    const [leads, quotations, orders, returns, wonLeads, openLeads, wonThisMonth, recentActivity, recentLeads, dueToday, overdue] = await Promise.all([
      prisma.lead.count({ where: base }),
      prisma.quotation.count({ where: base }),
      prisma.salesOrder.count({ where: base }),
      prisma.salesReturn.count({ where: base }),
      prisma.lead.findMany({ where: { ...base, stage: "WON" }, select: { estimatedValue: true } }),
      prisma.lead.findMany({ where: { ...base, stage: { in: OPEN_STAGES } }, select: { estimatedValue: true } }),
      prisma.lead.findMany({ where: { ...base, stage: "WON", updatedAt: { gte: monthStart } }, select: { estimatedValue: true } }),
      prisma.leadActivity.findMany({ where: { agentId: id, isDeleted: null }, orderBy: { occurredAt: "desc" }, take: 10, select: { id: true, type: true, outcome: true, notes: true, occurredAt: true, leadId: true } }),
      prisma.lead.findMany({ where: base, orderBy: { updatedAt: "desc" }, take: 10, select: { id: true, customerName: true, stage: true, estimatedValue: true, city: true, nextFollowUpAt: true } }),
      // Open leads whose next follow-up is today, and those already overdue (server-computed).
      prisma.lead.count({ where: { ...base, stage: { in: OPEN_STAGES }, nextFollowUpAt: { gte: todayStart, lte: todayEnd } } }),
      prisma.lead.count({ where: { ...base, stage: { in: OPEN_STAGES }, nextFollowUpAt: { lt: todayStart } } }),
    ]);
    const sum = (arr: any[]) => arr.reduce((t, x) => t + (x.estimatedValue || 0), 0);
    const wonValueThisMonth = sum(wonThisMonth);
    const target = agent.monthlyTarget ?? null;
    const achievedPct = target && target > 0 ? Math.round((wonValueThisMonth / target) * 100) : null;
    const conversionRate = leads > 0 ? Math.round((wonLeads.length / leads) * 100) : 0;
    return {
      agent,
      counts: { leads, quotations, orders, returns, wonLeads: wonLeads.length },
      target, wonValueThisMonth, achievedPct, conversionRate,
      wonValue: sum(wonLeads), pipelineValue: sum(openLeads),
      dueToday, overdue,
      recentActivity, recentLeads,
    };
  }

  /** Paginated activity feed for one agent (Activity tab). Lead names resolved (no raw ids). */
  async activity(id: string, page = 1, pageSize = 20) {
    const skip = (Math.max(1, page) - 1) * pageSize;
    const where = { agentId: id, isDeleted: null };
    const [rows, totalSize] = await Promise.all([
      prisma.leadActivity.findMany({ where, orderBy: { occurredAt: "desc" }, skip, take: Math.min(pageSize, 100), select: { id: true, type: true, outcome: true, notes: true, occurredAt: true, nextFollowUpAt: true, leadId: true } }),
      prisma.leadActivity.count({ where }),
    ]);
    const leadIds = Array.from(new Set(rows.map((r) => r.leadId)));
    const leads = leadIds.length ? await prisma.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, customerName: true } }) : [];
    const nameOf = new Map(leads.map((l) => [l.id, l.customerName]));
    return { data: rows.map((r) => ({ ...r, leadName: nameOf.get(r.leadId) || null })), totalSize };
  }
  me(userId: string) {
    return prisma.salesAgent.findFirst({ where: { userId, isDeleted: null }, include });
  }
  total() {
    return prisma.salesAgent.gpCount();
  }
  /** Resolve the linked User from the employeeId (employee create auto-creates a user). */
  async create(data: any) {
    let { userId } = data;
    if (!userId && data.employeeId) {
      const user = await prisma.user.findFirst({ where: { employeeId: data.employeeId, isDeleted: null }, select: { id: true } });
      userId = user?.id ?? null;
    }
    return prisma.salesAgent.gpCreate({ ...data, userId });
  }
  update(id: string, data: any) {
    return prisma.salesAgent.gpUpdate(id, data);
  }
  remove(id: string) {
    return prisma.salesAgent.gpSoftDelete(id);
  }
  restore(id: string) {
    return prisma.salesAgent.gpRestore(id);
  }
  search(term: string, page = 1, pageSize = 10) {
    return prisma.salesAgent.gpSearch(term, ["agentCode", "outlet"], page, pageSize);
  }
}

export default SalesAgentService;
