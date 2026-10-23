import prisma from "../../../core/models/base.model";
import accessModel from "../../rbac/Access/models/access.model";
import { Prisma } from "@prisma/client";

const TAKE = 5;
const ci = (q: string) => ({ contains: q, mode: Prisma.QueryMode.insensitive });

/**
 * A10: global top-bar search. Queries employees, leads, customers, gate passes and visitors — max 5
 * per type — but ONLY the types the caller has read permission for (permission-aware). Returns a flat
 * grouped shape the command palette renders.
 */
class SearchService {
  async global(userId: string, qRaw: string) {
    const q = String(qRaw || "").trim();
    const out: Record<string, any[]> = { employees: [], leads: [], customers: [], gatePasses: [], visitors: [] };
    if (q.length < 2) return out;

    const can = async (feat: string) => {
      try { return await accessModel.user.checkUserPermission(userId, feat); } catch { return false; }
    };
    const [cEmp, cLead, cCust, cGp, cVis] = await Promise.all([
      can("employee.read.*"), can("crm.lead.read.own.*"), can("customer.read.*"), can("voucher.read.*"), can("visitor.read.*"),
    ]);

    await Promise.all([
      cEmp && prisma.employee.findMany({
        where: { isDeleted: null, OR: [{ name: ci(q) }, { surname: ci(q) }, { code: ci(q) }] },
        select: { id: true, name: true, surname: true, code: true }, take: TAKE,
      }).then((r) => { out.employees = r.map((e) => ({ id: e.id, label: `${e.name} ${e.surname || ""}`.trim(), sub: e.code, href: `/admin/ams/employee/${e.id}` })); }).catch(() => {}),

      cLead && prisma.lead.findMany({
        where: { isDeleted: null, OR: [{ customerName: ci(q) }, { leadNo: ci(q) }] },
        select: { id: true, customerName: true, leadNo: true, stage: true }, take: TAKE, orderBy: { dateReceived: "desc" },
      }).then((r) => { out.leads = r.map((l) => ({ id: l.id, label: l.customerName, sub: `${l.leadNo || ""} · ${l.stage}`, href: `/crm/leads/${l.id}` })); }).catch(() => {}),

      cCust && prisma.customer.findMany({
        where: { isDeleted: null, OR: [{ name: ci(q) }, { phone: ci(q) }] },
        select: { id: true, name: true, phone: true }, take: TAKE,
      }).then((r) => { out.customers = r.map((c) => ({ id: c.id, label: c.name, sub: c.phone || "", href: `/quickpass/recipients/${c.id}` })); }).catch(() => {}),

      cGp && prisma.gatePass.findMany({
        where: { isDeleted: null, OR: [{ vehicleNo: ci(q) }, { customer: { name: ci(q) } }] },
        select: { id: true, vehicleNo: true, status: true, customer: { select: { name: true } } }, take: TAKE, orderBy: { createdAt: "desc" },
      }).then((r) => { out.gatePasses = r.map((g: any) => ({ id: g.id, label: g.customer?.name || "Gate pass", sub: `${g.vehicleNo || ""} · ${g.status}`, href: `/quickpass/gate-passes/${g.id}` })); }).catch(() => {}),

      cVis && prisma.visitor.findMany({
        where: { isDeleted: null, OR: [{ name: ci(q) }, { phone: ci(q) }, { company: ci(q) }] },
        select: { id: true, name: true, phone: true, company: true }, take: TAKE, orderBy: [{ visitDate: "desc" }],
      }).then((r) => { out.visitors = r.map((v) => ({ id: v.id, label: v.name, sub: [v.phone, v.company].filter(Boolean).join(" · "), href: `/admin/frontdesk/visitor` })); }).catch(() => {}),
    ]);

    return out;
  }
}

export default SearchService;
