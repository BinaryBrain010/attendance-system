/**
 * HR Policy QA (QA_ data only, self-cleaning). Covers:
 *   - band calculation at 11 months / 2 years / 3 years 1 day (pure policyCalc)
 *   - yearly entitlement flat vs pro-rata across a mid-year band crossing
 *   - probation decisions: Confirm / Extend / Terminate (+ linked-user auto-suspend)
 *   - the daily probation alert notifies HR managers (PROBATION_DUE)
 *
 *   npx ts-node qa/hrPolicy.ts   (reads results from qa/.hrpolicy-last.txt — the logger hijacks console)
 */
import * as fs from "fs";
import prisma from "../src/core/models/base.model";
import { runWithContext } from "../src/core/context/requestContext";
import { GOD_ID } from "../src/modules/CRM/shared/access";
import HrPolicyService from "../src/modules/HR/Policy/services/hrPolicy.service";
import LeaveReqService from "../src/modules/AMS/Leaves/services/leaveReq.service";
import { completedServiceYears, applicableRule, entitlementForYear, probationDefaultEnd } from "../src/modules/HR/Policy/helper/policyCalc";
import { LeaveStatus } from "@prisma/client";

const TAG = `QA_HR_${Date.now()}`;
let pass = 0, fail = 0;
const lines: string[] = [];
function out(s: string) { lines.push(s); try { process.stdout.write(s + "\n"); } catch { /* ignore */ } }
function check(label: string, ok: boolean, detail = "") { (ok ? pass++ : fail++); out(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`); }

const RULES = [
  { minYears: 0, maxYears: 1, annualLeaveDays: 0, medicalEligible: false, effectiveFrom: new Date("2020-01-01"), isActive: true, isDeleted: null },
  { minYears: 1, maxYears: 3, annualLeaveDays: 0, medicalEligible: false, effectiveFrom: new Date("2020-01-01"), isActive: true, isDeleted: null },
  { minYears: 3, maxYears: null, annualLeaveDays: 32, medicalEligible: true, effectiveFrom: new Date("2020-01-01"), isActive: true, isDeleted: null },
];

async function main() {
  // ---- 1. Band calculation (pure) -------------------------------------------------------------
  const asOf = new Date("2026-06-01");
  const y11mo = completedServiceYears(new Date("2025-07-01"), asOf); // 11 months
  const y2 = completedServiceYears(new Date("2024-01-01"), asOf);    // 2 years
  const y3_1 = completedServiceYears(new Date("2023-05-31"), asOf);  // 3 years 1 day
  check("11 months -> 0 completed years", y11mo === 0, `got ${y11mo}`);
  check("2 years -> 2 completed years", y2 === 2, `got ${y2}`);
  check("3 years 1 day -> 3 completed years", y3_1 === 3, `got ${y3_1}`);

  const b11 = applicableRule(RULES as any, y11mo, asOf);
  const b2 = applicableRule(RULES as any, y2, asOf);
  const b3 = applicableRule(RULES as any, y3_1, asOf);
  check("11 months band: 0 leave, no medical", !!b11 && b11.annualLeaveDays === 0 && b11.medicalEligible === false);
  check("2 years band: 0 leave, no medical", !!b2 && b2.annualLeaveDays === 0 && b2.medicalEligible === false);
  check("3 years 1 day band: 32 leave, medical eligible", !!b3 && b3.annualLeaveDays === 32 && b3.medicalEligible === true);

  // ---- 2. Entitlement flat vs pro-rata --------------------------------------------------------
  // Joined 2023-01-01 -> at Jan 1 2026 has 3 years -> flat 32.
  const flat = entitlementForYear(new Date("2023-01-01"), 2026, RULES as any, false);
  check("flat entitlement (joined 2023) = 32 for 2026", flat.annualLeaveDays === 32 && flat.medicalEligible === true);
  // Joined 2023-07-01 -> crosses into 3+ band on 2026-07-01. Flat(Jan1)=0; pro-rata ~16.
  const flatMid = entitlementForYear(new Date("2023-07-01"), 2026, RULES as any, false);
  const proMid = entitlementForYear(new Date("2023-07-01"), 2026, RULES as any, true);
  check("mid-year crosser flat (Jan 1 band) = 0", flatMid.annualLeaveDays === 0);
  check("mid-year crosser pro-rata > 0 and < 32", proMid.proRated && proMid.annualLeaveDays > 0 && proMid.annualLeaveDays < 32, `got ${proMid.annualLeaveDays}`);

  // ---- DB-backed: probation decisions + alert -------------------------------------------------
  const createdEmpIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdFpIds: string[] = [];
  const createdConfigIds: string[] = [];
  const createdAllocIds: string[] = [];
  const createdLeaveIds: string[] = [];
  const svc = new HrPolicyService();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  async function mkEmp(suffix: string, probationEnd: Date | null) {
    const e = await prisma.employee.create({ data: { name: "QAHr", surname: suffix, address: "QA", dob: new Date("1990-01-01"), joiningDate: new Date("2026-01-01"), bloodGroup: "O+", contactNo: "0300", designation: "QA", department: "QA", martialStatus: "Single", company: "SOLARMAX", code: `${TAG}_${suffix}`, status: "PROBATION", probationEndDate: probationEnd } as any });
    createdEmpIds.push(e.id); return e;
  }

  try {
    await runWithContext({ userId: GOD_ID } as any, async () => {
      // 3. Decisions
      const empConfirm = await mkEmp("confirm", today);
      await svc.decide(GOD_ID, empConfirm.id, "CONFIRM", { reason: "Good performance" });
      const c = await prisma.employee.findUnique({ where: { id: empConfirm.id }, select: { status: true, probationClearedAt: true } });
      const cHist = await prisma.probationDecision.findFirst({ where: { employeeId: empConfirm.id, decision: "CONFIRM" } });
      check("CONFIRM -> status ACTIVE + cleared + decision row", c?.status === "ACTIVE" && !!c?.probationClearedAt && !!cHist);

      const empExtend = await mkEmp("extend", today);
      const newEnd = new Date(today.getTime() + 30 * 86400000);
      await svc.decide(GOD_ID, empExtend.id, "EXTEND", { newEndDate: newEnd, reason: "Need more time" });
      const ex = await prisma.employee.findUnique({ where: { id: empExtend.id }, select: { status: true, probationEndDate: true } });
      check("EXTEND -> status PROBATION + new end date + row", ex?.status === "PROBATION" && !!ex?.probationEndDate && Math.abs(new Date(ex!.probationEndDate!).getTime() - newEnd.getTime()) < 86400000 && !!(await prisma.probationDecision.findFirst({ where: { employeeId: empExtend.id, decision: "EXTEND" } })));

      // Terminate with a linked user -> status FIRE + user suspended
      const empTerm = await mkEmp("term", today);
      const uTerm = await prisma.user.create({ data: { username: `${TAG}.term@test.local`, password: "x", employeeId: empTerm.id } as any });
      createdUserIds.push(uTerm.id);
      await svc.decide(GOD_ID, empTerm.id, "TERMINATE", { reason: "Did not pass" });
      const tm = await prisma.employee.findUnique({ where: { id: empTerm.id }, select: { status: true } });
      const uSusp = await prisma.user.findUnique({ where: { id: uTerm.id }, select: { suspendedAt: true } });
      check("TERMINATE -> status FIRE + linked user suspended + row", tm?.status === "FIRE" && !!uSusp?.suspendedAt && !!(await prisma.probationDecision.findFirst({ where: { employeeId: empTerm.id, decision: "TERMINATE" } })));

      // Reason required
      let blocked = false;
      try { await svc.decide(GOD_ID, (await mkEmp("noreason", today)).id, "TERMINATE", {}); } catch { blocked = true; }
      check("TERMINATE without reason is rejected", blocked);

      // 4. Probation alert -> notifies HR managers (PROBATION_DUE)
      const hrEmp = await mkEmp("hrmgr", null);
      const hrUser = await prisma.user.create({ data: { username: `${TAG}.hr@test.local`, password: "x", employeeId: hrEmp.id } as any });
      createdUserIds.push(hrUser.id);
      createdFpIds.push((await prisma.featurePermission.create({ data: { parentType: "User", parentId: hrUser.id, permissions: { allowedFeatures: ["login.admin.*", "hr.policy.manage.*", "ams.viewAll.unit.*", "employee.read.*"] } } as any })).id);

      const empDue = await mkEmp("due", today); // ends today -> dueInDays 0
      const res = await svc.runProbationAlerts();
      const notif = await prisma.notification.findFirst({ where: { userId: hrUser.id, type: "PROBATION_DUE", entityType: "Employee", entityId: empDue.id } });
      check("probation alert notifies the HR manager (PROBATION_DUE)", !!notif, `alerts checked=${res.checked} notified=${res.notified}`);

      // idempotent: a second run same day creates no new notification for this employee
      await svc.runProbationAlerts();
      const dupCount = await prisma.notification.count({ where: { userId: hrUser.id, type: "PROBATION_DUE", entityType: "Employee", entityId: empDue.id } });
      check("re-running the alert the same day does not duplicate", dupCount === 1, `count=${dupCount}`);

      // ---- #1/#2: a LEGACY employee (ACTIVE, joined long ago, never a decision) is NEVER alerted ----
      const legacyEmp = await prisma.employee.create({ data: { name: "QAHr", surname: "legacy", address: "QA", dob: new Date("1985-01-01"), joiningDate: new Date("2015-01-01"), bloodGroup: "O+", contactNo: "0300", designation: "QA", department: "QA", martialStatus: "Single", company: "SOLARMAX", code: `${TAG}_legacy`, status: "ACTIVE", probationEndDate: new Date("2015-04-01") } as any });
      createdEmpIds.push(legacyEmp.id);
      const dueBefore = await svc.probationDue(undefined, 36500); // very wide window
      check("legacy ACTIVE employee is NOT in the probation-due list (status PROBATION/new-hire only)", !dueBefore.some((r: any) => r.id === legacyEmp.id));
      await svc.runProbationAlerts();
      const legacyAlert = await prisma.notification.findFirst({ where: { type: "PROBATION_DUE", entityType: "Employee", entityId: legacyEmp.id } });
      check("daily job sends ZERO alerts for the legacy employee", !legacyAlert);

      // ---- #1: legacy confirm step marks them confirmed (System, legacy; no notification) ----
      const toConfirm = await svc.legacyToConfirm(today);
      check("legacyToConfirm includes the legacy employee", toConfirm.some((e: any) => e.id === legacyEmp.id));
      await svc.confirmLegacy(legacyEmp.id);
      const lc = await prisma.employee.findUnique({ where: { id: legacyEmp.id }, select: { status: true, probationClearedAt: true } });
      const lcDec = await prisma.probationDecision.findFirst({ where: { employeeId: legacyEmp.id, decision: "CONFIRM" } });
      check("confirmLegacy -> ACTIVE + cleared + 'System, legacy' CONFIRM (decidedById null)", lc?.status === "ACTIVE" && !!lc?.probationClearedAt && !!lcDec && /legacy/i.test(lcDec!.reason || "") && lcDec!.decidedById === null);
      const noConfirmNotif = await prisma.notification.findFirst({ where: { entityType: "Employee", entityId: legacyEmp.id } });
      check("legacy confirm creates no notification", !noConfirmNotif);

      // ---- #3: B3 over-balance leave gate ----
      const cfg = await prisma.leaveConfiguration.create({ data: { name: `${TAG}_ANNUAL`, maxDays: 32 } as any });
      createdConfigIds.push(cfg.id);
      const b3Emp = await mkEmp("b3", null);
      const alloc = await prisma.leaveAllocation.create({ data: { employeeId: b3Emp.id, leaveConfigId: cfg.id, assignedDays: 2, usedDays: 0, remainingDays: 2, allocationStartDate: new Date(2026, 0, 1), allocationEndDate: new Date(2026, 11, 31) } as any });
      createdAllocIds.push(alloc.id);
      // request 5 days of a configured type with only 2 remaining -> flagged, NOT blocked
      const leaveSvc = new LeaveReqService();
      const created: any = await leaveSvc.createLeaveRequest({ employeeId: b3Emp.id, startDate: new Date(2026, 5, 1), endDate: new Date(2026, 5, 5), leaveType: `${TAG}_ANNUAL`, status: "PENDING" } as any);
      const leaveReq = Array.isArray(created) ? created[0] : created;
      createdLeaveIds.push(leaveReq.id);
      check("over-balance leave is CREATED and flagged exceedsBalance (not blocked)", !!leaveReq?.id && leaveReq.exceedsBalance === true);

      // non-HR approver is blocked
      const nonHrEmp = await mkEmp("nonhr", null);
      const nonHrUser = await prisma.user.create({ data: { username: `${TAG}.nonhr@test.local`, password: "x", employeeId: nonHrEmp.id } as any });
      createdUserIds.push(nonHrUser.id);
      createdFpIds.push((await prisma.featurePermission.create({ data: { parentType: "User", parentId: nonHrUser.id, permissions: { allowedFeatures: ["login.admin.*", "ams.viewAll.unit.*", "employee.read.*"] } } as any })).id);
      let blockedNonHr = false;
      try { await leaveSvc.updateLeaveRequestStatus(leaveReq.id, LeaveStatus.APPROVED, "ok", nonHrUser.id); } catch (e: any) { blockedNonHr = e?.statusCode === 403 || /HR approval/i.test(e?.message || ""); }
      check("non-HR cannot approve an over-balance leave (needs hr.policy.manage)", blockedNonHr);
      const stillPending = await prisma.leaveRequest.findUnique({ where: { id: leaveReq.id }, select: { status: true } });
      check("over-balance leave stays PENDING after blocked approve", stillPending?.status === "PENDING");

      // HR approver succeeds
      let hrOk = true;
      try { await leaveSvc.updateLeaveRequestStatus(leaveReq.id, LeaveStatus.APPROVED, "HR override", hrUser.id); } catch { hrOk = false; }
      const afterHr = await prisma.leaveRequest.findUnique({ where: { id: leaveReq.id }, select: { status: true } });
      check("HR (hr.policy.manage) CAN approve the over-balance leave", hrOk && afterHr?.status === "APPROVED");

      // ---- #2: applyEntitlement is TYPE-AWARE — never doubles the annual balance ----
      const annualCfg = await prisma.leaveConfiguration.create({ data: { name: `${TAG}_AnnualLeave`, maxDays: 32 } as any });
      const sickCfg = await prisma.leaveConfiguration.create({ data: { name: `${TAG}_SickLeave`, maxDays: 10 } as any });
      createdConfigIds.push(annualCfg.id, sickCfg.id);

      // (a) Already has an ANNUAL allocation for 2026 -> apply SKIPS (no second allocation), flags the diff.
      //     Joined 2020 -> 3+ band -> policy 32 (vs the existing 20) so the flag is a real difference.
      const empAnnual = await prisma.employee.create({ data: { name: "QAHr", surname: "hasAnnual", address: "QA", dob: new Date("1985-01-01"), joiningDate: new Date("2020-01-01"), bloodGroup: "O+", contactNo: "0300", designation: "QA", department: "QA", martialStatus: "Single", company: "SOLARMAX", code: `${TAG}_hasAnnual`, status: "ACTIVE" } as any });
      createdEmpIds.push(empAnnual.id);
      const annualAlloc = await prisma.leaveAllocation.create({ data: { employeeId: empAnnual.id, leaveConfigId: annualCfg.id, assignedDays: 20, usedDays: 0, remainingDays: 20, allocationStartDate: new Date(2026, 0, 1), allocationEndDate: new Date(2026, 11, 31) } as any });
      createdAllocIds.push(annualAlloc.id);
      const applyA = await svc.applyEntitlement(empAnnual.id, 2026);
      const countA = await prisma.leaveAllocation.count({ where: { employeeId: empAnnual.id, isDeleted: null } });
      check("existing annual allocation -> apply SKIPS (no second allocation, balance can't double)", applyA.action === "skipped" && countA === 1);
      check("skipped annual case flags policy(32) vs current(20) for HR", applyA.flagged === true && applyA.policy === 32 && applyA.current === 20);

      // (b) Only a SICK allocation -> the annual POLICY IS created (different leave type).
      const empSick = await mkEmp("sickOnly", null);
      const sickAlloc = await prisma.leaveAllocation.create({ data: { employeeId: empSick.id, leaveConfigId: sickCfg.id, assignedDays: 10, usedDays: 0, remainingDays: 10, allocationStartDate: new Date(2026, 0, 1), allocationEndDate: new Date(2026, 11, 31) } as any });
      createdAllocIds.push(sickAlloc.id);
      const applyS = await svc.applyEntitlement(empSick.id, 2026);
      const polS = await prisma.leaveAllocation.findFirst({ where: { employeeId: empSick.id, source: "POLICY", policyYear: 2026, isDeleted: null } });
      check("only a sick allocation -> annual POLICY IS created (different type, no double)", applyS.action === "created" && !!polS);
    });
  } finally {
    for (const id of createdUserIds) await prisma.notification.deleteMany({ where: { userId: id } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { entityType: "Employee", entityId: { in: createdEmpIds } } }).catch(() => {});
    for (const id of createdLeaveIds) await prisma.leaveRequest.delete({ where: { id } }).catch(() => {});
    await prisma.leaveAllocation.deleteMany({ where: { employeeId: { in: createdEmpIds } } }).catch(() => {}); // incl. auto-created POLICY
    for (const id of createdAllocIds) await prisma.leaveAllocation.delete({ where: { id } }).catch(() => {});
    for (const id of createdConfigIds) await prisma.leaveConfiguration.delete({ where: { id } }).catch(() => {});
    await prisma.probationDecision.deleteMany({ where: { employeeId: { in: createdEmpIds } } }).catch(() => {});
    for (const id of createdFpIds) await prisma.featurePermission.delete({ where: { id } }).catch(() => {});
    for (const id of createdUserIds) await prisma.user.delete({ where: { id } }).catch(() => {});
    for (const id of createdEmpIds) await prisma.employee.delete({ where: { id } }).catch(() => {});
  }

  out(`\n[hrPolicy] ${pass} passed, ${fail} failed`);
  try { fs.writeFileSync("qa/.hrpolicy-last.txt", lines.join("\n") + "\n"); } catch { /* ignore */ }
  await prisma.$disconnect();
  process.exitCode = fail === 0 ? 0 : 1;
}
main().catch(async (e) => { out(`ERROR ${e?.stack || e?.message || e}`); try { fs.writeFileSync("qa/.hrpolicy-last.txt", lines.join("\n") + "\nERROR\n"); } catch {} await prisma.$disconnect(); process.exitCode = 1; });
