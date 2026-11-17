/**
 * Leave <-> attendance sync QA (QA_ data only, self-cleaning). Reproduces and proves the fix for the
 * prod error "Leave request is already approved and cannot be rejected again": when an ON_LEAVE
 * attendance day is edited to a worked status, the approved leave that covered that day must be undone
 * via the dedicated cancel path, NOT the guarded reject path.
 *   - single-day approved leave  -> CANCELLED (status REJECTED) + allocation balance restored
 *   - multi-day approved leave    -> LEFT INTACT (skipped with a note), attendance still updated
 *
 *   npx ts-node qa/leaveAttendanceSync.ts   (results in qa/.leavesync-last.txt)
 */
process.env.QA_KEEP_TEST_EMPLOYEES = "1";

import * as fs from "fs";
import prisma from "../src/core/models/base.model";
import { runWithContext } from "../src/core/context/requestContext";
import { GOD_ID } from "../src/modules/CRM/shared/access";
import attendanceModel from "../src/modules/AMS/Attendance/models/attendance.model";
import { getStartOfDayPakistan } from "../src/core/utils/pakistanDay";
import { purgeQaEmployees } from "./qaPurge";

const TAG = `QA_LSYNC_${Date.now()}`;
let pass = 0, fail = 0;
const lines: string[] = [];
function out(s: string) { lines.push(s); try { process.stdout.write(s + "\n"); } catch { /* ignore */ } }
function check(label: string, ok: boolean, detail = "") { (ok ? pass++ : fail++); out(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`); }

async function main() {
  const cfgIds: string[] = [];
  try {
    await runWithContext({ userId: GOD_ID } as any, async () => {
      const cfg = await prisma.leaveConfiguration.create({ data: { name: `${TAG}_ANNUAL`, maxDays: 10 } as any });
      cfgIds.push(cfg.id);

      async function mkEmp(suffix: string) {
        return prisma.employee.create({ data: { name: "QALSync", surname: suffix, address: "QA", dob: new Date("1990-01-01"), joiningDate: new Date("2020-01-01"), bloodGroup: "O+", contactNo: "0300", designation: "QA", department: "QA", martialStatus: "Single", company: "SOLARMAX", code: `${TAG}_${suffix}` } as any });
      }

      // ---- Case A: single-day approved leave, attendance edited off it -> cancel + restore ----
      const empA = await mkEmp("single");
      const dayA = getStartOfDayPakistan(new Date(2026, 5, 10)); // 10 Jun 2026
      const allocA = await prisma.leaveAllocation.create({ data: { employeeId: empA.id, leaveConfigId: cfg.id, assignedDays: 10, usedDays: 1, remainingDays: 9, allocationStartDate: new Date(2026, 0, 1), allocationEndDate: new Date(2026, 11, 31) } as any });
      const leaveA = await prisma.leaveRequest.create({ data: { employeeId: empA.id, leaveAllocationId: allocA.id, startDate: dayA, endDate: dayA, status: "APPROVED", leaveType: `${TAG}_ANNUAL`, reason: "QA single" } as any });
      const attA = await prisma.attendance.create({ data: { employeeId: empA.id, date: dayA, status: "ON_LEAVE", checkIn: null, checkOut: null } as any });

      // Edit the ON_LEAVE day to PRESENT — this used to throw. Must succeed now.
      let threw = false;
      try {
        await (attendanceModel as any).attendance.gpUpdate(attA.id, { status: "PRESENT", employeeId: empA.id, date: dayA });
      } catch (e: any) {
        threw = true;
        out(`  (threw: ${e?.message || e})`);
      }
      check("single-day: attendance edit off leave does NOT throw", !threw);

      const leaveAAfter = await prisma.leaveRequest.findUnique({ where: { id: leaveA.id }, select: { status: true, reviewNote: true } });
      check("single-day: leave is CANCELLED (status REJECTED)", leaveAAfter?.status === "REJECTED", `status=${leaveAAfter?.status}`);
      const allocAAfter = await prisma.leaveAllocation.findUnique({ where: { id: allocA.id }, select: { usedDays: true, remainingDays: true } });
      check("single-day: allocation balance restored (used 1 -> 0, remaining 9 -> 10)", allocAAfter?.usedDays === 0 && allocAAfter?.remainingDays === 10, `used=${allocAAfter?.usedDays} remaining=${allocAAfter?.remainingDays}`);
      const attAAfter = await prisma.attendance.findUnique({ where: { id: attA.id }, select: { status: true } });
      check("single-day: attendance now PRESENT", attAAfter?.status === "PRESENT", `status=${attAAfter?.status}`);

      // ---- Case B: multi-day approved leave, one day edited off -> leave left intact (skipped) ----
      const empB = await mkEmp("multi");
      const d1 = getStartOfDayPakistan(new Date(2026, 5, 15));
      const d3 = getStartOfDayPakistan(new Date(2026, 5, 17)); // 15-17 Jun (3 days)
      const allocB = await prisma.leaveAllocation.create({ data: { employeeId: empB.id, leaveConfigId: cfg.id, assignedDays: 10, usedDays: 3, remainingDays: 7, allocationStartDate: new Date(2026, 0, 1), allocationEndDate: new Date(2026, 11, 31) } as any });
      const leaveB = await prisma.leaveRequest.create({ data: { employeeId: empB.id, leaveAllocationId: allocB.id, startDate: d1, endDate: d3, status: "APPROVED", leaveType: `${TAG}_ANNUAL`, reason: "QA multi" } as any });
      const attB = await prisma.attendance.create({ data: { employeeId: empB.id, date: d1, status: "ON_LEAVE", checkIn: null, checkOut: null } as any });

      let threwB = false;
      try {
        await (attendanceModel as any).attendance.gpUpdate(attB.id, { status: "PRESENT", employeeId: empB.id, date: d1 });
      } catch (e: any) { threwB = true; out(`  (threwB: ${e?.message || e})`); }
      check("multi-day: attendance edit off one leave day does NOT throw", !threwB);
      const leaveBAfter = await prisma.leaveRequest.findUnique({ where: { id: leaveB.id }, select: { status: true } });
      check("multi-day: leave is LEFT INTACT (still APPROVED)", leaveBAfter?.status === "APPROVED", `status=${leaveBAfter?.status}`);
      const attBAfter = await prisma.attendance.findUnique({ where: { id: attB.id }, select: { status: true } });
      check("multi-day: attendance still updated to PRESENT", attBAfter?.status === "PRESENT", `status=${attBAfter?.status}`);
    });
  } finally {
    // Sweep every QA_LSYNC_ employee + all FK dependents (attendance, leave, allocation), then the config.
    await purgeQaEmployees(prisma, "QA_LSYNC_").catch(() => {});
    for (const id of cfgIds) await prisma.leaveConfiguration.delete({ where: { id } }).catch(() => {});
  }

  out(`\n[leaveAttendanceSync] ${pass} passed, ${fail} failed`);
  try { fs.writeFileSync("qa/.leavesync-last.txt", lines.join("\n") + "\n"); } catch { /* ignore */ }
  await prisma.$disconnect();
  process.exitCode = fail === 0 ? 0 : 1;
}
main().catch(async (e) => { out(`ERROR ${e?.stack || e?.message || e}`); try { fs.writeFileSync("qa/.leavesync-last.txt", lines.join("\n") + "\nERROR\n"); } catch {} await prisma.$disconnect(); process.exitCode = 1; });
