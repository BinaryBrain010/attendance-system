/**
 * HOTFIX 2026-10-23 — AMS unit-scoping model verification (QA_ data only, self-cleaning).
 *
 * Proves the exact rule the client asked for, end to end through the real resolver that every
 * Quick-Mark endpoint uses (getAccessibleEmployeeIds / canAccessEmployee):
 *   1. A manager/member of unit A sees ONLY unit A's employees (incl. self), never unit B's.
 *   2. canAccessEmployee(manager, <unit-B employee>) === false  (this is what makes detail/mark 403).
 *   3. A holder of ams.viewAll.unit.* sees EVERYONE (resolver returns null = no filter).
 *   4. A user with a linked employee but NO unit sees ONLY THEMSELVES (never "all").
 *
 * Creates QA_ units/employees/users + memberships + grants, asserts, then deletes all of it.
 * Run:  npx ts-node qa/amsUnitScope.ts
 */
import prisma from "../src/core/models/base.model";
import { LeaveStatus } from "@prisma/client";
import {
  getAccessibleEmployeeIds,
  canAccessEmployee,
} from "../src/modules/AMS/Unit/helper/unitAccess.helper";
import leaveReqModel from "../src/modules/AMS/Leaves/models/leaveReq.model";

const TAG = `QA_SCOPE_${Date.now()}`;
let pass = 0, fail = 0;
function check(label: string, ok: boolean, detail = "") {
  (ok ? pass++ : fail++);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
}

async function mkEmployee(suffix: string) {
  return prisma.employee.create({
    data: {
      name: "QAScope", surname: suffix, address: "QA", dob: new Date("1990-01-01"),
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
  const createdUserIds: string[] = [];
  const createdFpIds: string[] = [];
  const createdUeIds: string[] = [];
  const createdEmpIds: string[] = [];
  const createdUnitIds: string[] = [];
  const createdLeaveIds: string[] = [];
  try {
    // Units A and B
    const unitA = await prisma.unit.create({ data: { name: `${TAG}_UNIT_A`, type: "OFFICE" } as any });
    const unitB = await prisma.unit.create({ data: { name: `${TAG}_UNIT_B`, type: "OFFICE" } as any });
    createdUnitIds.push(unitA.id, unitB.id);

    // Employees: empA + empMgr in A, empB in B, empNone with no unit
    const empA = await mkEmployee("empA");
    const empMgr = await mkEmployee("empMgr");
    const empB = await mkEmployee("empB");
    const empNone = await mkEmployee("empNone");
    createdEmpIds.push(empA.id, empMgr.id, empB.id, empNone.id);

    // Memberships
    for (const [uId, eId] of [[unitA.id, empA.id], [unitA.id, empMgr.id], [unitB.id, empB.id]] as const) {
      const ue = await prisma.unitEmployee.create({ data: { unitId: uId, employeeId: eId } as any });
      createdUeIds.push(ue.id);
    }

    // Users: manager (linked to empMgr, no viewAll), viewAll holder, no-unit (linked to empNone)
    const uMgr = await prisma.user.create({ data: { username: `${TAG}.mgr@test.local`, password: "x", employeeId: empMgr.id } as any });
    const uView = await prisma.user.create({ data: { username: `${TAG}.view@test.local`, password: "x", employeeId: empA.id } as any });
    const uNone = await prisma.user.create({ data: { username: `${TAG}.none@test.local`, password: "x", employeeId: empNone.id } as any });
    createdUserIds.push(uMgr.id, uView.id, uNone.id);
    createdFpIds.push((await grant(uMgr.id, ["login.admin.*", "employee.read.*", "attendance.read.*"])).id);
    createdFpIds.push((await grant(uView.id, ["login.admin.*", "employee.read.*", "ams.viewAll.unit.*"])).id);
    createdFpIds.push((await grant(uNone.id, ["login.admin.*", "employee.read.*"])).id);

    // 1. Manager of A sees ONLY unit A employees (empA + empMgr), not empB.
    const mgrScope = await getAccessibleEmployeeIds(uMgr.id);
    const mgrSet = new Set(mgrScope ?? []);
    check("manager scope is a bounded set (not null)", mgrScope !== null, `len=${mgrScope?.length}`);
    check("manager sees empA (unit A)", mgrSet.has(empA.id));
    check("manager sees self empMgr (unit A)", mgrSet.has(empMgr.id));
    check("manager does NOT see empB (unit B)", !mgrSet.has(empB.id));

    // 2. canAccessEmployee gates detail/mark/approve (basis for the 403).
    check("canAccessEmployee(manager, empA) === true", (await canAccessEmployee(uMgr.id, empA.id)) === true);
    check("canAccessEmployee(manager, empB) === false (=> 403)", (await canAccessEmployee(uMgr.id, empB.id)) === false);

    // 3. viewAll holder sees everyone (resolver returns null = no filter).
    const viewScope = await getAccessibleEmployeeIds(uView.id);
    check("viewAll holder scope === null (sees all)", viewScope === null);
    check("canAccessEmployee(viewAll, empB) === true", (await canAccessEmployee(uView.id, empB.id)) === true);

    // 4. Linked employee, NO unit => only self.
    const noneScope = await getAccessibleEmployeeIds(uNone.id);
    check("no-unit user sees exactly 1 employee", (noneScope?.length ?? -1) === 1, `len=${noneScope?.length}`);
    check("no-unit user sees ONLY self", !!noneScope && noneScope[0] === empNone.id);
    check("no-unit user does NOT see empA", !(noneScope ?? []).includes(empA.id));

    // 5. Leave approve/reject is unit-gated (model gpUpdateStatus guard). Manager of A may NOT
    //    approve empB's (unit B) leave; the viewAll holder may reject it.
    const lr = await prisma.leaveRequest.create({
      data: { employeeId: empB.id, startDate: new Date("2099-05-01"), endDate: new Date("2099-05-02"), status: "PENDING" } as any,
    });
    createdLeaveIds.push(lr.id);
    let blocked = false;
    try {
      await (leaveReqModel as any).leaveRequest.gpUpdateStatus(lr.id, LeaveStatus.APPROVED, uMgr.id);
    } catch (e: any) {
      blocked = e?.statusCode === 403 || /outside your units/i.test(e?.message || "");
    }
    check("manager CANNOT approve unit-B leave (403)", blocked);
    const stillPending = await prisma.leaveRequest.findUnique({ where: { id: lr.id }, select: { status: true } });
    check("unit-B leave stays PENDING after blocked approve", stillPending?.status === "PENDING");
    let viewOk = true;
    try {
      await (leaveReqModel as any).leaveRequest.gpUpdateStatus(lr.id, LeaveStatus.REJECTED, uView.id);
    } catch { viewOk = false; }
    const afterView = await prisma.leaveRequest.findUnique({ where: { id: lr.id }, select: { status: true } });
    check("viewAll holder CAN reject unit-B leave", viewOk && afterView?.status === "REJECTED");
  } finally {
    // Cleanup (children first)
    for (const id of createdLeaveIds) await prisma.leaveRequest.delete({ where: { id } }).catch(() => {});
    for (const id of createdFpIds) await prisma.featurePermission.delete({ where: { id } }).catch(() => {});
    for (const id of createdUeIds) await prisma.unitEmployee.delete({ where: { id } }).catch(() => {});
    for (const id of createdUserIds) await prisma.user.delete({ where: { id } }).catch(() => {});
    for (const id of createdEmpIds) await prisma.employee.delete({ where: { id } }).catch(() => {});
    for (const id of createdUnitIds) await prisma.unit.delete({ where: { id } }).catch(() => {});
  }

  console.log(`\n[amsUnitScope] ${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
