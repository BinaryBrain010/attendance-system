/**
 * Phase 2d — lead transfer (LOCAL ONLY, QA_ data, self-cleaning). Verifies crm.lead.transfer:
 *   - a team member transfers a lead to a teammate -> agent updated, timeline TRANSFER entry with the
 *     reason, and BOTH the previous and new agent's users notified (LEAD_TRANSFER);
 *   - transfer to an agent OUTSIDE the caller's team -> 403;
 *   - empty reason -> 400;
 *   - an ALL-scope manager may transfer to anyone.
 * Run: AUDIT_LOG=1 npm run qa:leadtransfer
 */
import bcrypt from "bcrypt";
import prisma from "../src/core/models/base.model";
import { runWithContext } from "../src/core/context/requestContext";
import LeadService from "../src/modules/CRM/Lead/services/lead.service";

const svc = new LeadService();
const S = Date.now();
const made: any = { emps: [], users: [], agents: [], leads: [] };
const one = (x: any) => (Array.isArray(x) ? x[0] : x);
let pass = true;
const ok = (c: boolean, m: string) => { if (!c) pass = false; console.log(`  ${c ? "OK  " : "FAIL"} ${m}`); };

async function agent(code: string, feats: string[] | null, scope: string, teamLeadId?: string) {
  const emp: any = await prisma.employee.create({ data: { name: "QA", surname: code, address: "QA", dob: new Date("1990-01-01"), joiningDate: new Date("2020-01-01"), bloodGroup: "O+", contactNo: "0", designation: "QA", department: "QA", martialStatus: "SINGLE", company: "OKASHASMART" as any, code: `QA_TR_${code}_${S}` } });
  made.emps.push(emp.id);
  let userId: string | null = null;
  if (feats) { const u: any = await prisma.user.create({ data: { username: `QA_tr_${code}_${S}@test.local`, password: await bcrypt.hash("x", 4), createdAt: new Date() } }); made.users.push(u.id); userId = u.id; await prisma.featurePermission.create({ data: { parentType: "User", parentId: u.id, permissions: { allowedFeatures: feats } as any, createdAt: new Date() } }); }
  const ag: any = await prisma.salesAgent.create({ data: { agentCode: `QA_TR_${code}_${S}`, employeeId: emp.id, userId: userId ?? undefined, scope: scope as any, teamLeadId: teamLeadId ?? undefined, company: "OKASHASMART" as any } });
  made.agents.push(ag.id);
  return { userId, agentId: ag.id };
}
async function mkLead(agentId: string) { const l: any = one(await prisma.lead.gpCreate({ customerName: `QA TR lead ${S}-${Math.random().toString(36).slice(2, 6)}`, company: "OKASHASMART", stage: "NEW", agentId })); made.leads.push(l.id); return l; }

async function main() {
  try {
    const L = await agent("L", null, "TEAM");
    const M1 = await agent("M1", ["login.admin.*", "crm.lead.read.team.*", "crm.lead.transfer.*"], "TEAM", L.agentId);
    const M2 = await agent("M2", ["login.admin.*", "crm.lead.read.team.*"], "TEAM", L.agentId);
    const X = await agent("X", ["login.admin.*", "crm.lead.read.own.*"], "OWN");
    const MGR = await agent("MGR", ["login.admin.*", "crm.lead.read.all.*", "crm.lead.transfer.*"], "ALL");

    const leadA = await mkLead(M1.agentId);
    await runWithContext({ userId: M1.userId!, platform: "Admin" }, async () => { await svc.transfer(M1.userId!, leadA.id, M2.agentId, "Client prefers M2"); });
    ok((await prisma.lead.findUnique({ where: { id: leadA.id } }))!.agentId === M2.agentId, "member transfers within team -> agent updated");
    const tlog = await prisma.activityLog.findFirst({ where: { entityType: "Lead", entityId: leadA.id, action: "TRANSFER" } });
    ok(!!tlog && /Client prefers M2/.test(tlog!.description || ""), "timeline TRANSFER entry carries the reason");
    const nM1 = await prisma.notification.findFirst({ where: { userId: M1.userId!, type: "LEAD_TRANSFER", entityId: leadA.id } });
    const nM2 = await prisma.notification.findFirst({ where: { userId: M2.userId!, type: "LEAD_TRANSFER", entityId: leadA.id } });
    ok(!!nM1 && !!nM2, "both previous and new agent notified");

    const leadB = await mkLead(M1.agentId);
    let e1: any = null;
    await runWithContext({ userId: M1.userId!, platform: "Admin" }, async () => { try { await svc.transfer(M1.userId!, leadB.id, X.agentId, "x"); } catch (e) { e1 = e; } });
    ok(e1 && e1.statusCode === 403, "transfer to out-of-team agent -> 403");

    let e2: any = null;
    await runWithContext({ userId: M1.userId!, platform: "Admin" }, async () => { try { await svc.transfer(M1.userId!, leadB.id, M2.agentId, "   "); } catch (e) { e2 = e; } });
    ok(e2 && e2.statusCode === 400, "empty reason -> 400");

    await runWithContext({ userId: MGR.userId!, platform: "Admin" }, async () => { await svc.transfer(MGR.userId!, leadB.id, X.agentId, "manager move"); });
    ok((await prisma.lead.findUnique({ where: { id: leadB.id } }))!.agentId === X.agentId, "ALL-scope manager transfers to anyone");
  } finally {
    for (const id of made.leads) { await prisma.notification.deleteMany({ where: { entityId: id } }).catch(() => {}); await prisma.activityLog.deleteMany({ where: { entityId: id } }).catch(() => {}); await prisma.auditLog.deleteMany({ where: { entityId: id } }).catch(() => {}); await prisma.lead.delete({ where: { id } }).catch(() => {}); }
    for (const id of made.agents) await prisma.salesAgent.updateMany({ where: { teamLeadId: id }, data: { teamLeadId: null } }).catch(() => {});
    for (const id of made.agents) await prisma.salesAgent.delete({ where: { id } }).catch(() => {});
    for (const id of made.users) { await prisma.featurePermission.deleteMany({ where: { parentId: id } }).catch(() => {}); await prisma.notification.deleteMany({ where: { userId: id } }).catch(() => {}); await prisma.loggedInUsers.deleteMany({ where: { userId: id } }).catch(() => {}); await prisma.user.delete({ where: { id } }).catch(() => {}); }
    for (const id of made.emps) await prisma.employee.delete({ where: { id } }).catch(() => {});
    console.log("  cleaned up");
  }
  console.log(pass ? "\nRESULT: PASS" : "\nRESULT: FAIL");
  process.exit(pass ? 0 : 1);
}
main().catch((e) => { console.error("[qa:leadtransfer] error", e?.message || e); process.exit(1); });
