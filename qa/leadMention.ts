/**
 * Phase 2e — @mentions (LOCAL ONLY, QA_ data, self-cleaning). Verifies that mentioning a user in a
 * lead activity note notifies the AUTHORIZED targets only (team members; everyone for a manager),
 * drops out-of-team mentions for non-managers, and that /mentionables lists the right people.
 * Run: AUDIT_LOG=0 npm run qa:leadmention
 */
import bcrypt from "bcrypt";
import prisma from "../src/core/models/base.model";
import { runWithContext } from "../src/core/context/requestContext";
import LeadService from "../src/modules/CRM/Lead/services/lead.service";
import LeadActivityService from "../src/modules/CRM/LeadActivity/services/leadActivity.service";
const leadSvc = new LeadService(); const actSvc = new LeadActivityService();
const S = Date.now();
const made: any = { emps: [], users: [], agents: [], leads: [] };
const one = (x: any) => (Array.isArray(x) ? x[0] : x);
let pass = true; const ok = (c: boolean, m: string) => { if (!c) pass = false; console.log(`  ${c ? "OK  " : "FAIL"} ${m}`); };

async function agent(code: string, feats: string[], scope: string, teamLeadId?: string) {
  const emp: any = await prisma.employee.create({ data: { name: "QA", surname: code, address: "QA", dob: new Date("1990-01-01"), joiningDate: new Date("2020-01-01"), bloodGroup: "O+", contactNo: "0", designation: "QA", department: "QA", martialStatus: "SINGLE", company: "OKASHASMART" as any, code: `QA_MN_${code}_${S}` } });
  made.emps.push(emp.id);
  const u: any = await prisma.user.create({ data: { username: `QA_mn_${code}_${S}@test.local`, password: await bcrypt.hash("x", 4), createdAt: new Date() } });
  made.users.push(u.id);
  await prisma.featurePermission.create({ data: { parentType: "User", parentId: u.id, permissions: { allowedFeatures: feats } as any, createdAt: new Date() } });
  const ag: any = await prisma.salesAgent.create({ data: { agentCode: `QA_MN_${code}_${S}`, employeeId: emp.id, userId: u.id, scope: scope as any, teamLeadId: teamLeadId ?? undefined, company: "OKASHASMART" as any } });
  made.agents.push(ag.id);
  return { userId: u.id as string, agentId: ag.id as string };
}
async function mkLead(agentId: string) { const l: any = one(await prisma.lead.gpCreate({ customerName: `QA MN lead ${S}-${Math.random().toString(36).slice(2, 6)}`, company: "OKASHASMART", stage: "NEW", agentId })); made.leads.push(l.id); return l; }

async function main() {
  try {
    const L = await agent("L", ["login.admin.*", "crm.lead.read.team.*", "crm.lead.create.*"], "TEAM");
    const M1 = await agent("M1", ["login.admin.*", "crm.lead.read.team.*", "crm.lead.create.*"], "TEAM", L.agentId);
    const M2 = await agent("M2", ["login.admin.*", "crm.lead.read.team.*"], "TEAM", L.agentId);
    const X = await agent("X", ["login.admin.*", "crm.lead.read.own.*"], "OWN");
    const MGR = await agent("MGR", ["login.admin.*", "crm.lead.read.all.*", "crm.lead.create.*"], "ALL");

    const lead = await mkLead(M1.agentId);
    // M1 (team scope) mentions M2 (teammate) + X (other team) in an activity note.
    await runWithContext({ userId: M1.userId, platform: "Admin" }, async () => {
      await actSvc.create(M1.userId, { leadId: lead.id, type: "NOTE", notes: "ping team", mentions: [M2.userId, X.userId] });
    });
    const mn2 = await prisma.notification.findFirst({ where: { userId: M2.userId, type: "MENTION", entityId: lead.id } });
    const mnX = await prisma.notification.findFirst({ where: { userId: X.userId, type: "MENTION", entityId: lead.id } });
    ok(!!mn2, "teammate (M2) is notified of the mention");
    ok(!mnX, "out-of-team (X) mention is DROPPED for a non-manager");

    // Manager mentions X on a lead the manager can see -> X notified.
    const lead2 = await mkLead(MGR.agentId);
    await runWithContext({ userId: MGR.userId, platform: "Admin" }, async () => {
      await actSvc.create(MGR.userId, { leadId: lead2.id, type: "NOTE", notes: "manager ping", mentions: [X.userId] });
    });
    ok(!!(await prisma.notification.findFirst({ where: { userId: X.userId, type: "MENTION", entityId: lead2.id } })), "manager may mention anyone (X notified)");

    // mentionables
    const m1List = await leadSvc.mentionables(M1.userId);
    ok(m1List.some((u: any) => u.userId === M2.userId) && !m1List.some((u: any) => u.userId === X.userId) && !m1List.some((u: any) => u.userId === M1.userId), "mentionables(M1) = team only, excludes self + other team");
    const mgrList = await leadSvc.mentionables(MGR.userId);
    ok(mgrList.some((u: any) => u.userId === X.userId), "mentionables(manager) includes everyone");
  } finally {
    for (const id of made.leads) { await prisma.notification.deleteMany({ where: { entityId: id } }).catch(() => {}); await prisma.leadActivity.deleteMany({ where: { leadId: id } }).catch(() => {}); await prisma.activityLog.deleteMany({ where: { entityId: id } }).catch(() => {}); await prisma.auditLog.deleteMany({ where: { entityId: id } }).catch(() => {}); await prisma.lead.delete({ where: { id } }).catch(() => {}); }
    for (const id of made.agents) await prisma.salesAgent.updateMany({ where: { teamLeadId: id }, data: { teamLeadId: null } }).catch(() => {});
    for (const id of made.agents) await prisma.salesAgent.delete({ where: { id } }).catch(() => {});
    for (const id of made.users) { await prisma.featurePermission.deleteMany({ where: { parentId: id } }).catch(() => {}); await prisma.notification.deleteMany({ where: { userId: id } }).catch(() => {}); await prisma.loggedInUsers.deleteMany({ where: { userId: id } }).catch(() => {}); await prisma.user.delete({ where: { id } }).catch(() => {}); }
    for (const id of made.emps) await prisma.employee.delete({ where: { id } }).catch(() => {});
    console.log("  cleaned up");
  }
  console.log(pass ? "\nRESULT: PASS" : "\nRESULT: FAIL");
  process.exit(pass ? 0 : 1);
}
main().catch((e) => { console.error("[qa:leadmention] error", e?.message || e); process.exit(1); });
