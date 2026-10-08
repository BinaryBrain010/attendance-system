import prisma from "../../../../core/models/base.model";
import { resolveScope, rowInScope } from "../../shared/scope";
import { ForbiddenError } from "../../../../core/errors/app.error";

function filterWhere(f: any = {}): Record<string, any> {
  const w: Record<string, any> = {};
  if (f.company) w.company = f.company;
  if (f.outlet) w.outlet = f.outlet;
  if (f.status) w.status = f.status;
  if (f.tier) w.tier = f.tier;
  if (f.agentId) w.agentId = f.agentId;
  if (f.activeOnly) w.isActive = true;
  if (f.from || f.to) {
    w.createdAt = {};
    if (f.from) w.createdAt.gte = new Date(f.from);
    if (f.to) w.createdAt.lte = new Date(f.to);
  }
  return w;
}

class QuotationService {
  async get(userId: string, page = 1, pageSize = 10, filters: any = {}) {
    const scope = await resolveScope(userId, "quotation");
    const where = { AND: [{ isDeleted: null }, filterWhere(filters), scope.where] };
    const skip = (page - 1) * pageSize;
    const [data, totalSize] = await Promise.all([
      prisma.quotation.findMany({ where, skip, take: pageSize, orderBy: { createdAt: "desc" } }),
      prisma.quotation.count({ where }),
    ]);
    return { data, totalSize, scope: scope.mode };
  }
  async total(userId: string, filters: any = {}) {
    const scope = await resolveScope(userId, "quotation");
    return prisma.quotation.count({ where: { AND: [{ isDeleted: null }, filterWhere(filters), scope.where] } });
  }
  async getById(userId: string, id: string) {
    const scope = await resolveScope(userId, "quotation");
    const row = await prisma.quotation.findUnique({ where: { id }, include: { items: { where: { isDeleted: null } } } });
    if (!row || row.isDeleted) return null;
    if (!rowInScope(scope, row.agentId)) throw new ForbiddenError("Quotation is outside your scope");
    return row;
  }
  create(data: any) {
    return prisma.quotation.gpCreate(data);
  }
  update(id: string, data: any) {
    return prisma.quotation.gpUpdate(id, data);
  }
  remove(id: string) {
    return prisma.quotation.gpSoftDelete(id);
  }
  restore(id: string) {
    return prisma.quotation.gpRestore(id);
  }
}

export default QuotationService;
