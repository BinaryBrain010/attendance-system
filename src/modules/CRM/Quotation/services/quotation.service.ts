import prisma from "../../../../core/models/base.model";
import { resolveScope, assertRowInScope, resolveAssignment } from "../../shared/scope";
import { priceLines } from "../../shared/pricing";
import { NotFoundError } from "../../../../core/errors/app.error";

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
    assertRowInScope(scope, row.agentId, "Quotation");
    return row;
  }
  async create(userId: string, data: any) {
    const scope = await resolveScope(userId, "quotation");
    const { items, ...rest } = data;
    rest.agentId = resolveAssignment(scope, rest.agentId);
    if (items) await priceLines(items); // block any line with no usable price (persisted in P3)
    return prisma.quotation.gpCreate(rest);
  }
  async update(userId: string, id: string, data: any) {
    const scope = await resolveScope(userId, "quotation");
    const existing = await prisma.quotation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Quotation");
    assertRowInScope(scope, existing.agentId, "Quotation");
    if (Object.prototype.hasOwnProperty.call(data, "agentId")) data.agentId = resolveAssignment(scope, data.agentId);
    return prisma.quotation.gpUpdate(id, data);
  }
  async remove(userId: string, id: string) {
    const scope = await resolveScope(userId, "quotation");
    const existing = await prisma.quotation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Quotation");
    assertRowInScope(scope, existing.agentId, "Quotation");
    return prisma.quotation.gpSoftDelete(id);
  }
  async restore(userId: string, id: string) {
    const scope = await resolveScope(userId, "quotation");
    const existing = await prisma.quotation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Quotation");
    assertRowInScope(scope, existing.agentId, "Quotation");
    return prisma.quotation.gpRestore(id);
  }
}

export default QuotationService;
