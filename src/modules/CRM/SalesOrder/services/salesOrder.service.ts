import prisma from "../../../../core/models/base.model";
import { resolveScope, assertRowInScope, resolveAssignment } from "../../shared/scope";
import { normalizePhone, searchPhoneDigits } from "../../shared/phone";
import { priceLines } from "../../shared/pricing";
import { assertTransition, allowedNext } from "../../shared/stateMachine";
import { syncLeadStage } from "../../shared/leadSync";
import { NotFoundError, AppError } from "../../../../core/errors/app.error";

function filterWhere(f: any = {}): Record<string, any> {
  const w: Record<string, any> = {};
  if (f.company) w.company = f.company;
  if (f.outlet) w.outlet = f.outlet;
  if (f.city) w.city = { contains: f.city, mode: "insensitive" };
  if (f.status) w.status = f.status;
  if (f.channel) w.channel = f.channel;
  if (f.agentId) w.agentId = f.agentId;
  if (f.phone) { const n = normalizePhone(f.phone); if (n) w.phoneNormalized = n; } // exact national-number match
  if (f.reattemptMin != null) w.reattemptCount = { gte: Number(f.reattemptMin) || 1 };
  if (f.search) {
    const s = String(f.search).trim();
    const sd = searchPhoneDigits(s);
    w.OR = [
      { customerName: { contains: s, mode: "insensitive" } },
      { orderNo: { contains: s, mode: "insensitive" } }, { externalOrderNo: { contains: s, mode: "insensitive" } },
      { trackingNo: { contains: s, mode: "insensitive" } },
      ...(sd ? [{ phoneNormalized: { contains: sd } }] : []),
    ];
  }
  if (f.from || f.to) { w.createdAt = {}; if (f.from) w.createdAt.gte = new Date(f.from); if (f.to) w.createdAt.lte = new Date(f.to); }
  return w;
}

function computeTotals(items: any[], headerDiscount = 0) {
  let subtotal = 0;
  const lines = items.map((it) => { const lineTotal = (it.quantity || 1) * (it.unitPrice || 0) - (it.lineDiscount || 0); subtotal += lineTotal; return { ...it, lineTotal }; });
  return { lines, subtotal, total: subtotal - (headerDiscount || 0) };
}
async function nextOrderNo(): Promise<string> {
  const rows = await prisma.salesOrder.findMany({ where: { orderNo: { startsWith: "SO-" } }, select: { orderNo: true } });
  let max = 0;
  for (const r of rows) { const m = r.orderNo.match(/(\d+)/); if (m) max = Math.max(max, parseInt(m[1], 10)); }
  return `SO-${String(max + 1).padStart(4, "0")}`;
}
const lineData = (orderId: string, l: any) => ({
  orderId, productId: l.productId ?? null, variantId: l.variantId ?? null, description: l.description ?? null,
  quantity: l.quantity ?? 1, unitPrice: l.unitPrice, unitCost: l.unitCost ?? null, lineDiscount: l.lineDiscount || 0, lineTotal: l.lineTotal,
});
const HEADER = ["customerName", "phone", "city", "area", "outlet", "address", "channel", "externalOrderNo", "courier", "trackingNo", "paymentType", "amountReceived", "discount", "agentId", "leadId", "quotationId"];
function pickHeader(h: any): Record<string, any> { const o: Record<string, any> = {}; for (const k of HEADER) if (k in h) o[k] = h[k]; return o; }

class SalesOrderService {
  async get(userId: string, page = 1, pageSize = 10, filters: any = {}) {
    const scope = await resolveScope(userId, "order");
    const where = { AND: [{ isDeleted: null }, filterWhere(filters), scope.where] };
    const skip = (page - 1) * pageSize;
    const [data, totalSize] = await Promise.all([
      prisma.salesOrder.findMany({ where, skip, take: pageSize, orderBy: { createdAt: "desc" } }),
      prisma.salesOrder.count({ where }),
    ]);
    // Decorate with allowed next states so the kanban board's "Move to..." select mirrors Leads.
    const decorated = data.map((r: any) => ({ ...r, allowedNextStages: allowedNext("order", r.status) }));
    return { data: decorated, totalSize, scope: scope.mode };
  }
  async total(userId: string, filters: any = {}) {
    const scope = await resolveScope(userId, "order");
    return prisma.salesOrder.count({ where: { AND: [{ isDeleted: null }, filterWhere(filters), scope.where] } });
  }
  async getById(userId: string, id: string) {
    const scope = await resolveScope(userId, "order");
    const row = await prisma.salesOrder.findUnique({ where: { id }, include: { items: { where: { isDeleted: null } } } });
    if (!row || row.isDeleted) return null;
    assertRowInScope(scope, row, "Order");
    return row;
  }

  private async persist(userId: string, h: any, items: any[], extra: any = {}) {
    // `tier` is transient: an order has no tier column, but product-linked lines with no explicit
    // unitPrice are priced at it (default RETAIL). It is never stored on the order.
    const priced = await priceLines(items, h.tier ?? "RETAIL");
    const { lines, subtotal, total } = computeTotals(priced, h.discount || 0);
    const orderNo = h.orderNo || (await nextOrderNo());
    return prisma.$transaction(async (tx: any) => {
      const o = await tx.salesOrder.create({
        data: {
          orderNo, leadId: h.leadId ?? null, quotationId: h.quotationId ?? null, customerName: h.customerName, phone: h.phone ?? null, phoneNormalized: normalizePhone(h.phone),
          city: h.city ?? null, area: h.area ?? null, outlet: h.outlet ?? null, address: h.address ?? null, status: "DRAFT", subtotal, discount: h.discount || 0,
          total, channel: h.channel ?? null, externalOrderNo: h.externalOrderNo ?? null, courier: h.courier ?? null, trackingNo: h.trackingNo ?? null,
          paymentType: h.paymentType ?? null, amountReceived: h.amountReceived ?? null, agentId: h.agentId ?? null,
          company: h.company ?? "OKASHASMART", createdBy: userId, ...extra,
        },
      });
      for (const l of lines) await tx.salesOrderItem.create({ data: lineData(o.id, l) });
      return o;
    });
  }

  async create(userId: string, data: any) {
    const scope = await resolveScope(userId, "order");
    const { items = [], ...h } = data;
    h.agentId = resolveAssignment(scope, h.agentId);
    return this.persist(userId, h, items); // h.tier (if any) is used for pricing only, not stored
  }

  /** Lead -> SalesOrder (carries customer + the lead's product as a line if it has a current price). */
  async fromLead(userId: string, leadId: string) {
    const scope = await resolveScope(userId, "order");
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.isDeleted) throw new NotFoundError("Lead");
    const agentId = resolveAssignment(scope, lead.agentId ?? null);
    const items: any[] = [];
    if (lead.productId) items.push({ productId: lead.productId, quantity: 1 }); // priceLines resolves/validates
    return this.persist(userId, { customerName: lead.customerName, phone: lead.phone, city: lead.city, outlet: lead.outlet, agentId, leadId, discount: 0 }, items);
  }

  /** Accepted Quotation -> SalesOrder (carries its line items + customer). */
  async fromQuotation(userId: string, quotationId: string) {
    const scope = await resolveScope(userId, "order");
    const q = await prisma.quotation.findUnique({ where: { id: quotationId }, include: { items: { where: { isDeleted: null } } } });
    if (!q || q.isDeleted) throw new NotFoundError("Quotation");
    if (q.status !== "ACCEPTED") throw new AppError(409, `Quotation must be ACCEPTED to convert to an order (it is ${q.status})`);
    const agentId = resolveAssignment(scope, q.agentId ?? null);
    const items = q.items.map((it) => ({ productId: it.productId, variantId: it.variantId, description: it.description, quantity: it.quantity, unitPrice: it.unitPrice, unitCost: it.unitCost, lineDiscount: it.lineDiscount }));
    return this.persist(userId, { customerName: q.customerName, phone: q.phone, outlet: q.outlet, agentId, leadId: q.leadId, quotationId: q.id, discount: q.discount }, items);
  }

  async update(userId: string, id: string, data: any) {
    const scope = await resolveScope(userId, "order");
    const existing = await prisma.salesOrder.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Order");
    assertRowInScope(scope, existing, "Order");
    const { items, ...h } = data;
    if ("agentId" in h) h.agentId = resolveAssignment(scope, h.agentId);
    return prisma.$transaction(async (tx: any) => {
      let subtotal = existing.subtotal, total = existing.total;
      if (items) {
        const priced = await priceLines(items, h.tier ?? "RETAIL");
        const c = computeTotals(priced, h.discount ?? existing.discount);
        subtotal = c.subtotal; total = c.total;
        await tx.salesOrderItem.deleteMany({ where: { orderId: id } });
        for (const l of c.lines) await tx.salesOrderItem.create({ data: lineData(id, l) });
      } else if (h.discount != null) total = existing.subtotal - h.discount;
      return tx.salesOrder.update({ where: { id }, data: { ...pickHeader(h), subtotal, total, updatedBy: userId, updatedAt: new Date() } });
    });
  }

  /** Status transition. Reason required for CANCELLED/RETURNED; sets dispatched/delivered timestamps. */
  async transition(userId: string, id: string, to: string, reason: string | null) {
    const scope = await resolveScope(userId, "order");
    const o = await prisma.salesOrder.findUnique({ where: { id } });
    if (!o || o.isDeleted) throw new NotFoundError("Order");
    assertRowInScope(scope, o, "Order");
    assertTransition("order", o.status, to, reason);
    const data: any = { status: to, updatedBy: userId, updatedAt: new Date() };
    if (to === "CANCELLED" || to === "RETURNED") data.statusReason = reason;
    if (to === "DISPATCHED") data.dispatchedAt = new Date();
    if (to === "DELIVERED") data.deliveredAt = new Date();
    const upd = await prisma.salesOrder.update({ where: { id }, data });
    if (["CONFIRMED", "PACKED", "DISPATCHED", "DELIVERED"].includes(to)) await syncLeadStage(userId, o.leadId, "WON", `order ${to.toLowerCase()}`);
    return { ...upd, from: o.status, to };
  }

  /** Re-attempt a delivery: order stays DISPATCHED, reattemptCount++. */
  async reattempt(userId: string, id: string) {
    const scope = await resolveScope(userId, "order");
    const o = await prisma.salesOrder.findUnique({ where: { id } });
    if (!o || o.isDeleted) throw new NotFoundError("Order");
    assertRowInScope(scope, o, "Order");
    if (o.status !== "DISPATCHED") throw new AppError(409, `Only a DISPATCHED order can be re-attempted (it is ${o.status})`);
    return prisma.salesOrder.update({ where: { id }, data: { reattemptCount: (o.reattemptCount || 0) + 1, updatedBy: userId, updatedAt: new Date() } });
  }

  async remove(userId: string, id: string) {
    const scope = await resolveScope(userId, "order");
    const existing = await prisma.salesOrder.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Order");
    assertRowInScope(scope, existing, "Order");
    return prisma.salesOrder.gpSoftDelete(id);
  }
  async restore(userId: string, id: string) {
    const scope = await resolveScope(userId, "order");
    const existing = await prisma.salesOrder.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Order");
    assertRowInScope(scope, existing, "Order");
    return prisma.salesOrder.gpRestore(id);
  }
}

export default SalesOrderService;
