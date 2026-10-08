import prisma from "../../../../core/models/base.model";
import { resolveScope, rowInScope } from "../../shared/scope";
import { ForbiddenError } from "../../../../core/errors/app.error";

export interface LeadFilters {
  company?: string;
  outlet?: string;
  city?: string;
  stage?: string;
  priority?: string;
  channel?: string;
  agentId?: string;
  from?: string;
  to?: string;
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
  if (f.from || f.to) {
    w.dateReceived = {};
    if (f.from) w.dateReceived.gte = new Date(f.from);
    if (f.to) w.dateReceived.lte = new Date(f.to);
  }
  return w;
}

class LeadService {
  async get(userId: string, page = 1, pageSize = 10, filters: LeadFilters = {}) {
    const scope = await resolveScope(userId, "lead");
    const where = { AND: [{ isDeleted: null }, filterWhere(filters), scope.where] };
    const skip = (page - 1) * pageSize;
    const [data, totalSize] = await Promise.all([
      prisma.lead.findMany({ where, skip, take: pageSize, orderBy: { dateReceived: "desc" } }),
      prisma.lead.count({ where }),
    ]);
    return { data, totalSize, scope: scope.mode };
  }

  async total(userId: string, filters: LeadFilters = {}) {
    const scope = await resolveScope(userId, "lead");
    const where = { AND: [{ isDeleted: null }, filterWhere(filters), scope.where] };
    return prisma.lead.count({ where });
  }

  async getById(userId: string, id: string) {
    const scope = await resolveScope(userId, "lead");
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.isDeleted) return null;
    if (!rowInScope(scope, lead.agentId)) throw new ForbiddenError("Lead is outside your scope");
    return lead;
  }

  create(data: any) {
    return prisma.lead.gpCreate(data);
  }
  update(id: string, data: any) {
    return prisma.lead.gpUpdate(id, data);
  }
  remove(id: string) {
    return prisma.lead.gpSoftDelete(id);
  }
  restore(id: string) {
    return prisma.lead.gpRestore(id);
  }
}

export default LeadService;
