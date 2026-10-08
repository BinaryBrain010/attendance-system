import prisma from "../../../../core/models/base.model";
import { resolveScope, assertRowInScope, resolveAssignment } from "../../shared/scope";
import { NotFoundError } from "../../../../core/errors/app.error";

function filterWhere(f: any = {}): Record<string, any> {
  const w: Record<string, any> = {};
  if (f.company) w.company = f.company;
  if (f.outlet) w.outlet = f.outlet;
  if (f.city) w.city = { contains: f.city, mode: "insensitive" };
  if (f.status) w.status = f.status;
  if (f.channel) w.channel = f.channel;
  if (f.agentId) w.agentId = f.agentId;
  if (f.from || f.to) {
    w.createdAt = {};
    if (f.from) w.createdAt.gte = new Date(f.from);
    if (f.to) w.createdAt.lte = new Date(f.to);
  }
  return w;
}

class SalesOrderService {
  async get(userId: string, page = 1, pageSize = 10, filters: any = {}) {
    const scope = await resolveScope(userId, "order");
    const where = { AND: [{ isDeleted: null }, filterWhere(filters), scope.where] };
    const skip = (page - 1) * pageSize;
    const [data, totalSize] = await Promise.all([
      prisma.salesOrder.findMany({ where, skip, take: pageSize, orderBy: { createdAt: "desc" } }),
      prisma.salesOrder.count({ where }),
    ]);
    return { data, totalSize, scope: scope.mode };
  }
  async total(userId: string, filters: any = {}) {
    const scope = await resolveScope(userId, "order");
    return prisma.salesOrder.count({ where: { AND: [{ isDeleted: null }, filterWhere(filters), scope.where] } });
  }
  async getById(userId: string, id: string) {
    const scope = await resolveScope(userId, "order");
    const row = await prisma.salesOrder.findUnique({ where: { id }, include: { items: { where: { isDeleted: null } } } });
    if (!row || row.isDeleted) return null;
    assertRowInScope(scope, row.agentId, "Order");
    return row;
  }
  async create(userId: string, data: any) {
    const scope = await resolveScope(userId, "order");
    data.agentId = resolveAssignment(scope, data.agentId);
    return prisma.salesOrder.gpCreate(data);
  }
  async update(userId: string, id: string, data: any) {
    const scope = await resolveScope(userId, "order");
    const existing = await prisma.salesOrder.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Order");
    assertRowInScope(scope, existing.agentId, "Order");
    if (Object.prototype.hasOwnProperty.call(data, "agentId")) data.agentId = resolveAssignment(scope, data.agentId);
    return prisma.salesOrder.gpUpdate(id, data);
  }
  async remove(userId: string, id: string) {
    const scope = await resolveScope(userId, "order");
    const existing = await prisma.salesOrder.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Order");
    assertRowInScope(scope, existing.agentId, "Order");
    return prisma.salesOrder.gpSoftDelete(id);
  }
  async restore(userId: string, id: string) {
    const scope = await resolveScope(userId, "order");
    const existing = await prisma.salesOrder.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Order");
    assertRowInScope(scope, existing.agentId, "Order");
    return prisma.salesOrder.gpRestore(id);
  }
}

export default SalesOrderService;
