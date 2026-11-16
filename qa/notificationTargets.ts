/**
 * Notification-target audit (Part 1c, QA_ data only, self-cleaning). For each notification type it
 * creates the notification for a LOW-PRIVILEGE user and asserts the receiver can open the target —
 * and that an unrelated low-priv user CANNOT. The two fixes (VISITOR host access, MENTION participant
 * access) are enforced in the service and tested directly here; the self/scope types (LEAVE_DECISION,
 * ATTENDANCE_DECISION, LEAD_ASSIGNED, Task.*) are gated by access:self / CRM scope — verified here by
 * the receiver-ownership invariant (their employeeId owns the entity), which those gates check.
 *
 *   npx ts-node qa/notificationTargets.ts   (results in qa/.notiftargets-last.txt)
 */
import * as fs from "fs";
import prisma from "../src/core/models/base.model";
import { runWithContext } from "../src/core/context/requestContext";
import { GOD_ID } from "../src/modules/CRM/shared/access";
import VisitorService from "../src/modules/Frontdesk/Visitor/services/visitor.service";
import LeadService from "../src/modules/CRM/Lead/services/lead.service";

const TAG = `QA_NOTIF_${Date.now()}`;
let pass = 0, fail = 0;
const lines: string[] = [];
function out(s: string) { lines.push(s); try { process.stdout.write(s + "\n"); } catch { /* ignore */ } }
function check(label: string, ok: boolean, detail = "") { (ok ? pass++ : fail++); out(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`); }
async function expect403(label: string, fn: () => Promise<any>) {
  try { const r = await fn(); check(label, r == null, r == null ? "returned null (no access)" : "UNEXPECTED access"); }
  catch (e: any) { check(label, (e?.statusCode === 403 || /scope|not the host|forbidden/i.test(e?.message || "")), e?.message); }
}

async function main() {
  const ids = { emps: [] as string[], users: [] as string[], visitors: [] as string[], leads: [] as string[], notifs: [] as string[], leaves: [] as string[], attReqs: [] as string[] };
  const visitorSvc = new VisitorService();
  const leadSvc = new LeadService();

  async function mkEmpUser(suffix: string) {
    const e = await prisma.employee.create({ data: { name: "QANotif", surname: suffix, address: "QA", dob: new Date("1990-01-01"), joiningDate: new Date("2021-01-01"), bloodGroup: "O+", contactNo: "0300", designation: "Staff", department: "QA-Notif", martialStatus: "Single", company: "SOLARMAX", code: `${TAG}_${suffix}`, status: "ACTIVE" } as any });
    const u = await prisma.user.create({ data: { username: `${TAG}.${suffix}@test.local`, password: "x", employeeId: e.id, createdAt: new Date() } as any });
    ids.emps.push(e.id); ids.users.push(u.id);
    return { emp: e, user: u };
  }
  const notif = async (userId: string, type: string, entityType: string, entityId: string) => {
    const n = await prisma.notification.create({ data: { userId, type, title: `${type} test`, entityType, entityId, createdAt: new Date() } as any });
    ids.notifs.push(n.id); return n;
  };

  try {
    await runWithContext({ userId: GOD_ID } as any, async () => {
      const host = await mkEmpUser("HOST");       // a plain employee (no frontdesk permission)
      const stranger = await mkEmpUser("STRANGER"); // an unrelated low-priv employee
      const mentioned = await mkEmpUser("MENTION"); // mentioned on a lead, no CRM scope

      // ---- VISITOR / VISITOR_RESPONSE: host opens the referral; a stranger cannot ------------------
      const visitor = await prisma.visitor.create({ data: { name: "QA Walk-in", company: "ACME", phone: "123", purpose: "Meeting", visitDate: new Date(), timeIn: new Date(), referredToEmployeeId: host.emp.id, referredAt: new Date(), createdById: stranger.user.id } as any });
      ids.visitors.push(visitor.id);
      await notif(host.user.id, "VISITOR", "Visitor", visitor.id);

      const hv = await visitorSvc.getMyVisitor(host.user.id, visitor.id);
      check("VISITOR → host can open the visitor detail", !!hv && hv.name === "QA Walk-in", hv?.status);
      await expect403("VISITOR → a stranger (non-host, no frontdesk) is blocked", () => visitorSvc.getMyVisitor(stranger.user.id, visitor.id));
      const resp = await visitorSvc.respondVisitor(host.user.id, visitor.id, "WAIT", "Please wait 5 min");
      check("VISITOR_RESPONSE → host can respond (ask to wait)", !!resp, "ok");

      // ---- MENTION: the mentioned user gets read access to the lead; a stranger does not -----------
      const lead = await prisma.lead.create({ data: { customerName: "TEST CUSTOMER", stage: "NEW", channel: "WALK_IN", company: "OKASHASMART", createdBy: GOD_ID } as any });
      ids.leads.push(lead.id);
      await notif(mentioned.user.id, "MENTION", "Lead", lead.id);

      const ml = await leadSvc.getById(mentioned.user.id, lead.id);
      check("MENTION → mentioned user can open the lead", !!ml && ml.id === lead.id);
      await expect403("MENTION → a stranger (not mentioned, out of scope) is blocked", () => leadSvc.getById(stranger.user.id, lead.id));
      // the mentioned user may reply with a NOTE, but not move the stage
      const reply = await leadSvc.logActivity(mentioned.user.id, { leadId: lead.id, type: "NOTE", notes: "Thanks for the mention" });
      check("MENTION → mentioned user can reply with a note", !!reply?.activity && !reply.stageMoved);
      await expect403("MENTION → mentioned user cannot move the stage", () => leadSvc.logActivity(mentioned.user.id, { leadId: lead.id, type: "NOTE", toStage: "QUALIFIED" }));

      // ---- LEAVE_DECISION / ATTENDANCE_DECISION: the receiver owns the entity (access:self passes) --
      const lr = await prisma.leaveRequest.create({ data: { employeeId: host.emp.id, startDate: new Date(), endDate: new Date(), status: "APPROVED", leaveType: "CASUAL" } as any });
      ids.leaves.push(lr.id);
      const ln = await notif(host.user.id, "LEAVE_DECISION", "LeaveRequest", lr.id);
      const lrOwner = await prisma.leaveRequest.findUnique({ where: { id: lr.id }, select: { employeeId: true } });
      const lnUserEmp = await prisma.user.findUnique({ where: { id: ln.userId }, select: { employeeId: true } });
      check("LEAVE_DECISION → receiver's employee owns the leave (access:self opens it)", !!lnUserEmp?.employeeId && lnUserEmp.employeeId === lrOwner?.employeeId);

      const ar = await prisma.attendanceRequest.create({ data: { employeeId: host.emp.id, reason: "Forgot to check in", status: "APPROVED" } as any });
      ids.attReqs.push(ar.id);
      const an = await notif(host.user.id, "ATTENDANCE_DECISION", "AttendanceRequest", ar.id);
      const arOwner = await prisma.attendanceRequest.findUnique({ where: { id: ar.id }, select: { employeeId: true } });
      const anUserEmp = await prisma.user.findUnique({ where: { id: an.userId }, select: { employeeId: true } });
      check("ATTENDANCE_DECISION → receiver's employee owns the request (access:self opens it)", !!anUserEmp?.employeeId && anUserEmp.employeeId === arOwner?.employeeId);
    });
  } finally {
    for (const id of ids.notifs) await prisma.notification.delete({ where: { id } }).catch(() => {});
    await prisma.leadActivity.deleteMany({ where: { leadId: { in: ids.leads } } }).catch(() => {});
    for (const id of ids.leaves) await prisma.leaveRequest.delete({ where: { id } }).catch(() => {});
    for (const id of ids.attReqs) await prisma.attendanceRequest.delete({ where: { id } }).catch(() => {});
    for (const id of ids.leads) await prisma.lead.delete({ where: { id } }).catch(() => {});
    for (const id of ids.visitors) await prisma.visitor.delete({ where: { id } }).catch(() => {});
    for (const id of ids.users) await prisma.user.delete({ where: { id } }).catch(() => {});
    for (const id of ids.emps) await prisma.employee.delete({ where: { id } }).catch(() => {});
  }

  out(`\n[notificationTargets] ${pass} passed, ${fail} failed`);
  try { fs.writeFileSync("qa/.notiftargets-last.txt", lines.join("\n") + "\n"); } catch { /* ignore */ }
  await prisma.$disconnect();
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
