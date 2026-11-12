/**
 * HR Policy service: service-length rules, yearly leave entitlement (feeds LeaveAllocation),
 * and the probation lifecycle (confirm / extend / terminate) with audited decisions + HR alerts.
 * Everything that lists employees is scoped to the caller's accessible units.
 */
import prisma from "../../../../core/models/base.model";
import { AppError } from "../../../../core/errors/app.error";
import { getActorId } from "../../../../core/context/requestContext";
import { logActivity } from "../../../ActivityLog/helper/activityLog.helper";
import { auditEvent } from "../../../../core/audit/auditWriter";
import { notify, userIdsForEmployees } from "../../../Work/shared/workHelpers";
import accessModel from "../../../rbac/Access/models/access.model";
import userModel from "../../../rbac/user/models/user.model";
import { getAccessibleEmployeeIds } from "../../../AMS/Unit/helper/unitAccess.helper";
import { getHrSettings, updateHrSettings, HrSettings } from "../helper/hrSettings";
import {
  completedServiceYears, applicableRule, entitlementForYear, bandLabel, probationDefaultEnd, EntitlementResult,
} from "../helper/policyCalc";

type ProbationDecision = "CONFIRM" | "EXTEND" | "TERMINATE";

class HrPolicyService {
  // ---- Settings -------------------------------------------------------------------------------
  async getSettings(): Promise<HrSettings> { return getHrSettings(); }
  async updateSettings(updates: Partial<HrSettings>): Promise<HrSettings> {
    if (updates.probationMonths != null && (updates.probationMonths < 0 || updates.probationMonths > 60)) {
      throw new AppError(400, "probationMonths must be between 0 and 60.");
    }
    return updateHrSettings(updates);
  }

  // ---- Policy rules ---------------------------------------------------------------------------
  async listRules(): Promise<any[]> {
    return prisma.hrPolicyRule.findMany({ where: { isDeleted: null }, orderBy: [{ effectiveFrom: "desc" }, { minYears: "asc" }] });
  }
  /** All active rules effective on/before `asOf` (used by calculations). */
  async activeRules(asOf: Date = new Date()): Promise<any[]> {
    return prisma.hrPolicyRule.findMany({ where: { isDeleted: null, isActive: true, effectiveFrom: { lte: asOf } } });
  }
  async upsertRule(input: any): Promise<any> {
    const data = {
      minYears: Math.max(0, Math.trunc(Number(input.minYears) || 0)),
      maxYears: input.maxYears == null || input.maxYears === "" ? null : Math.trunc(Number(input.maxYears)),
      annualLeaveDays: Math.max(0, Math.trunc(Number(input.annualLeaveDays) || 0)),
      leaveByType: input.leaveByType ?? null,
      medicalEligible: !!input.medicalEligible,
      notes: input.notes ?? null,
      effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : new Date(),
      isActive: input.isActive === false ? false : true,
    };
    if (data.maxYears != null && data.maxYears <= data.minYears) {
      throw new AppError(400, "maxYears must be greater than minYears (or empty for open-ended).");
    }
    if (input.id) {
      const existing = await prisma.hrPolicyRule.findFirst({ where: { id: input.id, isDeleted: null } });
      if (!existing) throw new AppError(404, "Policy rule not found.");
      return prisma.hrPolicyRule.update({ where: { id: input.id }, data });
    }
    return prisma.hrPolicyRule.create({ data });
  }
  async removeRule(id: string): Promise<void> {
    await prisma.hrPolicyRule.updateMany({ where: { id, isDeleted: null }, data: { isDeleted: new Date() } });
  }

  // ---- Entitlement ----------------------------------------------------------------------------
  /** Compute (do not persist) the entitlement an employee should receive for `year`. */
  async previewEntitlement(employeeId: string, year: number): Promise<EntitlementResult & { employeeId: string }> {
    const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { joiningDate: true } });
    if (!emp) throw new AppError(404, "Employee not found.");
    const settings = await getHrSettings();
    const rules = await this.activeRules(new Date(year, 11, 31));
    const res = entitlementForYear(emp.joiningDate, year, rules, settings.entitlementProRata);
    return { ...res, employeeId };
  }

  /** Existing non-deleted allocations that overlap `year` (POLICY for the year, or any date-overlap), with type. */
  async allocationsForYear(employeeId: string, year: number): Promise<{ id: string; assignedDays: number; source: string | null; leaveConfigId: string | null; leaveConfigName: string | null }[]> {
    const start = new Date(year, 0, 1); const end = new Date(year, 11, 31);
    const rows = await prisma.leaveAllocation.findMany({
      where: {
        employeeId, isDeleted: null,
        OR: [
          { source: "POLICY", policyYear: year },
          { AND: [{ allocationStartDate: { lte: end } }, { OR: [{ allocationEndDate: null }, { allocationEndDate: { gte: start } }] }] },
        ],
      },
      select: { id: true, assignedDays: true, source: true, leaveConfigId: true, leaveConfig: { select: { name: true } } },
    });
    return rows.map((r) => ({ id: r.id, assignedDays: r.assignedDays, source: r.source, leaveConfigId: r.leaveConfigId, leaveConfigName: r.leaveConfig?.name ?? null }));
  }

  /** Is this allocation the same "type" as the policy's annual entitlement (so creating POLICY would double it)? */
  private isAnnualType(a: { source: string | null; leaveConfigId: string | null; leaveConfigName: string | null }, annualConfigId: string | null): boolean {
    if (a.source === "POLICY") return true;
    if (annualConfigId) return a.leaveConfigId === annualConfigId;
    return /annual/i.test(a.leaveConfigName || ""); // auto-detect when no annual config is configured
  }

  /**
   * NON-DESTRUCTIVE, TYPE-AWARE policy apply: create a POLICY annual LeaveAllocation for `year` ONLY
   * when the employee has NO annual-type allocation for that year (another POLICY one, or one linked to
   * the configured/auto-detected annual leave type) — so annual balances never double. NEVER updates,
   * reduces or deletes any allocation. When an annual allocation already exists it is left untouched and
   * the policy-vs-current difference is flagged for HR. Returns a side-by-side summary.
   */
  async applyEntitlement(employeeId: string, year: number): Promise<any> {
    const ent = await this.previewEntitlement(employeeId, year);
    const settings = await getHrSettings();
    const existing = await this.allocationsForYear(employeeId, year);
    const sameType = existing.filter((a) => this.isAnnualType(a, settings.annualLeaveConfigId));
    const currentSameType = sameType.reduce((s, a) => s + (a.assignedDays || 0), 0);
    if (sameType.length) {
      const policyBelowCurrent = ent.annualLeaveDays < currentSameType;
      return { employeeId, year, action: "skipped", current: currentSameType, policy: ent.annualLeaveDays, policyBelowCurrent, flagged: ent.annualLeaveDays !== currentSameType };
    }
    await prisma.leaveAllocation.create({
      data: {
        employeeId, assignedDays: ent.annualLeaveDays, usedDays: 0, remainingDays: ent.annualLeaveDays,
        source: "POLICY", policyYear: year, leaveConfigId: settings.annualLeaveConfigId ?? undefined,
        allocationStartDate: new Date(year, 0, 1), allocationEndDate: new Date(year, 11, 31), note: ent.detail,
      },
    });
    return { employeeId, year, action: "created", current: 0, policy: ent.annualLeaveDays, policyBelowCurrent: false, flagged: false };
  }

  /** Read-only plan for `applyEntitlement` (no writes) — for the dry run. */
  async planEntitlement(employeeId: string, year: number): Promise<{ action: "create" | "skip"; current: number; policy: number; flagged: boolean }> {
    const ent = await this.previewEntitlement(employeeId, year);
    const settings = await getHrSettings();
    const existing = await this.allocationsForYear(employeeId, year);
    const sameType = existing.filter((a) => this.isAnnualType(a, settings.annualLeaveConfigId));
    if (sameType.length) {
      const current = sameType.reduce((s, a) => s + (a.assignedDays || 0), 0);
      return { action: "skip", current, policy: ent.annualLeaveDays, flagged: ent.annualLeaveDays !== current };
    }
    return { action: "create", current: 0, policy: ent.annualLeaveDays, flagged: false };
  }

  /** HR manually overrides a policy entitlement (reason required, audited). */
  async manualAdjustEntitlement(employeeId: string, year: number, days: number, reason: string, actorUserId?: string): Promise<any> {
    if (!reason || !reason.trim()) throw new AppError(400, "A reason is required to adjust a policy entitlement.");
    const d = Math.max(0, Math.trunc(Number(days)));
    const existing = await prisma.leaveAllocation.findFirst({ where: { employeeId, isDeleted: null, source: "POLICY", policyYear: year } });
    const start = new Date(year, 0, 1); const end = new Date(year, 11, 31);
    let allocId: string; let previous = 0;
    if (existing) {
      previous = existing.assignedDays;
      const used = existing.usedDays ?? 0;
      const upd = await prisma.leaveAllocation.update({
        where: { id: existing.id },
        data: { assignedDays: d, remainingDays: Math.max(0, d - used), manualReason: reason.trim() },
      });
      allocId = upd.id;
    } else {
      const created = await prisma.leaveAllocation.create({
        data: { employeeId, assignedDays: d, usedDays: 0, remainingDays: d, source: "POLICY", policyYear: year, allocationStartDate: start, allocationEndDate: end, manualReason: reason.trim() },
      });
      allocId = created.id;
    }
    try {
      await auditEvent(prisma as any, {
        entity: "LeaveAllocation", entityId: allocId, action: "UPDATE",
        changes: { manualEntitlementAdjust: { year, from: previous, to: d, reason: reason.trim() } },
        userId: actorUserId ?? getActorId(),
      } as any);
    } catch { /* best-effort */ }
    return { employeeId, year, previous, assigned: d, reason: reason.trim() };
  }

  // ---- Probation ------------------------------------------------------------------------------
  /** The effective probation end for an employee (explicit field, else joining + global months). */
  async effectiveProbationEnd(emp: { joiningDate: Date; probationEndDate: Date | null }, months: number): Promise<Date> {
    return emp.probationEndDate ?? probationDefaultEnd(emp.joiningDate, months);
  }

  /**
   * Whether an employee is genuinely ON probation: not cleared, not terminal, AND either their status
   * is PROBATION or they joined on/after the policy start date. Legacy staff are never on probation.
   */
  isOnProbation(e: { status: string; joiningDate: Date; probationClearedAt: Date | null }, policyStart: Date | null): boolean {
    if (e.probationClearedAt) return false;
    if (e.status === "FIRE" || e.status === "RESIGNED") return false;
    if (e.status === "PROBATION") return true;
    if (policyStart && new Date(e.joiningDate) >= policyStart) return true;
    return false;
  }

  /**
   * Employees genuinely on probation whose end is within `withinDays`, scoped to the caller's units.
   * Used by the dashboard list, the Reports section and the daily alert job. Legacy staff (joined
   * before the policy start, status not PROBATION) are excluded entirely.
   */
  async probationDue(userId: string | undefined, withinDays = 7): Promise<any[]> {
    const settings = await getHrSettings();
    const policyStart = settings.probationPolicyStartDate ? startOfDay(new Date(settings.probationPolicyStartDate)) : null;
    const scope = userId ? await getAccessibleEmployeeIds(userId) : null;
    if (scope !== null && scope.length === 0) return [];
    const where: any = {
      isDeleted: null,
      probationClearedAt: null,
      status: { notIn: ["FIRE", "RESIGNED"] },
    };
    if (scope !== null) where.id = { in: scope };
    const emps = await prisma.employee.findMany({
      where, select: { id: true, code: true, name: true, surname: true, designation: true, department: true, joiningDate: true, probationEndDate: true, probationClearedAt: true, status: true },
    });
    const today = startOfDay(new Date());
    const horizon = addDays(today, withinDays);
    const rows: any[] = [];
    for (const e of emps) {
      if (!this.isOnProbation(e, policyStart)) continue; // legacy / already-confirmed never appear
      const end = startOfDay(e.probationEndDate ?? probationDefaultEnd(e.joiningDate, settings.probationMonths));
      if (end <= horizon) {
        rows.push({
          ...e,
          probationEnd: end,
          dueInDays: Math.round((end.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)),
          overdue: end < today,
        });
      }
    }
    rows.sort((a, b) => a.probationEnd.getTime() - b.probationEnd.getTime());
    return rows;
  }

  /**
   * Legacy staff to mark as already-confirmed: not cleared, not terminal, NOT currently on probation,
   * and joined more than `probationMonths` ago. (For the one-time applyHrPolicy confirm step.)
   */
  async legacyToConfirm(policyStartOverride?: Date | null): Promise<any[]> {
    const settings = await getHrSettings();
    const policyStart = policyStartOverride !== undefined ? policyStartOverride : (settings.probationPolicyStartDate ? startOfDay(new Date(settings.probationPolicyStartDate)) : null);
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - settings.probationMonths);
    const emps = await prisma.employee.findMany({
      where: { isDeleted: null, probationClearedAt: null, status: { notIn: ["FIRE", "RESIGNED"] } },
      select: { id: true, code: true, name: true, surname: true, joiningDate: true, probationEndDate: true, probationClearedAt: true, status: true },
    });
    return emps.filter((e) => !this.isOnProbation(e, policyStart) && new Date(e.joiningDate) < cutoff);
  }

  /** Record a one-time "System, legacy" CONFIRM for an employee (no notification). */
  async confirmLegacy(employeeId: string): Promise<void> {
    await prisma.employee.update({ where: { id: employeeId }, data: { status: "ACTIVE", probationClearedAt: new Date() } });
    await prisma.probationDecision.create({ data: { employeeId, decision: "CONFIRM", reason: "System, legacy — joined before probation policy", decidedById: null } });
  }

  /** Full probation history for an employee (newest first). */
  async probationHistory(employeeId: string): Promise<any[]> {
    return prisma.probationDecision.findMany({ where: { employeeId, isDeleted: null }, orderBy: { createdAt: "desc" } });
  }

  /**
   * Record a probation decision. CONFIRM -> permanent (status ACTIVE, cleared). EXTEND -> new end date
   * (status PROBATION). TERMINATE -> status FIRE + auto-suspend the linked user (as on resignation).
   * Every decision writes a ProbationDecision row (who/when/why).
   */
  async decide(
    userId: string | undefined,
    employeeId: string,
    decision: ProbationDecision,
    opts: { newEndDate?: string | Date; reason?: string } = {}
  ): Promise<any> {
    const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!emp || emp.isDeleted) throw new AppError(404, "Employee not found.");
    if (userId) {
      const { canAccessEmployee } = await import("../../../AMS/Unit/helper/unitAccess.helper");
      if (!(await canAccessEmployee(userId, employeeId))) throw new AppError(403, "This employee is outside your units.");
    }
    const reason = (opts.reason || "").trim();
    const prevEnd = emp.probationEndDate ?? null;

    if (decision === "EXTEND") {
      if (!opts.newEndDate) throw new AppError(400, "A new end date is required to extend probation.");
      if (!reason) throw new AppError(400, "A reason is required to extend probation.");
      const newEnd = new Date(opts.newEndDate);
      await prisma.employee.update({ where: { id: employeeId }, data: { probationEndDate: newEnd, status: "PROBATION", probationClearedAt: null } });
      await this.recordDecision(employeeId, "EXTEND", prevEnd, newEnd, reason, userId);
    } else if (decision === "CONFIRM") {
      await prisma.employee.update({ where: { id: employeeId }, data: { status: "ACTIVE", probationClearedAt: new Date() } });
      await this.recordDecision(employeeId, "CONFIRM", prevEnd, null, reason, userId);
    } else if (decision === "TERMINATE") {
      if (!reason) throw new AppError(400, "A reason is required to terminate.");
      await prisma.employee.update({ where: { id: employeeId }, data: { status: "FIRE", resignationDate: new Date() } });
      await this.recordDecision(employeeId, "TERMINATE", prevEnd, null, reason, userId);
      await this.autoSuspendLinkedUser(employeeId, `probation terminated: ${reason}`);
    } else {
      throw new AppError(400, "Unknown decision.");
    }
    return { employeeId, decision, reason };
  }

  private async recordDecision(employeeId: string, decision: ProbationDecision, previousEndDate: Date | null, newEndDate: Date | null, reason: string, userId?: string): Promise<void> {
    await prisma.probationDecision.create({
      data: { employeeId, decision, previousEndDate, newEndDate, reason: reason || null, decidedById: userId ?? getActorId() ?? null },
    });
  }

  /** Suspend the linked user on terminate (mirrors employee RESIGNED/FIRE auto-suspend). */
  private async autoSuspendLinkedUser(employeeId: string, reason: string): Promise<void> {
    try {
      const user = await prisma.user.findFirst({ where: { employeeId, isDeleted: null, suspendedAt: null }, select: { id: true } });
      if (!user) return;
      await userModel.user.gpSuspend(user.id, getActorId());
      await logActivity({ userId: getActorId(), action: "AUTO_SUSPEND", entityType: "User", entityId: user.id, description: `Auto-suspended: ${reason}` } as any);
    } catch (e: any) {
      console.warn("[hrPolicy] autoSuspend failed:", e?.message || e);
    }
  }

  /** User ids of the HR managers to alert (configured role, else holders of hr.policy.manage.*). */
  async hrManagerUserIds(): Promise<string[]> {
    const settings = await getHrSettings();
    if (settings.hrManagerRoleName) {
      const role = await prisma.role.findFirst({ where: { name: settings.hrManagerRoleName, isDeleted: null }, select: { id: true } });
      if (role) {
        const urs = await prisma.userRole.findMany({
          where: { roleId: role.id, isDeleted: null, user: { isDeleted: null, suspendedAt: null } }, select: { userId: true },
        });
        return Array.from(new Set(urs.map((u) => u.userId)));
      }
    }
    const users = await prisma.user.findMany({ where: { isDeleted: null, suspendedAt: null }, select: { id: true } });
    const out: string[] = [];
    for (const u of users) {
      try { if (await accessModel.user.checkUserPermission(u.id, "hr.policy.manage.*")) out.push(u.id); } catch { /* ignore */ }
    }
    return out;
  }

  /**
   * Daily probation check (idempotent). Notifies HR managers when an employee's probation is exactly
   * 7 days away or ends today. Safe to run twice a day (same-day duplicate notifications are skipped).
   */
  async runProbationAlerts(): Promise<{ checked: number; notified: number }> {
    const due = await this.probationDue(undefined, 7); // all units (system run)
    if (!due.length) return { checked: 0, notified: 0 };
    const hrUsers = await this.hrManagerUserIds();
    if (!hrUsers.length) return { checked: due.length, notified: 0 };
    let notified = 0;
    const todayStart = startOfDay(new Date());
    for (const e of due) {
      // Two trigger points only: exactly 7 days out, or on/after the end date.
      const isEnded = e.dueInDays <= 0;
      if (!(e.dueInDays === 7 || isEnded)) continue;
      const title = isEnded ? "Probation ended" : "Probation ending in 7 days";
      const body = `${e.name} ${e.surname || ""}`.trim() + ` (${e.code}) — probation ${isEnded ? "ended" : "ends"} ${e.probationEnd.toISOString().slice(0, 10)}.`;
      // Idempotency: the "ended" alert fires once EVER (so long-overdue legacy staff aren't re-pinged
      // daily); the "7-day" reminder is deduped within the day.
      const already = await prisma.notification.findFirst({
        where: isEnded
          ? { type: "PROBATION_DUE", entityType: "Employee", entityId: e.id, title }
          : { type: "PROBATION_DUE", entityType: "Employee", entityId: e.id, title, createdAt: { gte: todayStart } },
      });
      if (already) continue;
      await notify(hrUsers, "PROBATION_DUE", title, body, "Employee", e.id);
      notified++;
    }
    return { checked: due.length, notified };
  }

  // ---- Shared read used by Reports (service length + band for an employee) ---------------------
  async employeePolicySnapshot(emp: { joiningDate: Date }, asOf: Date, rules?: any[]): Promise<{ years: number; band: string; medicalEligible: boolean }> {
    const r = rules ?? (await this.activeRules(asOf));
    const years = completedServiceYears(emp.joiningDate, asOf);
    const rule = applicableRule(r, years, asOf);
    return { years, band: bandLabel(rule), medicalEligible: rule?.medicalEligible ?? false };
  }
}

function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

export default HrPolicyService;
