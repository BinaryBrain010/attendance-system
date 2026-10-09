import prisma from "../../../../core/models/base.model";
import { resolveScope, assertRowInScope, resolveAssignment } from "../../shared/scope";
import { assertTransition } from "../../shared/stateMachine";
import { NotFoundError, AppError } from "../../../../core/errors/app.error";

function filterWhere(f: any = {}): Record<string, any> {
  const w: Record<string, any> = {};
  if (f.company) w.company = f.company;
  if (f.city) w.city = { contains: f.city, mode: "insensitive" };
  if (f.status) w.status = f.status;
  if (f.agentId) w.agentId = f.agentId;
  if (f.courier) w.courier = f.courier;
  if (f.from || f.to) { w.reportedAt = {}; if (f.from) w.reportedAt.gte = new Date(f.from); if (f.to) w.reportedAt.lte = new Date(f.to); }
  return w;
}
async function nextReturnNo(): Promise<string> {
  const rows = await prisma.salesReturn.findMany({ where: { returnNo: { startsWith: "RET-" } }, select: { returnNo: true } });
  let max = 0; for (const r of rows) { const m = r.returnNo.match(/(\d+)/); if (m) max = Math.max(max, parseInt(m[1], 10)); }
  return `RET-${String(max + 1).padStart(4, "0")}`;
}
const itemData = (returnId: string, it: any) => ({ returnId, productId: it.productId ?? null, description: it.description ?? null, quantity: it.quantity ?? 1 });

class SalesReturnService {
  async get(userId: string, page = 1, pageSize = 10, filters: any = {}) {
    const scope = await resolveScope(userId, "return");
    const where = { AND: [{ isDeleted: null }, filterWhere(filters), scope.where] };
    const skip = (page - 1) * pageSize;
    const [data, totalSize] = await Promise.all([
      prisma.salesReturn.findMany({ where, skip, take: pageSize, orderBy: { reportedAt: "desc" } }),
      prisma.salesReturn.count({ where }),
    ]);
    return { data, totalSize, scope: scope.mode };
  }
  async total(userId: string, filters: any = {}) {
    const scope = await resolveScope(userId, "return");
    return prisma.salesReturn.count({ where: { AND: [{ isDeleted: null }, filterWhere(filters), scope.where] } });
  }
  async getById(userId: string, id: string) {
    const scope = await resolveScope(userId, "return");
    const row = await prisma.salesReturn.findUnique({ where: { id }, include: { items: { where: { isDeleted: null } } } });
    if (!row || row.isDeleted) return null;
    assertRowInScope(scope, row.agentId, "Return");
    return row;
  }

  async create(userId: string, data: any) {
    const scope = await resolveScope(userId, "return");
    const { items = [], ...h } = data;
    if (!h.reason || !String(h.reason).trim()) throw new AppError(400, "A reason is required to report a return");
    h.agentId = resolveAssignment(scope, h.agentId);
    const returnNo = h.returnNo || (await nextReturnNo());
    return prisma.$transaction(async (tx) => {
      const r = await tx.salesReturn.create({
        data: { returnNo, orderId: h.orderId ?? null, customerName: h.customerName, phone: h.phone ?? null, city: h.city ?? null,
          status: "REPORTED", reason: h.reason, courier: h.courier ?? null, trackingNo: h.trackingNo ?? null, agentId: h.agentId ?? null,
          company: h.company ?? "OKASHASMART", createdBy: userId },
      });
      for (const it of items) await tx.returnItem.create({ data: itemData(r.id, it) });
      return r;
    });
  }

  /** Order -> Return (reason required). Carries items + customer; marks the order RETURNED. */
  async fromOrder(userId: string, orderId: string, reason: string) {
    const scope = await resolveScope(userId, "return");
    if (!reason || !String(reason).trim()) throw new AppError(400, "A reason is required to report a return");
    const order = await prisma.salesOrder.findUnique({ where: { id: orderId }, include: { items: { where: { isDeleted: null } } } });
    if (!order || order.isDeleted) throw new NotFoundError("Order");
    if (!["DISPATCHED", "DELIVERED"].includes(order.status)) throw new AppError(409, `Only a DISPATCHED/DELIVERED order can be returned (it is ${order.status})`);
    const agentId = resolveAssignment(scope, order.agentId ?? null);
    const returnNo = await nextReturnNo();
    return prisma.$transaction(async (tx) => {
      const r = await tx.salesReturn.create({
        data: { returnNo, orderId: order.id, customerName: order.customerName, phone: order.phone, city: order.city, status: "REPORTED",
          reason, courier: order.courier, trackingNo: order.trackingNo, agentId, company: order.company, createdBy: userId },
      });
      for (const it of order.items) await tx.returnItem.create({ data: itemData(r.id, { productId: it.productId, description: it.description, quantity: it.quantity }) });
      await tx.salesOrder.update({ where: { id: order.id }, data: { status: "RETURNED", statusReason: reason, updatedBy: userId } });
      return r;
    });
  }

  async update(userId: string, id: string, data: any) {
    const scope = await resolveScope(userId, "return");
    const existing = await prisma.salesReturn.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Return");
    assertRowInScope(scope, existing.agentId, "Return");
    const d: any = {};
    for (const k of ["customerName", "phone", "city", "courier", "trackingNo", "reason"]) if (k in data) d[k] = data[k];
    return prisma.salesReturn.gpUpdate(id, { ...d, updatedBy: userId });
  }

  /** Status transition. REPORTED->RECEIVED_BACK->RESTOCKED|DAMAGED; reason required for DAMAGED. */
  async transition(userId: string, id: string, to: string, reason: string | null) {
    const scope = await resolveScope(userId, "return");
    const r = await prisma.salesReturn.findUnique({ where: { id } });
    if (!r || r.isDeleted) throw new NotFoundError("Return");
    assertRowInScope(scope, r.agentId, "Return");
    assertTransition("return", r.status, to, reason);
    const data: any = { status: to, updatedBy: userId, updatedAt: new Date() };
    if (to === "DAMAGED" && reason) data.reason = `${r.reason} | damaged: ${reason}`;
    const upd = await prisma.salesReturn.update({ where: { id }, data });
    return { ...upd, from: r.status, to };
  }

  async remove(userId: string, id: string) {
    const scope = await resolveScope(userId, "return");
    const existing = await prisma.salesReturn.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Return");
    assertRowInScope(scope, existing.agentId, "Return");
    return prisma.salesReturn.gpSoftDelete(id);
  }
}

export default SalesReturnService;
