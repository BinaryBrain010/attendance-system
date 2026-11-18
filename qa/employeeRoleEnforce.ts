/**
 * Employee-role enforce proof. Provisions a QA_ persona carrying ONLY the real "Employee" role (whose
 * single grant is login.admin.*) + the Employees group, mints its token, and — against the server
 * running with RBAC_ENFORCE=on — asserts the exact reach the client expects:
 *   200  on the /me self tabs + own-data endpoints, notifications, and the visitor-host endpoints.
 *   403  on the employee list, reports, the attendance list, CRM lists, and settings.
 * Also probes lead-participant detail (/lead/getById), which is FEATURE-gated — a pure Employee 403s
 * there under enforce; that gap is reported (not failed) so the runbook can decide whether to grant it.
 *
 *   RBAC_ENFORCE=on  (server)    npx ts-node qa/employeeRoleEnforce.ts   (results in qa/.emprole-last.txt)
 *
 * Self-cleaning (QA_ fixtures). READ-mostly: it only creates/removes its own QA_ persona.
 */
process.env.QA_KEEP_TEST_EMPLOYEES = "1";

import * as fs from "fs";
import prisma from "../src/core/models/base.model";
import { http, mintTokenFor } from "./lib";
import { purgeQaEmployees } from "./qaPurge";

const TAG = `QA_EMPROLE_${Date.now()}`;
let pass = 0, fail = 0;
const lines: string[] = [];
function out(s: string) { lines.push(s); try { process.stdout.write(s + "\n"); } catch { /* ignore */ } }
function check(label: string, ok: boolean, detail = "") { (ok ? pass++ : fail++); out(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`); }

async function main() {
  const role = await prisma.role.findFirst({ where: { name: "Employee", isDeleted: null } as any, select: { id: true } });
  const group = await prisma.group.findFirst({ where: { name: "Employees", isDeleted: null } as any, select: { id: true } });
  if (!role) { out("ERROR: 'Employee' role not found — seed it first (npm run seed / seed:employeeRole)."); fail++; }

  let empId = "", userId = "", token = "";
  try {
    const emp = await prisma.employee.create({ data: { name: "QAEmpRole", surname: "Persona", address: "QA", dob: new Date("1995-01-01"), joiningDate: new Date("2023-01-01"), bloodGroup: "O+", contactNo: "0300", designation: "Staff", department: "QA", martialStatus: "Single", company: "SOLARMAX", code: `${TAG}_P`, status: "ACTIVE" } as any });
    empId = emp.id;
    const user = await prisma.user.create({ data: { username: `${TAG}@test.local`, password: "x", employeeId: emp.id, mustChangePassword: false } as any });
    userId = user.id;
    if (role) await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, active: true } as any });
    if (group) await prisma.userGroup.create({ data: { userId: user.id, groupId: group.id, active: true } as any });
    token = mintTokenFor(user.id, []);

    // Another employee (for the "someone else" 403 checks) and an attendance request the persona OWNS.
    const other = await prisma.employee.create({ data: { name: "QAEmpRole", surname: "Other", address: "QA", dob: new Date("1995-01-01"), joiningDate: new Date("2023-01-01"), bloodGroup: "O+", contactNo: "0300", designation: "Staff", department: "QA", martialStatus: "Single", company: "SOLARMAX", code: `${TAG}_OTHER`, status: "ACTIVE" } as any });
    const otherId = other.id;
    const ownReq = await prisma.attendanceRequest.create({ data: { employeeId: emp.id, reason: "QA own request", status: "PENDING" } as any });
    const ownReqId = ownReq.id;
    // A persona that can READ gate passes (voucher.read.*) — to prove gate pass keeps working under
    // enforce AND that the capital-/GatePass case-insensitive mapping resolves.
    const gpUser = await prisma.user.create({ data: { username: `${TAG}.gp@test.local`, password: "x" } as any });
    await prisma.featurePermission.create({ data: { parentType: "User", parentId: gpUser.id, permissions: { allowedFeatures: ["login.admin.*", "voucher.read.*"] } as any, createdAt: new Date() } as any });
    const gpToken = mintTokenFor(gpUser.id, []);

    const B = { token } as const;
    // Confirm enforcement is actually ON: an unmapped-feature route must 403 for this persona. We use
    // the employee list as the canary; if it returns 200 the server is NOT enforcing — abort loudly.
    const canary = await http("GET", "/employee/get?page=1&pageSize=5", B);
    if (canary.status !== 403) {
      check("SERVER IS ENFORCING (employee list 403 for Employee persona)", false, `got ${canary.status} — is RBAC_ENFORCE=on? Aborting the 200/403 proof.`);
      return;
    }

    const expect = async (want: number, label: string, method: string, path: string, body?: any) => {
      const r = await http(method as any, path, { token, body });
      check(label, r.status === want, `want ${want}, got ${r.status}`);
      return r.status;
    };

    out("\n-- 200: /me self tabs + own-data, notifications, visitor-host --");
    await expect(200, "/user/me (profile)", "GET", "/user/me");
    await expect(200, "notifications list", "POST", "/notification/get", { page: 1, pageSize: 10 });
    await expect(200, "notifications unread count", "GET", "/notification/unreadCount");
    await expect(200, "my documents", "POST", "/employee/myFiles", {});
    await expect(200, "my salary slip", "POST", "/amsReport/mySlip", {});
    await expect(200, "my activity log", "GET", "/activityLog/me");
    await expect(200, "my employee record (getByUserId, own)", "POST", "/employee/getByUserId", { userId });
    await expect(200, "my attendance (getEmployeeAttendance, own)", "POST", "/attendance/getEmployeeAttendance", { employeeId: empId });
    await expect(200, "my leave requests (own)", "POST", "/leave/leave-requests/getEmployee", { employeeId: empId });
    await expect(200, "my probation status (own)", "POST", "/hrPolicy/probation/status", { employeeId: empId });
    await expect(200, "my personal attendance (analytics, own)", "GET", "/analytics/personalAttendance");
    await expect(200, "my leave summary (own)", "POST", "/amsReport/leaveSummary", { employeeId: empId });
    await expect(200, "visitor host: my visitors list", "GET", "/visitor/myVisitors?page=1&pageSize=10");

    out("\n-- 403: employee list, reports, attendance list, CRM lists, settings --");
    await expect(403, "employee list (GET /employee/get)", "GET", "/employee/get?page=1&pageSize=5");
    await expect(403, "AMS report (POST /amsReport/daily)", "POST", "/amsReport/daily", {});
    await expect(403, "CRM report dashboard (POST /crmReport/dashboard)", "POST", "/crmReport/dashboard", {});
    await expect(403, "attendance list (POST /attendance/get)", "POST", "/attendance/get", { page: 1, pageSize: 5 });
    await expect(403, "CRM lead list (POST /lead/get)", "POST", "/lead/get", { page: 1, pageSize: 5 });
    await expect(403, "CRM My Day (POST /lead/myDay)", "POST", "/lead/myDay", {});
    await expect(403, "settings (GET /systemConfig/get)", "GET", "/systemConfig/get");

    out("\n-- 200: own profile/files/shift/photo/own request (self-or-feature, owner derived server-side) --");
    await expect(200, "own profile (POST /employee/getById, own id)", "POST", "/employee/getById", { id: empId });
    await expect(200, "own documents (POST /employee/files, own)", "POST", "/employee/files", { employeeId: empId });
    await expect(200, "own shift assignments (own)", "POST", "/shift/assignmentsByEmployee", { employeeId: empId });
    await expect(200, "own attendance request (POST /attendanceReq/getById, own)", "POST", "/attendanceReq/getById", { id: ownReqId });
    await expect(200, "own leave overview (own)", "POST", "/leave/leave-requests/overviewByEmployee", { employeeId: empId });
    await expect(200, "own units (own)", "POST", "/unitEmployee/getUnitsByEmployeeId", { employeeId: empId });
    const photo = await http("GET", `/employee/photo?employeeId=${empId}`, B);
    check("own photo reachable (GET /employee/photo, token — not 403)", photo.status !== 403, `status ${photo.status}`);

    out("\n-- 403: another employee's record requires the feature --");
    await expect(403, "another employee's profile (getById, other id)", "POST", "/employee/getById", { id: otherId });
    await expect(403, "another employee's documents (files, other id)", "POST", "/employee/files", { employeeId: otherId });

    out("\n-- impersonate exit: any logged-in/low-privilege session (token) --");
    const exitRes = await http("POST", "/user/impersonate/exit", B);
    check("impersonate exit NOT blocked by the gate (token access)", exitRes.status !== 403, `status ${exitRes.status}`);

    out("\n-- gate pass read works under enforce + capital /GatePass maps (case-insensitive) --");
    const gpLower = await http("POST", "/gatePass/get", { token: gpToken, body: { page: 1, pageSize: 5 } });
    check("/gatePass/get -> 200 for a gatePass reader (voucher.read.*)", gpLower.status === 200, `status ${gpLower.status}`);
    const gpUpper = await http("POST", "/GatePass/get", { token: gpToken, body: { page: 1, pageSize: 5 } });
    check("/GatePass/get (capital) -> 200 too (case-insensitive featureMap lookup)", gpUpper.status === 200, `status ${gpUpper.status}`);

    out("\n-- gap probe (reported, not asserted): lead-participant detail is feature-gated --");
    const leadDetail = await http("POST", "/lead/getById", { token, body: { id: "00000000-0000-0000-0000-000000000000" } });
    out(`NOTE  POST /lead/getById -> ${leadDetail.status} (feature crm.lead.read.own.*). A mentioned Employee 403s at the gate under enforce; grant crm.lead.read.own.* to the Employee role if deep-linked lead participation must open for pure Employees (own-scope returns only their own leads, so no list leak).`);
  } finally {
    // The gate-pass persona has no employee, so sweep it (and any TAG user) by username first.
    const tagUsers = await prisma.user.findMany({ where: { username: { startsWith: TAG } }, select: { id: true } }).catch(() => [] as any[]);
    const tagUserIds = tagUsers.map((u) => u.id);
    if (tagUserIds.length) {
      await prisma.featurePermission.deleteMany({ where: { parentType: "User", parentId: { in: tagUserIds } } }).catch(() => {});
      await prisma.userRole.deleteMany({ where: { userId: { in: tagUserIds } } }).catch(() => {});
      await prisma.userGroup.deleteMany({ where: { userId: { in: tagUserIds } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: tagUserIds } } }).catch(() => {});
    }
    await purgeQaEmployees(prisma, "QA_EMPROLE_").catch(() => {});
  }

  out(`\n[employeeRoleEnforce] ${pass} passed, ${fail} failed`);
  try { fs.writeFileSync("qa/.emprole-last.txt", lines.join("\n") + "\n"); } catch { /* ignore */ }
  await prisma.$disconnect();
  process.exitCode = fail === 0 ? 0 : 1;
}
main().catch(async (e) => { out(`ERROR ${e?.stack || e?.message || e}`); try { fs.writeFileSync("qa/.emprole-last.txt", lines.join("\n") + "\nERROR\n"); } catch {} await prisma.$disconnect(); process.exitCode = 1; });
