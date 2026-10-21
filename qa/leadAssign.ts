/**
 * Phase 2c + edge case — lead assignment permission (LOCAL ONLY, QA_ data, self-cleaning).
 *   - Without crm.lead.assign + WITH an agent profile: the requested agentId is ignored and the lead
 *     goes to the caller's OWN agent; an update can't change the agent.
 *   - With crm.lead.assign: the requested agent is honored (scope-checked).
 *   - Without crm.lead.assign + WITHOUT an agent profile (front desk): the lead is created UNASSIGNED
 *     and managers (ALL-scope agents) are notified — never blocked.
 * Run: AUDIT_LOG=0 npm run qa:leadassign
 */
import bcrypt from "bcrypt";
import prisma from "../src/core/models/base.model";
import { runWithContext } from "../src/core/context/requestContext";
import LeadService from "../src/modules/CRM/Lead/services/lead.service";

const leadSvc = new LeadService();
const S = Date.now();
const made: any = { emps: [], users: [], agents: [], leads: [] };
const one = (x: any) => (Array.isArray(x) ? x[0] : x);
let pass = true;
const ok = (c: boolean, m: string) => { if (!c) pass = false; console.log(`  ${c ? "OK  " : "FAIL"} ${m}`); };

async function mkAgent(code: string, feats: string[] | null) {
  const emp: any = await prisma.employee.create({ data: { name: "QA", surname: code, address: "QA", dob: new Date("1990-01-01"), joiningDate: new Date("2020-01-01"), bloodGroup: "O+", contactNo: "0", designation: "QA", department: "QA", martialStatus: "SINGLE", company: "OKASHASMART" as any, code: `QA_LA_${code}_${S}` } });
  made.emps.push(emp.id);
  let userId: string | null = null;
  if (feats) {
    const u: any = await prisma.user.create({ data: { username: `QA_la_${code}_${S}@test.local`, password: await bcrypt.hash("x", 4), createdAt: new Date() } });
    made.users.push(u.id); userId = u.id;
    await prisma.featurePermission.create({ data: { parentType: "User", parentId: u.id, permissions: { allowedFeatures: feats } as any, createdAt: new Date() } });
  }
  const ag: any = await prisma.salesAgent.create({ data: { agentCode: `QA_LA_${code}_${S}`, employeeId: emp.id, userId: userId ?? undefined, scope: "ALL" as any, company: "OKASHASMART" as any } });
  made.agents.push(ag.id);
  return { empId: emp.id, userId, agentId: ag.id };
}

async function mkUser(feats: string[]) {
  const u: any = await prisma.user.create({ data: { username: `QA_la_fd_${S}@test.local`, password: await bcrypt.hash("x", 4), createdAt: new Date() } });
  made.users.push(u.id);
  await prisma.featurePermission.create({ data: { parentType: "User", parentId: u.id, permissions: { allowedFeatures: feats } as any, createdAt: new Date() } });
  return u.id as string;
}

async function main() {
  try {
    const A = await mkAgent("A", ["login.admin.*", "crm.lead.create.*", "crm.lead.read.all.*"]); // no assign
    const B = await mkAgent("B", ["login.admin.*", "crm.lead.create.*", "crm.lead.read.all.*", "crm.lead.assign.*"]); // assign
    const C = await mkAgent("C", null); // target agent
    const mgr = await mkAgent("MGR", ["login.admin.*"]); // ALL-scope manager (notification recipient)
    const fd = await mkUser(["login.admin.*", "crm.lead.create.*", "crm.lead.read.own.*"]); // no agent, no assign

    let leadA: any, leadB: any, leadFD: any;
    await runWithContext({ userId: A.userId!, platform: "Admin" }, async () => { leadA = one(await leadSvc.create(A.userId!, { customerName: `QA LA no-assign ${S}`, agentId: C.agentId, company: "OKASHASMART" })); });
    made.leads.push(leadA.id);
    ok(leadA.agentId === A.agentId, `no-assign create -> own agent (requested ignored)`);

    await runWithContext({ userId: B.userId!, platform: "Admin" }, async () => { leadB = one(await leadSvc.create(B.userId!, { customerName: `QA LA assign ${S}`, agentId: C.agentId, company: "OKASHASMART" })); });
    made.leads.push(leadB.id);
    ok(leadB.agentId === C.agentId, `assign create -> requested agent honored`);

    await runWithContext({ userId: A.userId!, platform: "Admin" }, async () => { await leadSvc.update(A.userId!, leadA.id, { agentId: C.agentId, notes: "edit" }); });
    ok((await prisma.lead.findUnique({ where: { id: leadA.id } }))!.agentId === A.agentId, `no-assign update -> agent unchanged`);

    await runWithContext({ userId: fd, platform: "Admin" }, async () => { leadFD = one(await leadSvc.create(fd, { customerName: `QA LA frontdesk ${S}`, company: "OKASHASMART" })); });
    made.leads.push(leadFD.id);
    ok(leadFD.agentId === null, `front-desk (no agent) create -> UNASSIGNED, not blocked`);
    const notif = await prisma.notification.findFirst({ where: { userId: mgr.userId!, type: "LEAD_UNASSIGNED", entityId: leadFD.id } });
    ok(!!notif, `front-desk unassigned -> manager notified (LEAD_UNASSIGNED)`);
  } finally {
    for (const id of made.leads) { await prisma.notification.deleteMany({ where: { entityId: id } }).catch(() => {}); await prisma.leadActivity.deleteMany({ where: { leadId: id } }).catch(() => {}); await prisma.auditLog.deleteMany({ where: { entityId: id } }).catch(() => {}); await prisma.lead.delete({ where: { id } }).catch(() => {}); }
    for (const id of made.agents) await prisma.salesAgent.delete({ where: { id } }).catch(() => {});
    for (const id of made.users) { await prisma.featurePermission.deleteMany({ where: { parentId: id } }).catch(() => {}); await prisma.notification.deleteMany({ where: { userId: id } }).catch(() => {}); await prisma.loggedInUsers.deleteMany({ where: { userId: id } }).catch(() => {}); await prisma.user.delete({ where: { id } }).catch(() => {}); }
    for (const id of made.emps) await prisma.employee.delete({ where: { id } }).catch(() => {});
    console.log("  cleaned up QA_ agents/users/leads");
  }
  console.log(pass ? "\nRESULT: PASS" : "\nRESULT: FAIL");
  process.exit(pass ? 0 : 1);
}
main().catch((e) => { console.error("[qa:leadassign] error", e?.message || e); process.exit(1); });
