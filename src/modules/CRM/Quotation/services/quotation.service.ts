import prisma from "../../../../core/models/base.model";
import { resolveScope, assertRowInScope, resolveAssignment } from "../../shared/scope";
import { priceLines } from "../../shared/pricing";
import { normalizePhone, searchPhoneDigits } from "../../shared/phone";
import { assertTransition } from "../../shared/stateMachine";
import { syncLeadStage } from "../../shared/leadSync";
import { NotFoundError, AppError } from "../../../../core/errors/app.error";

function filterWhere(f: any = {}): Record<string, any> {
  const w: Record<string, any> = {};
  if (f.company) w.company = f.company;
  if (f.outlet) w.outlet = f.outlet;
  if (f.status) w.status = f.status;
  if (f.tier) w.tier = f.tier;
  if (f.agentId) w.agentId = f.agentId;
  if (f.activeOnly) w.isActive = true;
  if (f.phone) { const n = normalizePhone(f.phone); if (n) w.phoneNormalized = n; } // exact national-number match
  if (f.search) {
    const s = String(f.search).trim();
    const sd = searchPhoneDigits(s);
    w.OR = [
      { customerName: { contains: s, mode: "insensitive" } },
      { quotationNo: { contains: s, mode: "insensitive" } },
      ...(sd ? [{ phoneNormalized: { contains: sd } }] : []),
    ];
  }
  if (f.from || f.to) { w.createdAt = {}; if (f.from) w.createdAt.gte = new Date(f.from); if (f.to) w.createdAt.lte = new Date(f.to); }
  return w;
}

/** quantity*unitPrice - lineDiscount per line; subtotal = sum(lineTotal); total = subtotal - header discount. */
function computeTotals(items: any[], headerDiscount = 0) {
  let subtotal = 0;
  const lines = items.map((it) => {
    const lineTotal = (it.quantity || 1) * (it.unitPrice || 0) - (it.lineDiscount || 0);
    subtotal += lineTotal;
    return { ...it, lineTotal };
  });
  return { lines, subtotal, total: subtotal - (headerDiscount || 0) };
}

async function nextQuotationNo(): Promise<string> {
  const rows = await prisma.quotation.findMany({ where: { quotationNo: { startsWith: "Q-" } }, select: { quotationNo: true } });
  let max = 0;
  for (const r of rows) { const m = r.quotationNo.match(/(\d+)/); if (m) max = Math.max(max, parseInt(m[1], 10)); }
  return `Q-${String(max + 1).padStart(4, "0")}`;
}

const HEADER_FIELDS = ["customerName", "phone", "tier", "validUntil", "discount", "agentId", "outlet", "leadId"];
function pickHeader(h: any): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of HEADER_FIELDS) if (k in h) out[k] = k === "validUntil" ? (h[k] ? new Date(h[k]) : null) : h[k];
  return out;
}

const lineData = (quotationId: string, l: any) => ({
  quotationId, productId: l.productId ?? null, variantId: l.variantId ?? null, description: l.description ?? null,
  quantity: l.quantity ?? 1, unitPrice: l.unitPrice, unitCost: l.unitCost ?? null, lineDiscount: l.lineDiscount || 0, lineTotal: l.lineTotal,
});

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
    const versions = await prisma.quotation.findMany({ where: { quotationNo: row.quotationNo, isDeleted: null }, select: { id: true, version: true, status: true, isActive: true }, orderBy: { version: "asc" } });
    return { ...row, versions };
  }

  async create(userId: string, data: any) {
    const scope = await resolveScope(userId, "quotation");
    const { items = [], ...h } = data;
    h.agentId = resolveAssignment(scope, h.agentId);
    const priced = await priceLines(items);
    const { lines, subtotal, total } = computeTotals(priced, h.discount || 0);
    const quotationNo = h.quotationNo || (await nextQuotationNo());
    return prisma.$transaction(async (tx) => {
      const q = await tx.quotation.create({
        data: {
          quotationNo, version: 1, isActive: true, leadId: h.leadId ?? null, customerName: h.customerName, phone: h.phone ?? null, phoneNormalized: normalizePhone(h.phone),
          tier: h.tier ?? "RETAIL", status: "DRAFT", subtotal, discount: h.discount || 0, total,
          validUntil: h.validUntil ? new Date(h.validUntil) : null, agentId: h.agentId ?? null, outlet: h.outlet ?? null,
          company: h.company ?? "OKASHASMART", createdBy: userId,
        },
      });
      for (const l of lines) await tx.quotationItem.create({ data: lineData(q.id, l) });
      return q;
    });
  }

  async update(userId: string, id: string, data: any) {
    const scope = await resolveScope(userId, "quotation");
    const existing = await prisma.quotation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Quotation");
    assertRowInScope(scope, existing.agentId, "Quotation");
    const { items, ...h } = data;
    if ("agentId" in h) h.agentId = resolveAssignment(scope, h.agentId);
    return prisma.$transaction(async (tx) => {
      let subtotal = existing.subtotal, total = existing.total;
      if (items) {
        const priced = await priceLines(items);
        const c = computeTotals(priced, h.discount ?? existing.discount);
        subtotal = c.subtotal; total = c.total;
        await tx.quotationItem.deleteMany({ where: { quotationId: id } });
        for (const l of c.lines) await tx.quotationItem.create({ data: lineData(id, l) });
      } else if (h.discount != null) {
        total = existing.subtotal - h.discount;
      }
      return tx.quotation.update({ where: { id }, data: { ...pickHeader(h), subtotal, total, updatedBy: userId, updatedAt: new Date() } });
    });
  }

  /** Lead -> Quotation. Lead must be quote-ready (Qualified/Quotation/Negotiation/Won). */
  async fromLead(userId: string, leadId: string) {
    const scope = await resolveScope(userId, "quotation");
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.isDeleted) throw new NotFoundError("Lead");
    if (!["QUALIFIED", "QUOTATION", "NEGOTIATION", "WON"].includes(lead.stage)) {
      throw new AppError(409, `Lead must be Qualified/Quotation/Negotiation/Won to quote (it is ${lead.stage})`);
    }
    const agentId = resolveAssignment(scope, lead.agentId ?? null);
    const items: any[] = [];
    if (lead.productId) items.push({ productId: lead.productId, quantity: 1 });
    const priced = await priceLines(items);
    const { lines, subtotal, total } = computeTotals(priced, 0);
    const quotationNo = await nextQuotationNo();
    return prisma.$transaction(async (tx) => {
      const q = await tx.quotation.create({
        data: { quotationNo, version: 1, isActive: true, leadId: lead.id, customerName: lead.customerName, phone: lead.phone, phoneNormalized: normalizePhone(lead.phone),
          tier: "RETAIL", status: "DRAFT", subtotal, discount: 0, total, agentId, outlet: lead.outlet, company: "OKASHASMART", createdBy: userId },
      });
      for (const l of lines) await tx.quotationItem.create({ data: lineData(q.id, l) });
      return q;
    });
  }

  /** New version of a quotation (same quotationNo, version+1); only the new one stays active. */
  async newVersion(userId: string, id: string) {
    const scope = await resolveScope(userId, "quotation");
    const cur = await prisma.quotation.findUnique({ where: { id }, include: { items: { where: { isDeleted: null } } } });
    if (!cur) throw new NotFoundError("Quotation");
    assertRowInScope(scope, cur.agentId, "Quotation");
    const agg = await prisma.quotation.aggregate({ where: { quotationNo: cur.quotationNo }, _max: { version: true } });
    const newV = (agg._max.version || cur.version) + 1;
    return prisma.$transaction(async (tx) => {
      await tx.quotation.updateMany({ where: { quotationNo: cur.quotationNo }, data: { isActive: false } });
      const q = await tx.quotation.create({
        data: {
          quotationNo: cur.quotationNo, version: newV, isActive: true, parentId: cur.id, leadId: cur.leadId, customerName: cur.customerName,
          phone: cur.phone, tier: cur.tier, status: "DRAFT", subtotal: cur.subtotal, discount: cur.discount, total: cur.total,
          validUntil: cur.validUntil, agentId: cur.agentId, outlet: cur.outlet, company: cur.company, createdBy: userId,
        },
      });
      for (const it of cur.items) await tx.quotationItem.create({ data: lineData(q.id, it) });
      return q;
    });
  }

  /** Status transition. Only ONE version per quotationNo may be SENT/ACCEPTED at a time. */
  async transition(userId: string, id: string, to: string, reason: string | null) {
    const scope = await resolveScope(userId, "quotation");
    const q = await prisma.quotation.findUnique({ where: { id } });
    if (!q || q.isDeleted) throw new NotFoundError("Quotation");
    assertRowInScope(scope, q.agentId, "Quotation");
    assertTransition("quotation", q.status, to, reason);
    if (to === "SENT" || to === "ACCEPTED") {
      const other = await prisma.quotation.findFirst({ where: { quotationNo: q.quotationNo, id: { not: id }, status: { in: ["SENT", "ACCEPTED"] }, isDeleted: null } });
      if (other) throw new AppError(409, `Version v${other.version} of ${q.quotationNo} is already ${other.status} — only one version can be SENT/ACCEPTED at a time`);
    }
    const data: any = { status: to, isActive: true, updatedBy: userId, updatedAt: new Date() };
    if (to === "REJECTED") data.statusReason = reason;
    const upd = await prisma.quotation.update({ where: { id }, data });
    if (to === "SENT") await syncLeadStage(userId, q.leadId, "QUOTATION", "quotation sent");
    return { ...upd, from: q.status, to };
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

  /** Scoped fetch for the PDF (throws if out of scope). */
  async forPdf(userId: string, id: string) {
    const scope = await resolveScope(userId, "quotation");
    const q = await prisma.quotation.findUnique({ where: { id }, include: { items: { where: { isDeleted: null } } } });
    if (!q || q.isDeleted) throw new NotFoundError("Quotation");
    assertRowInScope(scope, q.agentId, "Quotation");
    return q;
  }
}

export default QuotationService;
