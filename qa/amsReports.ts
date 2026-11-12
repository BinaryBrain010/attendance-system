/**
 * Quick Mark Reports QA (QA_ data only, self-cleaning). Covers:
 *   - Monthly Employee Report numbers for an employee with KNOWN attendance (present/late/half/absent/
 *     on-leave counts + total late minutes + leaves this month + entitlement + remaining).
 *   - Unit scoping: a unit-A user sees only unit-A employees; an ams.viewAll.unit user sees all.
 *
 *   npx ts-node qa/amsReports.ts   (results in qa/.amsreports-last.txt)
 */
import * as fs from "fs";
import prisma from "../src/core/models/base.model";
import { runWithContext } from "../src/core/context/requestContext";
import { GOD_ID } from "../src/modules/CRM/shared/access";
import AmsReportService from "../src/modules/AMS/Report/services/amsReport.service";
import HrPolicyService from "../src/modules/HR/Policy/services/hrPolicy.service";

const TAG = `QA_RPT_${Date.now()}`;
let pass = 0, fail = 0;
const lines: string[] = [];
function out(s: string) { lines.push(s); try { process.stdout.write(s + "\n"); } catch { /* ignore */ } }
function check(label: string, ok: boolean, detail = "") { (ok ? pass++ : fail++); out(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`); }

const YEAR = 2026, MONTH = 3; // March 2026

async function main() {
  const ids = { emps: [] as string[], units: [] as string[], ues: [] as string[], users: [] as string[], fps: [] as string[], att: [] as string[], shifts: [] as string[], sa: [] as string[], leaves: [] as string[], allocs: [] as string[] };
  const svc = new AmsReportService();

  async function mkEmp(suffix: string, joining: string) {
    const e = await prisma.employee.create({ data: { name: "QARpt", surname: suffix, address: "QA", dob: new Date("1990-01-01"), joiningDate: new Date(joining), bloodGroup: "O+", contactNo: "0300", designation: "Engineer", department: "QA-Dept", martialStatus: "Single", company: "SOLARMAX", code: `${TAG}_${suffix}`, status: "ACTIVE" } as any });
    ids.emps.push(e.id); return e;
  }
  async function att(employeeId: string, day: number, status: string, checkInHour?: number, checkInMin?: number) {
    const date = new Date(YEAR, MONTH - 1, day);
    const checkIn = checkInHour != null ? new Date(YEAR, MONTH - 1, day, checkInHour, checkInMin || 0) : null;
    const a = await prisma.attendance.create({ data: { employeeId, date, status: status as any, checkIn, checkOut: null } as any });
    ids.att.push(a.id);
  }

  try {
    await runWithContext({ userId: GOD_ID } as any, async () => {
      const unitA = await prisma.unit.create({ data: { name: `${TAG}_A`, type: "OFFICE" } as any });
      const unitB = await prisma.unit.create({ data: { name: `${TAG}_B`, type: "OFFICE" } as any });
      ids.units.push(unitA.id, unitB.id);

      const empA = await mkEmp("A", "2020-01-01"); // 6y service -> 3+ band -> 32 entitlement, medical
      const empMgr = await mkEmp("Mgr", "2021-01-01");
      const empB = await mkEmp("B", "2020-01-01");
      for (const [u, e] of [[unitA.id, empA.id], [unitA.id, empMgr.id], [unitB.id, empB.id]] as const) {
        const ue = await prisma.unitEmployee.create({ data: { unitId: u, employeeId: e } as any }); ids.ues.push(ue.id);
      }

      // Shift 09:00–17:00 assigned to empA (for late-minute maths).
      const shift = await prisma.shift.create({ data: { name: `${TAG}_shift`, startTime: new Date(YEAR, 0, 1, 9, 0, 0), endTime: new Date(YEAR, 0, 1, 17, 0, 0) } as any });
      ids.shifts.push(shift.id);
      const sa = await prisma.shiftAssignment.create({ data: { employeeId: empA.id, shiftId: shift.id, startDate: new Date(YEAR, 0, 1) } as any });
      ids.sa.push(sa.id);

      // Known attendance for empA: 10 present, 2 late (09:45 -> 45m), 1 half (11:00 -> 120m), 3 absent, 1 on-leave.
      for (let d = 1; d <= 10; d++) await att(empA.id, d, "PRESENT", 9, 0);
      await att(empA.id, 11, "LATE", 9, 45);
      await att(empA.id, 12, "LATE", 9, 45);
      await att(empA.id, 13, "HALF_DAY", 11, 0);
      await att(empA.id, 14, "ABSENT");
      await att(empA.id, 15, "ABSENT");
      await att(empA.id, 16, "ABSENT");
      await att(empA.id, 17, "ON_LEAVE");

      // An approved 2-day leave in March for empA.
      const lr = await prisma.leaveRequest.create({ data: { employeeId: empA.id, startDate: new Date(YEAR, MONTH - 1, 17), endDate: new Date(YEAR, MONTH - 1, 18), status: "APPROVED", leaveType: "CASUAL" } as any });
      ids.leaves.push(lr.id);

      // Users: a unit-A manager (NO viewAll) and a viewAll user.
      const uMgr = await prisma.user.create({ data: { username: `${TAG}.mgr@test.local`, password: "x", employeeId: empMgr.id } as any });
      const uView = await prisma.user.create({ data: { username: `${TAG}.view@test.local`, password: "x", employeeId: empB.id } as any });
      ids.users.push(uMgr.id, uView.id);
      ids.fps.push((await prisma.featurePermission.create({ data: { parentType: "User", parentId: uMgr.id, permissions: { allowedFeatures: ["login.admin.*", "employee.read.*", "attendance.read.*", "ams.report.read.*"] } } as any })).id);
      ids.fps.push((await prisma.featurePermission.create({ data: { parentType: "User", parentId: uView.id, permissions: { allowedFeatures: ["login.admin.*", "employee.read.*", "ams.report.read.*", "ams.viewAll.unit.*"] } } as any })).id);

      // ---- Report numbers (god scope so empA is in scope) ----
      const { rows, totals } = await svc.monthlyRows(GOD_ID, { year: YEAR, month: MONTH });
      const r = rows.find((x) => x.employeeId === empA.id);
      check("monthly row exists for the test employee", !!r);
      if (r) {
        check("present days = 10", r.presentDays === 10, `got ${r.presentDays}`);
        check("late days = 2", r.lateDays === 2, `got ${r.lateDays}`);
        check("half days = 1", r.halfDays === 1, `got ${r.halfDays}`);
        check("absent days = 3", r.absentDays === 3, `got ${r.absentDays}`);
        check("on-leave days = 1", r.onLeaveDays === 1, `got ${r.onLeaveDays}`);
        check("total late minutes = 210 (45+45+120)", r.totalLateMinutes === 210, `got ${r.totalLateMinutes}`);
        check("leaves this month = 2", r.leavesThisMonth === 2, `got ${r.leavesThisMonth}`);
        check("leave entitlement (year) = 32", r.leaveEntitlementYear === 32, `got ${r.leaveEntitlementYear}`);
        check("medical eligible = true (6y service)", r.medicalEligible === true);
        check("policy group = 3+ years", /3\+/.test(r.policyGroup), r.policyGroup);
        check("remaining = entitlement - taken this year", r.remainingLeaveYear === Math.max(0, 32 - r.leavesTakenYear), `rem ${r.remainingLeaveYear}, taken ${r.leavesTakenYear}`);
      }
      check("totals aggregate present days across set >= 10", totals.presentDays >= 10, `got ${totals.presentDays}`);

      // ---- Unit scoping ----
      const mgrRows = await svc.monthlyRows(uMgr.id, { year: YEAR, month: MONTH });
      const mgrIds = new Set(mgrRows.rows.map((x) => x.employeeId));
      check("unit-A manager sees unit-A employee (empA)", mgrIds.has(empA.id));
      check("unit-A manager sees self (empMgr)", mgrIds.has(empMgr.id));
      check("unit-A manager does NOT see unit-B employee (empB)", !mgrIds.has(empB.id));

      const viewRows = await svc.monthlyRows(uView.id, { year: YEAR, month: MONTH });
      const viewIds = new Set(viewRows.rows.map((x) => x.employeeId));
      check("viewAll user sees BOTH unit-A and unit-B employees", viewIds.has(empA.id) && viewIds.has(empB.id));

      // ---- Entitlement apply is non-destructive (create-only) ----
      const hr = new HrPolicyService();
      const a1 = await hr.applyEntitlement(empA.id, YEAR);
      const a2 = await hr.applyEntitlement(empA.id, YEAR);
      check("applyEntitlement creates POLICY then is non-destructive (skips existing)", a1.action === "created" && a1.policy === 32 && a2.action === "skipped");
    });
  } finally {
    await prisma.leaveAllocation.deleteMany({ where: { employeeId: { in: ids.emps } } }).catch(() => {});
    for (const id of ids.leaves) await prisma.leaveRequest.delete({ where: { id } }).catch(() => {});
    for (const id of ids.att) await prisma.attendance.delete({ where: { id } }).catch(() => {});
    for (const id of ids.sa) await prisma.shiftAssignment.delete({ where: { id } }).catch(() => {});
    for (const id of ids.shifts) await prisma.shift.delete({ where: { id } }).catch(() => {});
    for (const id of ids.fps) await prisma.featurePermission.delete({ where: { id } }).catch(() => {});
    for (const id of ids.users) await prisma.user.delete({ where: { id } }).catch(() => {});
    for (const id of ids.ues) await prisma.unitEmployee.delete({ where: { id } }).catch(() => {});
    for (const id of ids.emps) await prisma.employee.delete({ where: { id } }).catch(() => {});
    for (const id of ids.units) await prisma.unit.delete({ where: { id } }).catch(() => {});
  }

  out(`\n[amsReports] ${pass} passed, ${fail} failed`);
  try { fs.writeFileSync("qa/.amsreports-last.txt", lines.join("\n") + "\n"); } catch { /* ignore */ }
  await prisma.$disconnect();
  process.exitCode = fail === 0 ? 0 : 1;
}
main().catch(async (e) => { out(`ERROR ${e?.stack || e?.message || e}`); try { fs.writeFileSync("qa/.amsreports-last.txt", lines.join("\n") + "\nERROR\n"); } catch {} await prisma.$disconnect(); process.exitCode = 1; });
