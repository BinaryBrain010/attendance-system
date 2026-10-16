// Functional/RBAC harness: its own prisma-direct data churn must not pollute the audit trail (read
// lazily). Its server-side AuditLog footprint is removed at the end by deleting everything written
// since HARNESS_T0 (isolated local run, so that audit is entirely this harness's).
process.env.AUDIT_LOG = "0";
const HARNESS_T0 = new Date();

/**
 * Work module harness: functional + RBAC coverage for Teams, Tasks, Daily reports, Notifications and
 * Reports. Self-cleaning. Local only.
 *   RBAC_ENFORCE=on npx ts-node qa/work.ts
 */
import { api, mintGodToken, mintTokenFor, IS_LOCAL } from "./lib";
import prisma from "../src/core/models/base.model";
import { randomUUID } from "crypto";

if (!IS_LOCAL) { console.error("[work] refuse: non-local DB"); process.exit(2); }

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra = "") => { if (cond) { pass++; } else { fail++; console.log(`  FAIL ${name} ${extra}`); } };

async function mkUser(username: string, feats: string[], employeeId: string | null): Promise<string> {
  const old = await prisma.user.findFirst({ where: { username } });
  if (old) { await prisma.featurePermission.deleteMany({ where: { parentId: old.id } }); await prisma.loggedInUsers.deleteMany({ where: { userId: old.id } }); await prisma.user.delete({ where: { id: old.id } }); }
  const uid = randomUUID();
  await prisma.user.create({ data: { id: uid, username, password: "x", employeeId, createdAt: new Date(), updatedAt: new Date() } });
  await prisma.featurePermission.create({ data: { id: randomUUID(), parentType: "User", parentId: uid, permissions: { allowedFeatures: feats }, createdAt: new Date(), updatedAt: new Date() } });
  return uid;
}

async function main() {
  const god = mintGodToken();
  // QA employees (names QAWF so qa:cleanup removes them)
  const empBase = { address: "QA", dob: new Date("1990-01-01"), joiningDate: new Date("2020-01-01"), bloodGroup: "O+", contactNo: "0000000000", designation: "QA", department: "QA", martialStatus: "SINGLE", status: "ACTIVE", company: "OKASHASMART", createdAt: new Date(), updatedAt: new Date() };
  const e1 = await prisma.employee.create({ data: { name: "QAWF", surname: "One", code: "QAWF-" + randomUUID().slice(0, 8), ...empBase } as any });
  const e2 = await prisma.employee.create({ data: { name: "QAWF", surname: "Two", code: "QAWF-" + randomUUID().slice(0, 8), ...empBase } as any });
  const e3 = await prisma.employee.create({ data: { name: "QAWF", surname: "Three", code: "QAWF-" + randomUUID().slice(0, 8), ...empBase } as any });
  const ALL_WORK = ["work.*"];
  const uAdmin = await mkUser("qa.workadmin@test.local", ALL_WORK, e1.id);
  const uNone = await mkUser("qa.worknone@test.local", ["login.admin.*"], null);
  const uReader = await mkUser("qa.workreader@test.local", ["work.task.read.own.*"], null);
  const uE2 = await mkUser("qa.worke2@test.local", ["work.report.submit.*", "work.report.read.own.*"], e2.id); // files e2's report
  const tAdmin = mintTokenFor(uAdmin), tNone = mintTokenFor(uNone), tReader = mintTokenFor(uReader), tE2 = mintTokenFor(uE2);

  console.log("[work] functional (god)...");
  const team = await api("POST", "/team/create", god, { name: "QA_WorkTeam", leadId: e1.id, members: [e1.id, e2.id] });
  ok("team create", team.status === 201 && !!team.data?.id, `status=${team.status}`);
  const teamId = team.data?.id;
  ok("team statuses default", Array.isArray(team.data?.statuses) && team.data.statuses.length === 5);

  const task = await api("POST", "/task/create", god, { title: "QA_Task A", teamId, assignees: [e1.id], priority: "HIGH", dueDate: "2026-10-25", checklist: ["a", "b"] });
  ok("task create", task.status === 201 && /^TASK-/.test(task.data?.code || ""), `status=${task.status}`);
  const taskId = task.data?.id;
  ok("task default status from team", task.data?.status === "TODO");
  ok("task checklist", (task.data?.checklist || []).length === 2);

  const list = await api("POST", "/task/get", god, { page: 1, pageSize: 50 });
  ok("task list", list.status === 200 && (list.data?.data || []).some((t: any) => t.id === taskId));

  const st = await api("POST", "/task/setStatus", god, { id: taskId, status: "IN_PROGRESS" });
  ok("task setStatus", st.status === 200 && st.data?.status === "IN_PROGRESS");

  // recurrence: a DAILY task moved to done spawns the next occurrence
  const rec = await api("POST", "/task/create", god, { title: "QA_Recur", teamId, recurring: "DAILY", dueDate: "2026-10-25" });
  const recId = rec.data?.id;
  await api("POST", "/task/setStatus", god, { id: recId, status: "DONE" });
  const spawned = await prisma.task.findFirst({ where: { recurredFromId: recId } });
  ok("recurring spawns next", !!spawned, spawned ? `due=${spawned.dueDate?.toISOString().slice(0, 10)}` : "none");

  // daily report (uAdmin is linked to e1)
  const rep = await api("POST", "/dailyReport/submit", tAdmin, { whatIDid: "qa work", hours: 7 });
  ok("daily report submit", rep.status === 200 && rep.data?.hours === 7, `status=${rep.status}`);
  const comp = await api("POST", "/dailyReport/compliance", god, {});
  ok("compliance", comp.status === 200 && typeof comp.data?.total === "number");

  // reports
  for (const r of ["completion", "overdue", "timeToComplete", "workload", "compliance", "hours"]) {
    const res = await api("POST", `/workReport/${r}`, god, {});
    ok(`report ${r}`, res.status === 200);
  }

  // notification: e1's user (uAdmin) was assigned the task -> has an unread notification
  const notif = await api("GET", "/notification/unreadCount", tAdmin, undefined);
  ok("notification on assign", notif.status === 200 && (notif.data?.unread || 0) >= 1, `unread=${notif.data?.unread}`);

  console.log("[work] RBAC (enforce)...");
  const noneGet = await api("POST", "/task/get", tNone, { page: 1, pageSize: 5 });
  ok("no-perm denied task read", noneGet.status === 403, `status=${noneGet.status}`);
  const readerGet = await api("POST", "/task/get", tReader, { page: 1, pageSize: 5 });
  ok("reader allowed task read", readerGet.status === 200, `status=${readerGet.status}`);
  const readerCreate = await api("POST", "/task/create", tReader, { title: "nope" });
  ok("reader denied task create", readerCreate.status === 403, `status=${readerCreate.status}`);

  console.log("[work] daily-report scope (item 3)...");
  // team members: e1 + e2 required, e3 NOT required
  await api("POST", "/team/members", god, { id: teamId, members: [{ employeeId: e1.id, requiresDailyReport: true }, { employeeId: e2.id, requiresDailyReport: true }, { employeeId: e3.id, requiresDailyReport: false }] });
  const rowNames = (c: any) => new Set((c.data?.rows || []).map((r: any) => r.employeeId));
  // e2 is the subject: starts missing (has not submitted). e1 already submitted in the functional test.
  const e2row = (c: any) => (c.data?.rows || []).find((r: any) => r.employeeId === e2.id);
  const comp1 = await api("POST", "/dailyReport/compliance", god, {});
  const ids1 = rowNames(comp1);
  ok("expected includes required members", ids1.has(e1.id) && ids1.has(e2.id));
  ok("expected excludes not-required member", !ids1.has(e3.id));
  ok("required member starts missing", e2row(comp1)?.status === "missing");

  // e2 on approved leave today -> status "leave", excluded from missing
  const today = new Date(); const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const leave = await prisma.leaveRequest.create({ data: { employeeId: e2.id, startDate: dayStart, endDate: new Date(dayStart.getTime() + 86400000 - 1), status: "APPROVED", reason: "QA leave", createdAt: new Date() } as any });
  const comp3 = await api("POST", "/dailyReport/compliance", god, {});
  ok("on-leave member not missing", e2row(comp3)?.status === "leave");
  ok("missing list excludes on-leave", !(comp3.data?.rows || []).some((r: any) => r.employeeId === e2.id && r.status === "missing"));
  await prisma.leaveRequest.delete({ where: { id: leave.id } });

  // e2 submits -> submitted
  await api("POST", "/dailyReport/submit", tE2, { whatIDid: "qa e2", hours: 4 });
  const comp2 = await api("POST", "/dailyReport/compliance", god, {});
  ok("submitted member marked submitted", e2row(comp2)?.submitted === true);

  // holiday today -> non-working day (nobody expected)
  const hol = await prisma.holiday.create({ data: { date: dayStart, reason: "QA_WorkTest holiday", isActive: true, createdAt: new Date() } as any });
  const comp4 = await api("POST", "/dailyReport/compliance", god, {});
  ok("holiday -> non-working day", comp4.data?.nonWorkingDay === true && (comp4.data?.rows || []).length === 0);
  // clean the holiday + leave immediately so they don't affect other checks
  await prisma.holiday.delete({ where: { id: hol.id } });

  // ---- cleanup ----
  console.log("[work] cleanup...");
  const teamTasks = await prisma.task.findMany({ where: { teamId }, select: { id: true } });
  const taskIds = teamTasks.map((t) => t.id);
  if (taskIds.length) {
    await prisma.taskAssignee.deleteMany({ where: { taskId: { in: taskIds } } });
    await prisma.taskChecklistItem.deleteMany({ where: { taskId: { in: taskIds } } });
    await prisma.taskComment.deleteMany({ where: { taskId: { in: taskIds } } });
    await prisma.taskWatcher.deleteMany({ where: { taskId: { in: taskIds } } });
    await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
  }
  await prisma.teamMember.deleteMany({ where: { teamId } });
  await prisma.team.deleteMany({ where: { id: teamId } });
  const emps3 = [e1.id, e2.id, e3.id];
  await prisma.dailyReportComment.deleteMany({ where: { report: { employeeId: { in: emps3 } } } }).catch(() => {});
  await prisma.dailyReport.deleteMany({ where: { employeeId: { in: emps3 } } });
  await prisma.leaveRequest.deleteMany({ where: { employeeId: { in: emps3 } } }).catch(() => {});
  for (const uid of [uAdmin, uNone, uReader, uE2]) {
    await prisma.notification.deleteMany({ where: { userId: uid } });
    await prisma.featurePermission.deleteMany({ where: { parentId: uid } });
    await prisma.loggedInUsers.deleteMany({ where: { userId: uid } }).catch(() => {});
    await prisma.user.delete({ where: { id: uid } });
  }
  await prisma.employee.deleteMany({ where: { id: { in: emps3 } } });
  // Remove this run's server-side AuditLog footprint (everything written since HARNESS_T0).
  await prisma.auditLog.deleteMany({ where: { createdAt: { gte: HARNESS_T0 } } }).catch(() => {});

  console.log(`\n[work] ===== RESULT: ${pass} pass / ${fail} fail =====`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
}
main().catch(async (e) => { console.error(e); try { await prisma.$disconnect(); } catch { /* */ } process.exit(1); });
