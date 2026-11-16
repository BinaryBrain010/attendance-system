/**
 * Shared QA safety-net purge. Hard-deletes every employee whose code starts with `codePrefix`
 * (e.g. "QA_HR_", "QA_SCOPE_") together with ALL of its FK dependents, in child -> parent order,
 * via deleteMany. Matching by code prefix (not by tracked ids) means it also sweeps rows a PRIOR
 * run left behind on failure and any dependent rows the test body created without tracking — which
 * is exactly how QA fixtures used to leak (an untracked attendance/leave row blocks the per-id
 * employee.delete, which then silently fails). Call it from a script's `finally` so cleanup is
 * guaranteed even when the test body throws. Every step swallows its own error so one FK quirk can
 * never abort the sweep. Local-only callers (the QA harness) — never point this at prod data.
 */
export async function purgeQaEmployees(prisma: any, codePrefix: string): Promise<void> {
  const swallow = async (fn: () => Promise<any>) => { try { await fn(); } catch { /* best-effort */ } };

  const emps = await prisma.employee
    .findMany({ where: { code: { startsWith: codePrefix } }, select: { id: true } })
    .catch(() => [] as any[]);
  const empIds = emps.map((e: any) => e.id);
  if (!empIds.length) return;

  const users = await prisma.user
    .findMany({ where: { employeeId: { in: empIds } }, select: { id: true } })
    .catch(() => [] as any[]);
  const userIds = users.map((u: any) => u.id);

  const e = { employeeId: { in: empIds } };
  // Dependents of the employees (child -> parent).
  await swallow(() => prisma.probationDecision.deleteMany({ where: e }));
  await swallow(() => prisma.attendanceRequest.deleteMany({ where: e }));
  await swallow(() => prisma.attendance.deleteMany({ where: e }));
  await swallow(() => prisma.leaveRequest.deleteMany({ where: e }));
  await swallow(() => prisma.leaveAllocation.deleteMany({ where: e }));
  await swallow(() => prisma.shiftAssignment.deleteMany({ where: e }));
  await swallow(() => prisma.unitEmployee.deleteMany({ where: e }));
  await swallow(() => prisma.dailyReportComment.deleteMany({ where: { report: { employeeId: { in: empIds } } } }));
  await swallow(() => prisma.dailyReport.deleteMany({ where: e }));
  await swallow(() => prisma.taskAssignee.deleteMany({ where: e }));
  await swallow(() => prisma.teamMember.deleteMany({ where: e }));
  await swallow(() => prisma.salesAgent.deleteMany({ where: e }));
  await swallow(() => prisma.notification.deleteMany({ where: { entityType: "Employee", entityId: { in: empIds } } }));

  // Dependents of the linked QA users, then the users themselves (clears User.employeeId FK).
  if (userIds.length) {
    const u = { userId: { in: userIds } };
    await swallow(() => prisma.notification.deleteMany({ where: u }));
    await swallow(() => prisma.activityLog.deleteMany({ where: u }));
    await swallow(() => prisma.loggedInUsers.deleteMany({ where: u }));
    await swallow(() => prisma.blacklistToken.deleteMany({ where: u }));
    await swallow(() => prisma.userRole.deleteMany({ where: u }));
    await swallow(() => prisma.userGroup.deleteMany({ where: u }));
    await swallow(() => prisma.featurePermission.deleteMany({ where: { parentType: "User", parentId: { in: userIds } } }));
    await swallow(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }));
  }

  await swallow(() => prisma.employee.deleteMany({ where: { id: { in: empIds } } }));
}
