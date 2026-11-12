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
import { completedServiceYears, applicableRule, entitlementForYear, probationDefaultEnd } from "../src/modules/HR/Policy/helper/policyCalc";

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
      createdFpIds.push((await prisma.featurePermission.create({ data: { parentType: "User", parentId: hrUser.id, permissions: { allowedFeatures: ["login.admin.*", "hr.policy.manage.*"] } } as any })).id);

      const empDue = await mkEmp("due", today); // ends today -> dueInDays 0
      const res = await svc.runProbationAlerts();
      const notif = await prisma.notification.findFirst({ where: { userId: hrUser.id, type: "PROBATION_DUE", entityType: "Employee", entityId: empDue.id } });
      check("probation alert notifies the HR manager (PROBATION_DUE)", !!notif, `alerts checked=${res.checked} notified=${res.notified}`);

      // idempotent: a second run same day creates no new notification for this employee
      await svc.runProbationAlerts();
      const dupCount = await prisma.notification.count({ where: { userId: hrUser.id, type: "PROBATION_DUE", entityType: "Employee", entityId: empDue.id } });
      check("re-running the alert the same day does not duplicate", dupCount === 1, `count=${dupCount}`);
    });
  } finally {
    for (const id of createdUserIds) await prisma.notification.deleteMany({ where: { userId: id } }).catch(() => {});
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
