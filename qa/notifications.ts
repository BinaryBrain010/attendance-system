/**
 * NOTIFICATIONS audit 2026-11-12 — one QA case per notify-worthy event (QA_ data only, self-cleaning).
 *
 * Drives the REAL service methods end to end and asserts that a Notification row is created for the
 * right recipient User, with the correct type and entity link (entityType/entityId). Covers every
 * event in the spec:
 *   CRM leads : assign-on-create, assign-on-reassign, transfer, @mention,
 *               review flag(send-to-My-Day), review send-back, review done, review reopen
 *   Frontdesk : visitor referred, visitor attended
 *   Work      : task assigned, task comment, daily-report comment
 *   AMS       : leave decision, attendance-request decision
 *
 * Creates QA_ units/employees/users/sales-agents + grants, asserts, then deletes all of it (incl. the
 * Notification rows for the QA_ recipients). Run:  npx ts-node qa/notifications.ts
 */
import prisma from "../src/core/models/base.model";
import { LeaveStatus } from "@prisma/client";
import LeadService from "../src/modules/CRM/Lead/services/lead.service";
import LeadReviewService from "../src/modules/CRM/LeadReview/services/leadReview.service";
import VisitorService from "../src/modules/Frontdesk/Visitor/services/visitor.service";
import TaskService from "../src/modules/Work/Task/services/task.service";
import DailyReportService from "../src/modules/Work/DailyReport/services/dailyReport.service";
import LeaveReqService from "../src/modules/AMS/Leaves/services/leaveReq.service";
import AttendanceReqService from "../src/modules/AMS/Attendance/services/attendanceReq.service";

import * as fs from "fs";

const TAG = `QA_NOTIF_${Date.now()}`;
let pass = 0, fail = 0;
const lines: string[] = [];
// The backend logger hijacks console.*, so write results straight to real stdout (and collect for a file).
function out(s: string) { lines.push(s); try { process.stdout.write(s + "\n"); } catch { /* ignore */ } }
function check(label: string, ok: boolean, detail = "") {
  (ok ? pass++ : fail++);
  out(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
}

/** Assert exactly one (>=1) notification for `userId` of `type` linking to the given entity. */
async function hasNotif(userId: string, type: string, entityType?: string, entityId?: string): Promise<boolean> {
  const rows = await prisma.notification.findMany({ where: { userId, type } });
  if (!rows.length) return false;
  if (entityType === undefined) return true;
  return rows.some((r) => r.entityType === entityType && (entityId === undefined || r.entityId === entityId));
}

async function mkEmployee(suffix: string) {
  return prisma.employee.create({
    data: {
      name: "QANotif", surname: suffix, address: "QA", dob: new Date("1990-01-01"),
      joiningDate: new Date("2020-01-01"), bloodGroup: "O+", contactNo: "0300-0000000",
      designation: "QA", department: "QA", martialStatus: "Single", company: "SOLARMAX",
      code: `${TAG}_${suffix}`,
    } as any,
  });
}
async function grant(userId: string, features: string[]) {
  return prisma.featurePermission.create({
    data: { parentType: "User", parentId: userId, permissions: { allowedFeatures: features } } as any,
  });
}

async function main() {
  const ids = {
    users: [] as string[], fps: [] as string[], agents: [] as string[], ues: [] as string[],
    emps: [] as string[], units: [] as string[], leads: [] as string[], reviews: [] as string[],
    visitors: [] as string[], tasks: [] as string[], reports: [] as string[],
    leaveReqs: [] as string[], attReqs: [] as string[],
  };
  try {
    // --- Setup: one unit, four employees, four users, three sales agents -------------------------
    const unit = await prisma.unit.create({ data: { name: `${TAG}_UNIT`, type: "OFFICE" } as any });
    ids.units.push(unit.id);

    const empMgr = await mkEmployee("mgr");
    const empA = await mkEmployee("agentA");
    const empB = await mkEmployee("agentB");
    const empWorker = await mkEmployee("worker");
    ids.emps.push(empMgr.id, empA.id, empB.id, empWorker.id);
    for (const eId of [empMgr.id, empA.id, empB.id, empWorker.id]) {
      const ue = await prisma.unitEmployee.create({ data: { unitId: unit.id, employeeId: eId } as any });
      ids.ues.push(ue.id);
    }

    const uMgr = await prisma.user.create({ data: { username: `${TAG}.mgr@test.local`, password: "x", employeeId: empMgr.id } as any });
    const uA = await prisma.user.create({ data: { username: `${TAG}.a@test.local`, password: "x", employeeId: empA.id } as any });
    const uB = await prisma.user.create({ data: { username: `${TAG}.b@test.local`, password: "x", employeeId: empB.id } as any });
    const uWorker = await prisma.user.create({ data: { username: `${TAG}.worker@test.local`, password: "x", employeeId: empWorker.id } as any });
    ids.users.push(uMgr.id, uA.id, uB.id, uWorker.id);

    // Manager can assign/read all leads, comment on any task, and bypass unit scoping on AMS decisions.
    ids.fps.push((await grant(uMgr.id, [
      "login.admin.*", "employee.read.*", "attendance.read.*", "ams.viewAll.unit.*",
      "crm.lead.read.all.*", "crm.lead.assign.*", "work.task.read.all.*", "work.report.read.all.*",
    ])).id);
    // Agents hold own-scope lead read so they can open/resolve their own leads (owner reply path).
    ids.fps.push((await grant(uA.id, ["login.admin.*", "employee.read.*", "crm.lead.read.own.*"])).id);
    ids.fps.push((await grant(uB.id, ["login.admin.*", "employee.read.*", "crm.lead.read.own.*"])).id);
    ids.fps.push((await grant(uWorker.id, ["login.admin.*"])).id);

    const agentMgr = await prisma.salesAgent.create({ data: { agentCode: `${TAG}_AM`, employeeId: empMgr.id, userId: uMgr.id, scope: "ALL" } as any });
    const agentA = await prisma.salesAgent.create({ data: { agentCode: `${TAG}_AA`, employeeId: empA.id, userId: uA.id, scope: "OWN" } as any });
    const agentB = await prisma.salesAgent.create({ data: { agentCode: `${TAG}_AB`, employeeId: empB.id, userId: uB.id, scope: "OWN" } as any });
    ids.agents.push(agentMgr.id, agentA.id, agentB.id);

    const leadSvc = new LeadService();
    const reviewSvc = new LeadReviewService();

    // 1. Lead assign ON CREATE -> LEAD_ASSIGNED to the agent's user. ------------------------------
    const created: any = await leadSvc.create(uMgr.id, { customerName: `${TAG} Cust1`, agentId: agentA.id });
    const lead1 = Array.isArray(created) ? created[0] : created;
    ids.leads.push(lead1.id);
    check("create-with-agent notifies the assignee (LEAD_ASSIGNED)", await hasNotif(uA.id, "LEAD_ASSIGNED", "Lead", lead1.id));

    // 2. Lead assign ON REASSIGN (update agentId) -> LEAD_ASSIGNED to the new agent's user. --------
    await leadSvc.update(uMgr.id, lead1.id, { agentId: agentB.id });
    check("reassign notifies the new assignee (LEAD_ASSIGNED)", await hasNotif(uB.id, "LEAD_ASSIGNED", "Lead", lead1.id));

    // 3. Lead transfer -> LEAD_TRANSFER to BOTH the previous and the new agent. --------------------
    const created2: any = await leadSvc.create(uMgr.id, { customerName: `${TAG} Cust2`, agentId: agentA.id });
    const lead2 = Array.isArray(created2) ? created2[0] : created2;
    ids.leads.push(lead2.id);
    await leadSvc.transfer(uMgr.id, lead2.id, agentB.id, "QA transfer reason");
    check("transfer notifies the previous agent (LEAD_TRANSFER)", await hasNotif(uA.id, "LEAD_TRANSFER", "Lead", lead2.id));
    check("transfer notifies the new agent (LEAD_TRANSFER)", await hasNotif(uB.id, "LEAD_TRANSFER", "Lead", lead2.id));

    // 4. @mention -> MENTION to the mentioned user. -----------------------------------------------
    const created3: any = await leadSvc.create(uMgr.id, { customerName: `${TAG} Cust3`, agentId: agentA.id, mentions: [uB.id], notes: "cc @b" });
    const lead3 = Array.isArray(created3) ? created3[0] : created3;
    ids.leads.push(lead3.id);
    check("mention notifies the mentioned user (MENTION)", await hasNotif(uB.id, "MENTION", "Lead", lead3.id));

    // 5. Review flag (send-to-My-Day) -> LEAD_REVIEW to the owner (agentA's user). ------------------
    const review: any = await reviewSvc.create(uMgr.id, { leadId: lead2.id, colour: "RED", instruction: "Call the customer", sendToMyDay: true });
    ids.reviews.push(review.id);
    check("review flag to My Day notifies the owner (LEAD_REVIEW)", await hasNotif(uB.id, "LEAD_REVIEW", "Lead", lead2.id));
    // lead2 was transferred to agentB, so its owner is uB.

    // 6. Review send-back (existing flag) -> LEAD_REVIEW to the owner. -----------------------------
    await prisma.notification.deleteMany({ where: { userId: uB.id, type: "LEAD_REVIEW" } }); // isolate the send-back signal
    await reviewSvc.sendBack(uMgr.id, { id: review.id, instruction: "Please follow up again" });
    check("review send-back notifies the owner (LEAD_REVIEW)", await hasNotif(uB.id, "LEAD_REVIEW", "Lead", lead2.id));

    // 7. Review done (owner replies) -> LEAD_REVIEW_DONE to the reviewer (manager). -----------------
    await reviewSvc.reply(uB.id, { id: review.id, reply: "Done, customer called" });
    check("review done notifies the reviewer (LEAD_REVIEW_DONE)", await hasNotif(uMgr.id, "LEAD_REVIEW_DONE", "Lead", lead2.id));

    // 8. Review reopen (reviewer) -> LEAD_REVIEW_REOPEN to the owner. ------------------------------
    await reviewSvc.reopen(uMgr.id, { id: review.id });
    check("review reopen notifies the owner (LEAD_REVIEW_REOPEN)", await hasNotif(uB.id, "LEAD_REVIEW_REOPEN", "Lead", lead2.id));

    // 9. Visitor referred -> VISITOR to the referred host's user. ----------------------------------
    const visitorSvc = new VisitorService();
    const vis: any = await visitorSvc.createVisitor({ name: `${TAG} Guest`, referredToEmployeeId: empWorker.id, unitId: unit.id } as any);
    ids.visitors.push(vis.id);
    check("visitor referred notifies the host (VISITOR)", await hasNotif(uWorker.id, "VISITOR", "Visitor", vis.id));

    // 10. Visitor attended -> VISITOR_ATTENDED to the front-desk user who logged it. ----------------
    const vis2: any = await prisma.visitor.create({ data: { name: `${TAG} Guest2`, referredToEmployeeId: empWorker.id, unitId: unit.id, createdById: uMgr.id, visitDate: new Date() } as any });
    ids.visitors.push(vis2.id);
    await visitorSvc.attendVisitor(vis2.id, uWorker.id, "received");
    check("visitor attended notifies the logger (VISITOR_ATTENDED)", await hasNotif(uMgr.id, "VISITOR_ATTENDED", "Visitor", vis2.id));

    // 11. Task assigned -> ASSIGNED to the assignee's user. ----------------------------------------
    const taskSvc = new TaskService();
    const task: any = await taskSvc.create(uMgr.id, { title: `${TAG} Task`, assignees: [empWorker.id] });
    ids.tasks.push(task.id);
    check("task assigned notifies the assignee (ASSIGNED)", await hasNotif(uWorker.id, "ASSIGNED", "Task", task.id));

    // 12. Task comment -> COMMENT to the assignee (not the commenter). -----------------------------
    await taskSvc.addComment(uMgr.id, task.id, "QA comment body");
    check("task comment notifies the assignee (COMMENT)", await hasNotif(uWorker.id, "COMMENT", "Task", task.id));

    // 13. Daily-report comment -> COMMENT to the report's employee user. ---------------------------
    const report: any = await prisma.dailyReport.create({ data: { employeeId: empWorker.id, date: new Date(), whatIDid: "QA" } as any });
    ids.reports.push(report.id);
    const reportSvc = new DailyReportService();
    await reportSvc.addComment(uMgr.id, report.id, "Nice work");
    check("daily-report comment notifies the author (COMMENT)", await hasNotif(uWorker.id, "COMMENT", "DailyReport", report.id));

    // 14. Leave decision (reject) -> LEAVE_DECISION to the requesting employee's user. --------------
    const leaveReq: any = await prisma.leaveRequest.create({ data: { employeeId: empWorker.id, startDate: new Date("2099-06-01"), endDate: new Date("2099-06-02"), status: "PENDING" } as any });
    ids.leaveReqs.push(leaveReq.id);
    await new LeaveReqService().updateLeaveRequestStatus(leaveReq.id, LeaveStatus.REJECTED, "Not this time", uMgr.id);
    check("leave decision notifies the requester (LEAVE_DECISION)", await hasNotif(uWorker.id, "LEAVE_DECISION", "LeaveRequest", leaveReq.id));

    // 15. Attendance-request decision (reject) -> ATTENDANCE_DECISION to the requester's user. ------
    const attReq: any = await prisma.attendanceRequest.create({ data: { employeeId: empWorker.id, status: "PENDING", reason: "forgot to punch" } as any });
    ids.attReqs.push(attReq.id);
    await new AttendanceReqService().updateAttendanceRequestStatus(attReq.id, LeaveStatus.REJECTED, uMgr.id, "Denied", uMgr.id);
    check("attendance decision notifies the requester (ATTENDANCE_DECISION)", await hasNotif(uWorker.id, "ATTENDANCE_DECISION", "AttendanceRequest", attReq.id));

    // Negative: the actor never notifies themselves (manager assigned to self on create). ----------
    const self: any = await leadSvc.create(uMgr.id, { customerName: `${TAG} Self`, agentId: agentMgr.id });
    const leadSelf = Array.isArray(self) ? self[0] : self;
    ids.leads.push(leadSelf.id);
    check("self-assignment does NOT notify the actor", !(await hasNotif(uMgr.id, "LEAD_ASSIGNED", "Lead", leadSelf.id)));
  } finally {
    // Cleanup — notifications for the QA_ recipients first, then children -> parents.
    for (const id of ids.users) await prisma.notification.deleteMany({ where: { userId: id } }).catch(() => {});
    for (const id of ids.reviews) await prisma.leadReview.delete({ where: { id } }).catch(() => {});
    await prisma.taskComment.deleteMany({ where: { task: { code: { startsWith: TAG } } } }).catch(() => {});
    await prisma.dailyReportComment.deleteMany({ where: { reportId: { in: ids.reports } } }).catch(() => {});
    await prisma.taskAssignee.deleteMany({ where: { taskId: { in: ids.tasks } } }).catch(() => {});
    await prisma.taskWatcher.deleteMany({ where: { taskId: { in: ids.tasks } } }).catch(() => {});
    for (const id of ids.tasks) await prisma.task.delete({ where: { id } }).catch(() => {});
    for (const id of ids.reports) await prisma.dailyReport.delete({ where: { id } }).catch(() => {});
    for (const id of ids.leaveReqs) await prisma.leaveRequest.delete({ where: { id } }).catch(() => {});
    for (const id of ids.attReqs) await prisma.attendanceRequest.delete({ where: { id } }).catch(() => {});
    for (const id of ids.visitors) await prisma.visitor.delete({ where: { id } }).catch(() => {});
    await prisma.leadProduct.deleteMany({ where: { leadId: { in: ids.leads } } }).catch(() => {});
    for (const id of ids.leads) await prisma.lead.delete({ where: { id } }).catch(() => {});
    for (const id of ids.agents) await prisma.salesAgent.delete({ where: { id } }).catch(() => {});
    for (const id of ids.fps) await prisma.featurePermission.delete({ where: { id } }).catch(() => {});
    for (const id of ids.ues) await prisma.unitEmployee.delete({ where: { id } }).catch(() => {});
    for (const id of ids.users) await prisma.user.delete({ where: { id } }).catch(() => {});
    for (const id of ids.emps) await prisma.employee.delete({ where: { id } }).catch(() => {});
    for (const id of ids.units) await prisma.unit.delete({ where: { id } }).catch(() => {});
  }

  out(`\n[notifications] ${pass} passed, ${fail} failed`);
  try { fs.writeFileSync("qa/.notif-last.txt", lines.join("\n") + "\n"); } catch { /* ignore */ }
  await prisma.$disconnect();
  process.exitCode = fail === 0 ? 0 : 1; // let stdout flush naturally (process.exit truncates pipes)
}
main().catch(async (e) => {
  out(`ERROR ${e?.message || e}`);
  try { fs.writeFileSync("qa/.notif-last.txt", lines.join("\n") + "\nERROR\n"); } catch { /* ignore */ }
  await prisma.$disconnect(); process.exitCode = 1;
});
