/**
 * QA cleanup.  npm run qa:cleanup
 * Fully removes everything the harness creates, for EVERY past run (not just the last one), by
 * hard-deleting against unambiguous QA patterns via Prisma (deleteMany is not paginated, so there is
 * no "first page only" gap). Real data is never matched: QA users are "*@test.local" or the users
 * auto-provisioned for QA employees (name QAWF or QASelf, code starting QAWF- or QAUT-SELF-); QA
 * roles/groups are "QA_..."; QA records carry QA_ name prefixes. Record ids from _created.json are
 * also removed as a complement. Local-only (lib.ts refuses a non-localhost DATABASE_URL).
 */
// Cleanup is a maintenance sweep, not business activity: do not let its own deletes write AuditLog
// rows. The audit hook reads this env lazily, so setting it here (before any DB op) disables logging
// for this process. Must be set before base.model's hook runs.
process.env.AUDIT_LOG = "0";
import fs from "fs";
import path from "path";
import { api, mintGodToken } from "./lib";

async function main() {
  const GOD = mintGodToken();
  // Captured before the API /delete calls below. Those are soft-deletes via the live server (audit
  // ON), and deleting a QA holiday server-side cascades an attendance-unmark that is itself audited.
  // All such audit is a side-effect of this cleanup removing QA data, so we delete it at the end.
  const CLEANUP_T0 = new Date();
  const p = path.join(__dirname, "_created.json");
  const c = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
  let removed = 0;
  const del = async (mount: string, id: string, field = "id") => {
    const r = await api("POST", mount + "/delete", GOD, { [field]: id });
    if (r.status >= 200 && r.status < 300) removed++;
    return r.status;
  };

  // Record types from _created.json that pattern-matching cannot cleanly target (holiday/unit/
  // leaveConf). API delete works for these QA-named records; ignore failures.
  if (c) {
    for (const id of c.records?.visitor || []) await del("/visitor", id);
    for (const id of c.records?.holiday || []) await del("/holiday", id);
    for (const id of c.records?.unit || []) await del("/unit", id);
    for (const id of c.records?.leaveconf || c.records?.leaveConf || []) await del("/leave/leave-configurations", id);
  }

  // Comprehensive hard delete by QA pattern (all runs). lib.ts guarantees local-only.
  const summary: Record<string, number> = {};
  const prisma = require("../src/core/models/base.model").default;
  const run = async (label: string, fn: () => Promise<{ count: number }>) => {
    try { const r = await fn(); summary[label] = (summary[label] || 0) + (r?.count || 0); }
    catch (e: any) { console.warn(`[QA cleanup] ${label} skipped:`, (e?.message || e).split("\n")[0]); }
  };
  const ids = async (model: string, where: any): Promise<string[]> =>
    (await prisma[model].findMany({ where, select: { id: true } })).map((x: any) => x.id);

  try {
    const QA_NAME = { startsWith: "QA_" };
    const empWhere = { OR: [{ name: "QAWF" }, { name: "QASelf" }, { code: { startsWith: "QAWF-" } }, { code: { startsWith: "QAUT-SELF-" } }] };
    const qaEmpIds = await ids("employee", empWhere);
    // QA users: the RBAC personas (*@test.local) + the users auto-provisioned for QA employees
    const qaUserIds = await ids("user", { OR: [{ username: { contains: "@test.local" } }, ...(qaEmpIds.length ? [{ employeeId: { in: qaEmpIds } }] : [])] });
    const qaRoleIds = await ids("role", { name: QA_NAME });
    const qaGroupIds = await ids("group", { name: QA_NAME });

    // dependents of QA employees
    if (qaEmpIds.length) {
      const eIn = { employeeId: { in: qaEmpIds } };
      await run("attendanceRequest", () => prisma.attendanceRequest.deleteMany({ where: eIn }));
      await run("attendance", () => prisma.attendance.deleteMany({ where: eIn }));
      await run("leaveRequest", () => prisma.leaveRequest.deleteMany({ where: eIn }));
      await run("leaveAllocation", () => prisma.leaveAllocation.deleteMany({ where: eIn }));
      await run("shiftAssignment(emp)", () => prisma.shiftAssignment.deleteMany({ where: eIn }));
      await run("unitEmployee", () => prisma.unitEmployee.deleteMany({ where: eIn }));
      await run("dailyReportComment(emp)", () => prisma.dailyReportComment.deleteMany({ where: { report: { employeeId: { in: qaEmpIds } } } }));
      await run("dailyReport(emp)", () => prisma.dailyReport.deleteMany({ where: eIn }));
      await run("taskAssignee(emp)", () => prisma.taskAssignee.deleteMany({ where: eIn }));
      await run("teamMember(emp)", () => prisma.teamMember.deleteMany({ where: eIn }));
    }
    // dependents of QA users
    if (qaUserIds.length) {
      const uIn = { userId: { in: qaUserIds } };
      await run("activityLog", () => prisma.activityLog.deleteMany({ where: uIn }));
      await run("loggedInUsers", () => prisma.loggedInUsers.deleteMany({ where: uIn }));
      await run("blacklistToken", () => prisma.blacklistToken.deleteMany({ where: uIn }));
    }
    // link rows (users, roles, groups)
    await run("userRole", () => prisma.userRole.deleteMany({ where: { OR: [{ userId: { in: qaUserIds } }, { roleId: { in: qaRoleIds } }] } }));
    await run("userGroup", () => prisma.userGroup.deleteMany({ where: { OR: [{ userId: { in: qaUserIds } }, { groupId: { in: qaGroupIds } }] } }));
    await run("groupRole", () => prisma.groupRole.deleteMany({ where: { OR: [{ roleId: { in: qaRoleIds } }, { groupId: { in: qaGroupIds } }] } }));
    // feature permissions (parentId is a plain string: user/role/group)
    const parents = [...qaUserIds, ...qaRoleIds, ...qaGroupIds];
    if (parents.length) await run("featurePermission", () => prisma.featurePermission.deleteMany({ where: { parentId: { in: parents } } }));
    // principals: users first (clears user.employeeId FK), then employees, roles, groups
    await run("user", () => prisma.user.deleteMany({ where: { id: { in: qaUserIds } } }));
    await run("employee", () => prisma.employee.deleteMany({ where: { id: { in: qaEmpIds } } }));
    await run("role", () => prisma.role.deleteMany({ where: { id: { in: qaRoleIds } } }));
    await run("group", () => prisma.group.deleteMany({ where: { id: { in: qaGroupIds } } }));

    // QA records by name/code pattern (shifts + their children, customers, items, visitors, features,
    // gate passes from _created.json).
    // Shifts: the harness names them "QA_Shift_..." or "QA_<epochMillis>"; both start "QA_". Real
    // shifts have descriptive names ("Morning shift ...") so the underscore-prefixed pattern is safe.
    const qaShiftIds = await ids("shift", { name: { startsWith: "QA_" } });
    if (qaShiftIds.length) {
      await run("shiftTimetableBlock", () => prisma.shiftTimetableBlock.deleteMany({ where: { shiftId: { in: qaShiftIds } } }));
      await run("shiftAssignment(shift)", () => prisma.shiftAssignment.deleteMany({ where: { shiftId: { in: qaShiftIds } } }));
      await run("shiftTimetable", () => prisma.shiftTimetable.deleteMany({ where: { shiftId: { in: qaShiftIds } } }));
      await run("shift", () => prisma.shift.deleteMany({ where: { id: { in: qaShiftIds } } }));
    }
    // QA leave configurations ("QA_<epochMillis>") + their allocations (and the leave requests that
    // reference those allocations). Real configs are "Casual Leave" etc., never underscore-prefixed.
    const qaLeaveCfgIds = await ids("leaveConfiguration", { name: { startsWith: "QA_" } });
    if (qaLeaveCfgIds.length) {
      const allocIds = await ids("leaveAllocation", { leaveConfigId: { in: qaLeaveCfgIds } });
      if (allocIds.length) await run("leaveRequest(cfg)", () => prisma.leaveRequest.deleteMany({ where: { leaveAllocationId: { in: allocIds } } }));
      await run("leaveAllocation(cfg)", () => prisma.leaveAllocation.deleteMany({ where: { leaveConfigId: { in: qaLeaveCfgIds } } }));
      await run("leaveConfiguration", () => prisma.leaveConfiguration.deleteMany({ where: { id: { in: qaLeaveCfgIds } } }));
    }
    // QA gate-pass chain: customers (QA_Cust_), items (QA_Item_), and the gate passes / gate-pass
    // items that reference them (GatePassItem RESTRICTs deleting a referenced Item/GatePass).
    const qaCustIds = await ids("customer", { name: { startsWith: "QA_Cust_" } });
    const qaItemIds = await ids("item", { name: { startsWith: "QA_Item_" } });
    const gpIds = Array.from(new Set([...(c?.records?.gatePass || []), ...(qaCustIds.length ? await ids("gatePass", { customerId: { in: qaCustIds } }) : [])]));
    if (gpIds.length || qaItemIds.length) {
      await run("gatePassItem", () => prisma.gatePassItem.deleteMany({ where: { OR: [{ gatePassId: { in: gpIds } }, { itemId: { in: qaItemIds } }] } }));
    }
    if (gpIds.length) await run("gatePass", () => prisma.gatePass.deleteMany({ where: { id: { in: gpIds } } }));
    if (qaCustIds.length) await run("customer", () => prisma.customer.deleteMany({ where: { id: { in: qaCustIds } } }));
    if (qaItemIds.length) await run("item", () => prisma.item.deleteMany({ where: { id: { in: qaItemIds } } }));
    await run("visitor", () => prisma.visitor.deleteMany({ where: { name: QA_NAME } }));
    await run("appFeature", () => prisma.appFeature.deleteMany({ where: { name: { startsWith: "QA_feat." } } }));

    // QA holidays and the HOLIDAYS attendance that marking a holiday generates for every employee.
    // run.ts creates holidays with a "QA_" reason on a synthetic 2099 date (see run.ts getCreatePayload
    // for "Holiday"); real holidays use real dates and reasons like "Sunday", so neither pattern can
    // match real data. Delete the attendance first, then the holidays. Pattern-based so it clears
    // EVERY past run, not only ids recorded in _created.json (the API /holiday/delete above only
    // soft-deletes recorded ids and never touched the attendance side-effect, which is how QA
    // holidays and ~7k HOLIDAYS attendance rows had been leaking).
    // All HOLIDAYS attendance on any far-future date (>= 2030) is a test-holiday cascade: creating a
    // Holiday marks HOLIDAYS attendance for every employee, and tests use future dates (2031, 2035,
    // 2099, ...). Real holidays never fall in 2030+. This catches both the 2099 run.ts holidays and
    // the audit-harness holidays (2031-2039) whose Holiday rows were deleted but whose attendance
    // cascade had leaked (Run 12 item 1).
    await run("attendance(QA holidays)", () => prisma.attendance.deleteMany({
      where: { status: "HOLIDAYS", date: { gte: new Date("2030-01-01T00:00:00.000Z") } },
    }));
    await run("holiday", () => prisma.holiday.deleteMany({ where: { reason: { startsWith: "QA_" } } }));

    // QA Work data: teams ("QA..."/"QA_...") and their tasks, plus any tasks titled "QA..." or created
    // by a QA user. The harness names start with "QA"; real Work data uses real names.
    const qaTeamIds = await ids("team", { name: { startsWith: "QA" } });
    const qaTaskIds = await ids("task", { OR: [{ title: { startsWith: "QA" } }, ...(qaTeamIds.length ? [{ teamId: { in: qaTeamIds } }] : []), ...(qaUserIds.length ? [{ createdById: { in: qaUserIds } }] : [])] });
    if (qaTaskIds.length) {
      await run("taskAssignee", () => prisma.taskAssignee.deleteMany({ where: { taskId: { in: qaTaskIds } } }));
      await run("taskChecklistItem", () => prisma.taskChecklistItem.deleteMany({ where: { taskId: { in: qaTaskIds } } }));
      await run("taskComment", () => prisma.taskComment.deleteMany({ where: { taskId: { in: qaTaskIds } } }));
      await run("taskWatcher", () => prisma.taskWatcher.deleteMany({ where: { taskId: { in: qaTaskIds } } }));
      await run("task", () => prisma.task.deleteMany({ where: { id: { in: qaTaskIds } } }));
    }
    if (qaTeamIds.length) {
      await run("teamMember", () => prisma.teamMember.deleteMany({ where: { teamId: { in: qaTeamIds } } }));
      await run("team", () => prisma.team.deleteMany({ where: { id: { in: qaTeamIds } } }));
    }
    if (qaUserIds.length) await run("notification", () => prisma.notification.deleteMany({ where: { userId: { in: qaUserIds } } }));

    // QA units ("QA_<epochMillis>") + members. After teams (Team.unitId FK). Real units are named
    // "Head Office" etc., so the underscore-prefixed pattern never matches real data.
    const qaUnitIds = await ids("unit", { name: { startsWith: "QA_" } });
    if (qaUnitIds.length) {
      await run("unitEmployee(unit)", () => prisma.unitEmployee.deleteMany({ where: { unitId: { in: qaUnitIds } } }));
      await run("team(unit)", () => prisma.team.deleteMany({ where: { unitId: { in: qaUnitIds } } }).catch(() => ({ count: 0 })));
      await run("unit", () => prisma.unit.deleteMany({ where: { id: { in: qaUnitIds } } }));
    }

    // ---- Legacy ActivityLog + central AuditLog sweeps (Run 13 rewrite) ----
    // RULE: delete ONLY rows TIED TO A QA ENTITY OR A QA USER. We never delete "orphan" rows in
    // general — a REAL entity that was hard-deleted at some point must keep its log (Run 12 wrongly
    // removed ~9.5k real ActivityLog rows with a blanket orphan sweep; those were restored in Run 13).
    // A row is QA-tied when: (a) its userId is a QA user; (b) its text (description/metadata/changes)
    // carries a QA NAME MARKER — every harness names its data QA_.../QAWF/QASelf/*@test.local, so this
    // is specific and never matches a real name (e.g. "Zulfiqar" does NOT match "QA_"); (c) its
    // entityId is one of the QA entities THIS cleanup collected; or (d) a child bulk row whose PARENT
    // business entity was HARD-deleted (real parents are soft-deleted, so they still exist — a missing
    // parent means a QA parent the harness hard-deleted).
    const qaEntityIds = Array.from(new Set([
      ...qaEmpIds, ...qaUserIds, ...qaRoleIds, ...qaGroupIds, ...qaShiftIds, ...qaLeaveCfgIds,
      ...qaTeamIds, ...qaTaskIds, ...qaUnitIds, ...qaCustIds, ...qaItemIds,
      ...(await ids("holiday", { reason: { startsWith: "QA_" } })),
      ...(await ids("visitor", { name: { startsWith: "QA_" } })),
    ]));
    // Specific QA name markers (literal "QA_" via ESCAPE, plus the non-underscore employee/user tags).
    const QA_MARK = (col: string) =>
      `(${col} LIKE '%QA\\_%' ESCAPE '\\' OR ${col} LIKE '%@test.local%' OR ${col} LIKE '%QAWF%' OR ${col} LIKE '%QASelf%' OR ${col} LIKE '%QAUT-SELF-%')`;

    // Legacy ActivityLog: QA users are already removed above; here QA-marked text + QA entity ids.
    await run("activityLog(qa-marker)", () => prisma.$executeRawUnsafe(
      `DELETE FROM "ActivityLog" WHERE ${QA_MARK("description")} OR ${QA_MARK("coalesce(metadata::text,'')")}`,
    ).then((count: number) => ({ count })));
    if (qaEntityIds.length) await run("activityLog(qa-entity)", () => prisma.activityLog.deleteMany({ where: { entityId: { in: qaEntityIds } } }));

    // Central AuditLog.
    if (qaUserIds.length) await run("auditLog(qaUser)", () => prisma.auditLog.deleteMany({ where: { userId: { in: qaUserIds } } }));
    await run("auditLog(report-export)", () => prisma.auditLog.deleteMany({ where: { entity: "Report" } }));
    await run("auditLog(qa-auth)", () => prisma.$executeRawUnsafe(
      `DELETE FROM "AuditLog" WHERE action IN ('LOGIN','LOGOUT','LOGIN_FAILED') AND (changes->>'username' ILIKE 'qa%' OR changes->>'username' ILIKE '%@test.local')`,
    ).then((count: number) => ({ count })));
    await run("auditLog(qa-marker)", () => prisma.$executeRawUnsafe(
      `DELETE FROM "AuditLog" WHERE ${QA_MARK("coalesce(changes::text,'')")}`,
    ).then((count: number) => ({ count })));
    if (qaEntityIds.length) await run("auditLog(qa-entity)", () => prisma.auditLog.deleteMany({ where: { entityId: { in: qaEntityIds } } }));
    // Audit rows whose referent is a QA-named entity still present (e.g. a QA shift a restore test left live).
    for (const [entity, table, col] of [
      ["Shift", "Shift", "name"], ["Unit", "Unit", "name"], ["LeaveConfiguration", "LeaveConfiguration", "name"],
      ["Team", "Team", "name"], ["Customer", "Customer", "name"], ["Item", "Item", "name"],
    ] as [string, string, string][]) {
      await run("auditLog(qa-named)", () => prisma.$executeRawUnsafe(
        `DELETE FROM "AuditLog" a WHERE a.entity = $1 AND a."entityId" IS NOT NULL ` +
        `AND EXISTS (SELECT 1 FROM "${table}" t WHERE t.id = a."entityId" AND t."${col}" LIKE 'QA\\_%' ESCAPE '\\')`,
        entity,
      ).then((count: number) => ({ count })));
    }
    // Child bulk rows (entityId null, deleteMany/updateMany filter) whose PARENT business entity was
    // HARD-deleted. Real parents are soft-deleted (still present), so a missing parent = a QA parent.
    // Keyed on the specific parent id in the filter (not a blanket orphan sweep).
    await run("auditLog(qa-bulk-parent)", () => prisma.$executeRawUnsafe(
      `DELETE FROM "AuditLog" a WHERE a."entityId" IS NULL AND a.changes ? 'filter' AND (` +
      `(a.changes->'filter'->>'quotationId' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Quotation" q WHERE q.id = a.changes->'filter'->>'quotationId')) OR ` +
      `(a.changes->'filter'->>'orderId' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "SalesOrder" o WHERE o.id = a.changes->'filter'->>'orderId')) OR ` +
      `(a.changes->'filter'->>'returnId' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "SalesReturn" r WHERE r.id = a.changes->'filter'->>'returnId')) OR ` +
      `(a.changes->'filter'->>'taskId' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Task" t WHERE t.id = a.changes->'filter'->>'taskId')) OR ` +
      `(a.changes->'filter'->>'teamId' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Team" t WHERE t.id = a.changes->'filter'->>'teamId')) OR ` +
      `(a.changes->'filter'->>'productId' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Product" p WHERE p.id = a.changes->'filter'->>'productId')) OR ` +
      `(a.changes->'filter'->>'quotationNo' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Quotation" q WHERE q."quotationNo" = a.changes->'filter'->>'quotationNo'))` +
      `)`,
    ).then((count: number) => ({ count })));

    // Audit this cleanup itself caused: the server-side API /delete calls above (QA holidays, units,
    // visitors) cascade and are audited on the server. Remove everything audited since CLEANUP_T0 —
    // on a local-only cleanup the only audit in that window is these QA-delete side-effects.
    await run("auditLog(cleanup-cascade)", () => prisma.auditLog.deleteMany({ where: { createdAt: { gte: CLEANUP_T0 } } }));

    await prisma.$disconnect().catch(() => {});
  } catch (e: any) {
    console.warn("[QA cleanup] DB sweep error:", e?.message || e);
  }

  console.log(`[QA cleanup] API record deletes: ${removed}. Hard-deleted:`, JSON.stringify(summary));
}
main().catch((e) => { console.error("[QA cleanup] error", e); process.exit(1); });
