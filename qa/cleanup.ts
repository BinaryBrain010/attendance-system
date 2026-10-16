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
    const qaShiftIds = await ids("shift", { name: { startsWith: "QA_Shift_" } });
    if (qaShiftIds.length) {
      await run("shiftAssignment(shift)", () => prisma.shiftAssignment.deleteMany({ where: { shiftId: { in: qaShiftIds } } }));
      await run("shiftTimetable", () => prisma.shiftTimetable.deleteMany({ where: { shiftId: { in: qaShiftIds } } }));
      await run("shift", () => prisma.shift.deleteMany({ where: { id: { in: qaShiftIds } } }));
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
    await run("attendance(QA holidays)", () => prisma.attendance.deleteMany({
      where: { status: "HOLIDAYS", date: { gte: new Date("2099-01-01T00:00:00.000Z"), lt: new Date("2100-01-01T00:00:00.000Z") } },
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

    // AuditLog residue (Run 11). Rows attributed to QA users; the harness report-export rows
    // (entity "Report"); and orphaned rows whose business row was hard-deleted above (real entities
    // are soft-deleted so they still exist and their audit rows are kept). NOT EXISTS is evaluated in
    // the DB so no id lists are pulled into node.
    if (qaUserIds.length) await run("auditLog(qaUser)", () => prisma.auditLog.deleteMany({ where: { userId: { in: qaUserIds } } }));
    await run("auditLog(report-export)", () => prisma.auditLog.deleteMany({ where: { entity: "Report" } }));
    // QA auth events (failed/success logins from tests using qa* or *@test.local usernames).
    await run("auditLog(qa-auth)", () => prisma.$executeRawUnsafe(
      `DELETE FROM "AuditLog" WHERE action IN ('LOGIN','LOGOUT','LOGIN_FAILED') AND (changes->>'username' ILIKE 'qa%' OR changes->>'username' ILIKE '%@test.local')`,
    ).then((count: number) => ({ count })));
    const AUDIT_ENTITIES = [
      "Customer", "Item", "GatePass", "User", "Group", "Role", "FeaturePermission", "Employee",
      "Attendance", "LeaveRequest", "AttendanceRequest", "LeaveConfiguration", "LeaveAllocation",
      "Shift", "ShiftAssignment", "Team", "Task", "DailyReport", "Holiday", "Unit", "Visitor",
      "Category", "Brand", "Product", "PriceList", "Bundle", "SalesAgent", "Lead", "LeadActivity",
      "Quotation", "QuotationItem", "SalesOrder", "SalesOrderItem", "SalesReturn", "ReturnItem",
      "TaskComment", "DailyReportComment",
      "UserRole", "GroupRole", "UserGroup", "TeamMember", "TaskAssignee", "TaskWatcher",
      "UnitEmployee", "ShiftTimetable", "ShiftTimetableBlock",
    ]; // NB: AppFeature keyed by name (no id col), so its audit rows are entityId-null -> bulk-child.
    // An audit row is residue when its referent is gone OR soft-deleted (the harness soft-deletes
    // some config entities rather than hard-deleting). qa:cleanup is local-only, so removing audit
    // for a soft-deleted referent here never touches a prod trail.
    const NO_SOFT_DELETE = new Set(["TaskAssignee", "TaskWatcher"]); // these lack an isDeleted column
    for (const entity of AUDIT_ENTITIES) {
      await run(`auditLog(orphan)`, async () => {
        const cond = NO_SOFT_DELETE.has(entity)
          ? `NOT EXISTS (SELECT 1 FROM "${entity}" t WHERE t.id = a."entityId")`
          : `NOT EXISTS (SELECT 1 FROM "${entity}" t WHERE t.id = a."entityId" AND t."isDeleted" IS NULL)`;
        const n: number = await prisma.$executeRawUnsafe(
          `DELETE FROM "AuditLog" a WHERE a.entity = $1 AND a."entityId" IS NOT NULL AND ${cond}`,
          entity,
        );
        return { count: n };
      });
    }
    // Bulk-op audit rows (entityId null, filter+count) for child/join entities: these are always part
    // of a parent operation and carry no standalone audit value, so harness churn leaves them behind.
    // qa:cleanup is local-only (lib refuses a non-local DB), so this never touches a prod audit trail.
    await run("auditLog(bulk-child)", () => prisma.auditLog.deleteMany({
      where: { entityId: null, entity: { in: [
        "TeamMember", "TaskAssignee", "TaskWatcher", "TaskChecklistItem", "QuotationItem",
        "SalesOrderItem", "ReturnItem", "UserRole", "GroupRole", "UserGroup", "FeaturePermission",
        "UnitEmployee", "BundleItem", "ProductVariant", "ProductImage",
        // Churn entities the harness bulk-writes (createMany/updateMany). On a local QA DB these
        // bulk-op rows are always harness activity; qa:cleanup is local-only.
        "Attendance", "AppFeature", "ShiftTimetable", "ShiftTimetableBlock", "ShiftAssignment",
        "Holiday", "Unit", "LeaveConfiguration", "LeaveAllocation", "Shift", "GatePass",
        "Customer", "Item", "PriceList",
      ] } },
    }));
    // Audit rows whose referent is a QA-named entity that the harness leaves live (e.g. a shift it
    // created/restored). Keyed on the record's own QA name so real records are never matched.
    for (const [entity, table, col] of [
      ["Shift", "Shift", "name"], ["Unit", "Unit", "name"], ["LeaveConfiguration", "LeaveConfiguration", "name"],
      ["Team", "Team", "name"], ["Customer", "Customer", "name"], ["Item", "Item", "name"],
    ] as [string, string, string][]) {
      await run("auditLog(qa-named)", () => prisma.$executeRawUnsafe(
        `DELETE FROM "AuditLog" a WHERE a.entity = $1 AND a."entityId" IS NOT NULL ` +
        `AND EXISTS (SELECT 1 FROM "${table}" t WHERE t.id = a."entityId" AND t."${col}" LIKE 'QA%')`,
        entity,
      ).then((count: number) => ({ count })));
    }
    // Bulk-op rows whose filter targets a now-deleted parent (QA price/quotation churn).
    await run("auditLog(bulk-orphan)", () => prisma.$executeRawUnsafe(
      `DELETE FROM "AuditLog" a WHERE a."entityId" IS NULL AND a.changes ? 'filter' AND (` +
      `(a.entity='PriceList' AND a.changes->'filter'->>'productId' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Product" p WHERE p.id = a.changes->'filter'->>'productId')) OR ` +
      `(a.entity='Quotation' AND a.changes->'filter'->>'quotationNo' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Quotation" q WHERE q."quotationNo" = a.changes->'filter'->>'quotationNo'))` +
      `)`,
    ).then((count: number) => ({ count })));

    await prisma.$disconnect().catch(() => {});
  } catch (e: any) {
    console.warn("[QA cleanup] DB sweep error:", e?.message || e);
  }

  console.log(`[QA cleanup] API record deletes: ${removed}. Hard-deleted:`, JSON.stringify(summary));
}
main().catch((e) => { console.error("[QA cleanup] error", e); process.exit(1); });
