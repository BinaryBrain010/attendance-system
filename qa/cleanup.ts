/**
 * QA cleanup.  npm run qa:cleanup
 * Removes everything the harness created: records (visitor/holiday/unit/shift/leaveConf/feature),
 * link rows, feature-permissions, users, roles, groups — by id from _created.json, plus a
 * safety sweep that deletes any leftover QA-tagged users/roles/groups by name pattern.
 * Local-only (lib.ts refuses non-localhost).
 */
import fs from "fs";
import path from "path";
import { api, http, mintGodToken } from "./lib";

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

  if (c) {
    // records first (depend on nothing)
    for (const id of c.records?.visitor || []) await del("/visitor", id);
    for (const id of c.records?.holiday || []) await del("/holiday", id);
    for (const id of c.records?.unit || []) await del("/unit", id);
    for (const id of c.records?.shift || []) await del("/shift", id);
    for (const id of c.records?.leaveconf || c.records?.leaveConf || []) await del("/leave/leave-configurations", id);
    for (const name of c.records?.feature || []) await del("/appFeature", name);
    // links (hard delete)
    for (const id of c.userRole || []) await del("/userRole", id);
    for (const id of c.userGroup || []) await del("/userGroup", id);
    for (const id of c.groupRole || []) await del("/groupRole", id);
    // feature permissions
    for (const id of c.featurePerms || []) await del("/featurePermission", id);
    // users, roles, groups
    for (const u of c.users || []) await del("/user", u.id);
    for (const r of c.roles || []) await del("/role", r.id);
    for (const g of c.groups || []) await del("/group", g.id);
  }

  // safety sweep by name pattern
  const users = await api("GET", "/user/get", GOD);
  const uarr = Array.isArray(users.data?.data) ? users.data.data : (Array.isArray(users.data) ? users.data : []);
  for (const u of uarr) if (typeof u.username === "string" && /^qa\..*@test\.local$/.test(u.username)) await del("/user", u.id);
  const roles = await api("GET", "/role/get", GOD);
  const rarr = Array.isArray(roles.data?.data) ? roles.data.data : (Array.isArray(roles.data) ? roles.data : []);
  for (const r of rarr) if (typeof r.name === "string" && r.name.startsWith("QA_")) await del("/role", r.id);
  const groups = await api("GET", "/group/get", GOD);
  const garr = Array.isArray(groups.data?.data) ? groups.data.data : (Array.isArray(groups.data) ? groups.data : []);
  for (const g of garr) if (typeof g.name === "string" && g.name.startsWith("QA_")) await del("/group", g.id);

  // Direct local-DB sweep for things the API cannot cleanly remove (AppFeature delete is broken;
  // workflow records have dependents / touch real tables). lib.ts guarantees local-only.
  let featSwept = 0, wfSwept = 0;
  try {
    const prisma = require("../src/core/models/base.model").default;
    // per-statement try/catch so one FK error does not abort the rest of the sweep
    const q = async (sql: any) => { try { const r = await prisma.$executeRaw(sql); return typeof r === "number" ? r : 0; } catch (e: any) { console.warn("[QA cleanup] sweep stmt skipped:", (e?.message || e).split("\n")[0]); return 0; } };
    const { Prisma } = require("@prisma/client");

    featSwept = await q(Prisma.sql`DELETE FROM public."AppFeature" WHERE "name" LIKE 'QA\_feat.%' ESCAPE '\'`);

    const empIds: string[] = (c?.records?.wfEmployee || []);
    const gpIds: string[] = (c?.records?.gatePass || []);
    const custIds: string[] = (c?.records?.customer || []);
    const itemIds: string[] = (c?.records?.item || []);

    if (gpIds.length) {
      await q(Prisma.sql`DELETE FROM public."GatePassItem" WHERE "gatePassId" IN (${Prisma.join(gpIds)})`);
      wfSwept += await q(Prisma.sql`DELETE FROM public."GatePass" WHERE "id" IN (${Prisma.join(gpIds)})`);
    }
    if (empIds.length) {
      await q(Prisma.sql`DELETE FROM public."Attendance" WHERE "employeeId" IN (${Prisma.join(empIds)})`);
      await q(Prisma.sql`DELETE FROM public."AttendanceRequest" WHERE "employeeId" IN (${Prisma.join(empIds)})`);
      await q(Prisma.sql`DELETE FROM public."LeaveRequest" WHERE "employeeId" IN (${Prisma.join(empIds)})`);
      await q(Prisma.sql`DELETE FROM public."LeaveAllocation" WHERE "employeeId" IN (${Prisma.join(empIds)})`);
      await q(Prisma.sql`DELETE FROM public."ShiftAssignment" WHERE "employeeId" IN (${Prisma.join(empIds)})`);
      wfSwept += await q(Prisma.sql`DELETE FROM public."Employee" WHERE "id" IN (${Prisma.join(empIds)})`);
    }
    // QA shifts/customers/items (by id if tracked, plus a name-pattern safety net)
    // QA shifts and their children (ShiftAssignment, ShiftTimetable reference Shift). Delete
    // children first, keyed by the QA shift name pattern, then the shifts themselves.
    await q(Prisma.sql`DELETE FROM public."ShiftAssignment" WHERE "shiftId" IN (SELECT "id" FROM public."Shift" WHERE "name" LIKE 'QA\_Shift\_%' ESCAPE '\')`);
    await q(Prisma.sql`DELETE FROM public."ShiftTimetable" WHERE "shiftId" IN (SELECT "id" FROM public."Shift" WHERE "name" LIKE 'QA\_Shift\_%' ESCAPE '\')`);
    wfSwept += await q(Prisma.sql`DELETE FROM public."Shift" WHERE "name" LIKE 'QA\_Shift\_%' ESCAPE '\'`);
    if (custIds.length) await q(Prisma.sql`DELETE FROM public."Customer" WHERE "id" IN (${Prisma.join(custIds)})`);
    await q(Prisma.sql`DELETE FROM public."Customer" WHERE "name" LIKE 'QA\_Cust\_%' ESCAPE '\'`);
    if (itemIds.length) await q(Prisma.sql`DELETE FROM public."Item" WHERE "id" IN (${Prisma.join(itemIds)})`);
    await q(Prisma.sql`DELETE FROM public."Item" WHERE "name" LIKE 'QA\_Item\_%' ESCAPE '\'`);
    // QA workflow employee safety net by code
    await q(Prisma.sql`DELETE FROM public."Employee" WHERE "code" LIKE 'QAWF-%'`);
    // QA visitors created by the security/multi-user/CRUD tests (names start with QA_)
    wfSwept += await q(Prisma.sql`DELETE FROM public."Visitor" WHERE "name" LIKE 'QA\_%' ESCAPE '\'`);

    await prisma.$disconnect();
  } catch (e: any) {
    console.warn("[QA cleanup] DB sweep skipped:", e?.message || e);
  }

  console.log(`[QA cleanup] delete calls succeeded: ${removed}. QA features removed: ${featSwept}. Workflow rows removed: ${wfSwept}. Safety sweep done.`);
}
main().catch((e) => { console.error("[QA cleanup] error", e); process.exit(1); });
