/**
 * Quick Mark Reports — server-side attendance/HR report calculations, all scoped to the caller's
 * accessible units (ams.viewAll.unit sees all). Heavy reports are computed with a handful of batched
 * queries (not per-employee) and paginated/totalled in memory so the numbers are always consistent.
 */
import prisma from "../../../../core/models/base.model";
import { formatInTimeZone } from "date-fns-tz";
import { getAccessibleEmployeeIds, getAccessibleUnitIds } from "../../Unit/helper/unitAccess.helper";
import SystemConfigService from "../../SystemConfig/services/systemConfig.service";
import HrPolicyService from "../../../HR/Policy/services/hrPolicy.service";
import { EXPORT_CAP } from "../../../../core/export/tableExport";

const TZ = "Asia/Karachi";
const STATUS = ["PRESENT", "LATE", "HALF_DAY", "ABSENT", "ON_LEAVE", "HOLIDAYS"] as const;

export interface MonthlyFilters {
  year: number; month: number; // month 1-12
  unitId?: string; department?: string; company?: string; status?: string;
}

function monthRange(year: number, month: number): { start: Date; end: Date } {
  // month is 1-12. Use local (server TZ is Asia/Karachi) day boundaries.
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}
function yearRange(year: number): { start: Date; end: Date } {
  return { start: new Date(year, 0, 1, 0, 0, 0, 0), end: new Date(year, 11, 31, 23, 59, 59, 999) };
}
function serviceLength(joining: Date, asOf: Date): string {
  let months = (asOf.getFullYear() - joining.getFullYear()) * 12 + (asOf.getMonth() - joining.getMonth());
  if (asOf.getDate() < joining.getDate()) months -= 1;
  months = Math.max(0, months);
  const y = Math.floor(months / 12), m = months % 12;
  return `${y}y ${m}m`;
}
function minutesBetween(a: Date, b: Date): number { return Math.round((a.getTime() - b.getTime()) / 60000); }
/** Build a Date at the time-of-day of `timeOfDay` on the calendar day of `date`, in server TZ. */
function timeOnDate(date: Date, timeOfDay: Date): Date {
  const t = new Date(timeOfDay);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), t.getHours(), t.getMinutes(), t.getSeconds(), 0);
}

class AmsReportService {
  private hr = new HrPolicyService();

  /** Resolve the scoped + filtered employee set for a report (returns null-safe id list + records). */
  private async scopedEmployees(userId: string | undefined, f: { unitId?: string; department?: string; company?: string; status?: string }): Promise<any[]> {
    const scope = userId ? await getAccessibleEmployeeIds(userId) : null;
    if (scope !== null && scope.length === 0) return [];
    const where: any = { isDeleted: null };
    if (scope !== null) where.id = { in: scope };
    if (f.department) where.department = f.department;
    if (f.company) where.company = f.company;
    if (f.status) where.status = f.status;
    if (f.unitId) where.unitEmployees = { some: { unitId: f.unitId, isDeleted: null } };
    return prisma.employee.findMany({
      where,
      select: {
        id: true, code: true, name: true, surname: true, department: true, designation: true,
        joiningDate: true, status: true, probationEndDate: true, probationClearedAt: true,
      },
      orderBy: [{ department: "asc" }, { name: "asc" }],
      take: EXPORT_CAP + 1,
    });
  }

  // ====== 1. MONTHLY EMPLOYEE REPORT ============================================================
  /** Compute every monthly row for the filtered set (used for screen pagination AND export). */
  async monthlyRows(userId: string | undefined, f: MonthlyFilters): Promise<{ rows: any[]; totals: any; capped: boolean }> {
    const emps = await this.scopedEmployees(userId, f);
    const capped = emps.length > EXPORT_CAP;
    const list = capped ? emps.slice(0, EXPORT_CAP) : emps;
    if (!list.length) return { rows: [], totals: this.emptyTotals(), capped };
    const empIds = list.map((e) => e.id);
    const { start, end } = monthRange(f.year, f.month);
    const yr = yearRange(f.year);
    const now = new Date();
    const yearEnd = yr.end < now ? yr.end : now;

    // Batched datasets.
    const [attendance, shiftAssignments, leavesYear, remarks, unitLinks, holidays, rules, settings] = await Promise.all([
      prisma.attendance.findMany({ where: { employeeId: { in: empIds }, isDeleted: null, date: { gte: start, lte: end } }, select: { employeeId: true, date: true, status: true, checkIn: true, checkOut: true } }),
      prisma.shiftAssignment.findMany({ where: { employeeId: { in: empIds }, isDeleted: null, shift: { isDeleted: null }, startDate: { lte: end }, OR: [{ endDate: null }, { endDate: { gte: start } }] }, select: { employeeId: true, shift: { select: { startTime: true, endTime: true } } } }),
      prisma.leaveRequest.findMany({ where: { employeeId: { in: empIds }, isDeleted: null, status: "APPROVED", startDate: { lte: yr.end }, endDate: { gte: yr.start } }, select: { employeeId: true, startDate: true, endDate: true, leaveType: true } }),
      prisma.monthlyReportRemark.findMany({ where: { employeeId: { in: empIds }, isDeleted: null, year: f.year, month: f.month }, select: { employeeId: true, remark: true } }),
      prisma.unitEmployee.findMany({ where: { employeeId: { in: empIds }, isDeleted: null, unit: { isDeleted: null } }, select: { employeeId: true, unit: { select: { name: true } } } }),
      prisma.holiday.findMany({ where: { isActive: true, isDeleted: null, date: { lte: end }, OR: [{ endDate: null, date: { gte: start } }, { endDate: { gte: start } }] }, select: { date: true, endDate: true, type: true, unitIds: true } }),
      this.hr.activeRules(end),
      this.hr.getSettings(),
    ]);

    const [lateGrace, halfGrace] = await Promise.all([SystemConfigService.getLateGraceMinutes(), SystemConfigService.getHalfDayLateMinutes()]);

    // Index datasets by employee.
    const attByEmp = groupBy(attendance, (a) => a.employeeId);
    const shiftByEmp = new Map<string, { startTime: Date; endTime: Date }>();
    for (const s of shiftAssignments) if (s.shift && !shiftByEmp.has(s.employeeId)) shiftByEmp.set(s.employeeId, s.shift as any);
    const leavesByEmp = groupBy(leavesYear, (l) => l.employeeId);
    const remarkByEmp = new Map(remarks.map((r) => [r.employeeId, r.remark]));
    const unitByEmp = new Map<string, string>();
    for (const u of unitLinks) if (u.unit && !unitByEmp.has(u.employeeId)) unitByEmp.set(u.employeeId, u.unit.name);

    // Holidays / weekly offs (Sundays) that fall in the month, applicable to an employee's unit.
    const monthHolidayDates = this.holidayDaysInMonth(holidays, f.year, f.month);
    const sundays = this.sundaysInMonth(f.year, f.month);

    const rows: any[] = [];
    const totals = this.emptyTotals();

    for (const e of list) {
      const att = attByEmp.get(e.id) || [];
      const shift = shiftByEmp.get(e.id);
      const counts: Record<string, number> = { PRESENT: 0, LATE: 0, HALF_DAY: 0, ABSENT: 0, ON_LEAVE: 0, HOLIDAYS: 0 };
      let lateMinutes = 0;
      let earlyLeaves = 0;
      for (const a of att) {
        counts[a.status] = (counts[a.status] || 0) + 1;
        if ((a.status === "LATE" || a.status === "HALF_DAY") && a.checkIn && shift) {
          const expected = timeOnDate(new Date(a.date), new Date(shift.startTime));
          const mins = minutesBetween(new Date(a.checkIn), expected);
          if (mins > lateGrace) lateMinutes += mins;
        }
        if (a.checkOut && shift) {
          const expectedEnd = timeOnDate(new Date(a.date), new Date(shift.endTime));
          if (minutesBetween(expectedEnd, new Date(a.checkOut)) > 30) earlyLeaves += 1; // left >30m early
        }
      }

      // Leave days this month (by type) + leaves taken this year.
      const lv = leavesByEmp.get(e.id) || [];
      const leavesThisMonthByType: Record<string, number> = {};
      let leavesTakenYear = 0;
      for (const l of lv) {
        const inMonth = overlapDays(new Date(l.startDate), new Date(l.endDate), start, end);
        if (inMonth > 0) { const t = (l.leaveType || "CASUAL").toUpperCase(); leavesThisMonthByType[t] = (leavesThisMonthByType[t] || 0) + inMonth; }
        leavesTakenYear += overlapDays(new Date(l.startDate), new Date(l.endDate), yr.start, yearEnd);
      }

      // Entitlement + remaining (policy for the year) + medical eligibility (band).
      const ent = await this.hr.previewEntitlement(e.id, f.year).catch(() => null);
      const entitlement = ent?.annualLeaveDays ?? 0;
      const medicalEligible = ent?.medicalEligible ?? false;
      const snap = await this.hr.employeePolicySnapshot(e, end, rules);

      // Holidays / weekly offs applicable to this employee's unit.
      const empUnit = unitByEmp.get(e.id) || null;
      const holidayCount = monthHolidayDates.length + sundays; // calendar holidays + weekly offs

      const row = {
        employeeId: e.id, code: e.code, name: `${e.name} ${e.surname || ""}`.trim(),
        department: e.department, designation: e.designation, unit: empUnit || "—",
        joiningDate: e.joiningDate, serviceLength: serviceLength(new Date(e.joiningDate), end),
        policyGroup: snap.band, status: e.status,
        presentDays: counts.PRESENT, lateDays: counts.LATE, totalLateMinutes: lateMinutes,
        halfDays: counts.HALF_DAY, absentDays: counts.ABSENT, onLeaveDays: counts.ON_LEAVE,
        leavesThisMonthByType, leavesThisMonth: Object.values(leavesThisMonthByType).reduce((s, n) => s + n, 0),
        leavesTakenYear, leaveEntitlementYear: entitlement, remainingLeaveYear: Math.max(0, entitlement - leavesTakenYear),
        medicalEligible, holidaysWeeklyOffs: holidayCount, shortEarlyLeaves: earlyLeaves,
        remark: remarkByEmp.get(e.id) || "",
      };
      rows.push(row);

      totals.presentDays += row.presentDays; totals.lateDays += row.lateDays; totals.totalLateMinutes += row.totalLateMinutes;
      totals.halfDays += row.halfDays; totals.absentDays += row.absentDays; totals.onLeaveDays += row.onLeaveDays;
      totals.leavesThisMonth += row.leavesThisMonth; totals.leavesTakenYear += row.leavesTakenYear;
      totals.leaveEntitlementYear += row.leaveEntitlementYear; totals.remainingLeaveYear += row.remainingLeaveYear;
      totals.shortEarlyLeaves += row.shortEarlyLeaves; totals.employees += 1;
    }
    return { rows, totals, capped };
  }

  /** Screen view: a single page of the monthly report + totals across the whole filtered set. */
  async monthlyPaged(userId: string | undefined, f: MonthlyFilters, page = 1, pageSize = 25): Promise<any> {
    const { rows, totals, capped } = await this.monthlyRows(userId, f);
    const p = Math.max(1, page), ps = Math.min(200, Math.max(1, pageSize));
    const startIdx = (p - 1) * ps;
    return { data: rows.slice(startIdx, startIdx + ps), totalSize: rows.length, totals, capped, page: p, pageSize: ps };
  }

  /** One employee's monthly slip (for the per-employee download). */
  async monthlySlip(userId: string | undefined, employeeId: string, year: number, month: number): Promise<any> {
    const { rows } = await this.monthlyRows(userId, { year, month, status: undefined } as any);
    const row = rows.find((r) => r.employeeId === employeeId);
    if (!row) {
      // Not in the unfiltered scope set — compute just this one (still unit-checked).
      const single = await this.monthlyRows(userId, { year, month } as any);
      return single.rows.find((r) => r.employeeId === employeeId) || null;
    }
    return row;
  }

  async saveRemark(userId: string | undefined, employeeId: string, year: number, month: number, remark: string): Promise<any> {
    if (userId) {
      const { canAccessEmployee } = await import("../../Unit/helper/unitAccess.helper");
      if (!(await canAccessEmployee(userId, employeeId))) throw new Error("This employee is outside your units.");
    }
    const existing = await prisma.monthlyReportRemark.findFirst({ where: { employeeId, year, month, isDeleted: null } });
    if (existing) return prisma.monthlyReportRemark.update({ where: { id: existing.id }, data: { remark: remark || "" } });
    return prisma.monthlyReportRemark.create({ data: { employeeId, year, month, remark: remark || "" } });
  }

  private emptyTotals() {
    return { employees: 0, presentDays: 0, lateDays: 0, totalLateMinutes: 0, halfDays: 0, absentDays: 0, onLeaveDays: 0, leavesThisMonth: 0, leavesTakenYear: 0, leaveEntitlementYear: 0, remainingLeaveYear: 0, shortEarlyLeaves: 0 };
  }
  private sundaysInMonth(year: number, month: number): number {
    const { end } = monthRange(year, month);
    let c = 0;
    for (let d = 1; d <= end.getDate(); d++) if (new Date(year, month - 1, d).getDay() === 0) c++;
    return c;
  }
  private holidayDaysInMonth(holidays: any[], year: number, month: number): string[] {
    const { start, end } = monthRange(year, month);
    const set = new Set<string>();
    for (const h of holidays) {
      const hs = new Date(h.date); const he = h.endDate ? new Date(h.endDate) : new Date(h.date);
      const cur = new Date(Math.max(hs.getTime(), start.getTime()));
      const last = new Date(Math.min(he.getTime(), end.getTime()));
      while (cur <= last) {
        if (cur.getDay() !== 0) set.add(formatInTimeZone(cur, TZ, "yyyy-MM-dd")); // Sundays counted separately
        cur.setDate(cur.getDate() + 1);
      }
    }
    return Array.from(set);
  }

  // ====== 2. DAILY ATTENDANCE SUMMARY (date range) =============================================
  async dailySummary(userId: string | undefined, f: { from: string; to: string; unitId?: string; department?: string; company?: string }): Promise<any[]> {
    const emps = await this.scopedEmployees(userId, f);
    if (!emps.length) return [];
    const empIds = emps.map((e) => e.id);
    const from = new Date(f.from); from.setHours(0, 0, 0, 0);
    const to = new Date(f.to); to.setHours(23, 59, 59, 999);
    const rows = await prisma.attendance.findMany({ where: { employeeId: { in: empIds }, isDeleted: null, date: { gte: from, lte: to } }, select: { date: true, status: true } });
    const byDay = new Map<string, Record<string, number>>();
    for (const r of rows) {
      const key = formatInTimeZone(new Date(r.date), TZ, "yyyy-MM-dd");
      const rec = byDay.get(key) || { PRESENT: 0, LATE: 0, HALF_DAY: 0, ABSENT: 0, ON_LEAVE: 0, HOLIDAYS: 0 };
      rec[r.status] = (rec[r.status] || 0) + 1; byDay.set(key, rec);
    }
    return Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([date, c]) => ({
      date, present: c.PRESENT, late: c.LATE, halfDay: c.HALF_DAY, absent: c.ABSENT, onLeave: c.ON_LEAVE,
      total: c.PRESENT + c.LATE + c.HALF_DAY + c.ABSENT + c.ON_LEAVE,
    }));
  }

  // ====== 3. LATE COMERS (date range) =========================================================
  async lateComers(userId: string | undefined, f: { from: string; to: string; unitId?: string; department?: string; company?: string }): Promise<any[]> {
    const emps = await this.scopedEmployees(userId, f);
    if (!emps.length) return [];
    const empById = new Map(emps.map((e) => [e.id, e]));
    const empIds = emps.map((e) => e.id);
    const from = new Date(f.from); from.setHours(0, 0, 0, 0);
    const to = new Date(f.to); to.setHours(23, 59, 59, 999);
    const [rows, shiftAssignments, lateGrace] = await Promise.all([
      prisma.attendance.findMany({ where: { employeeId: { in: empIds }, isDeleted: null, status: { in: ["LATE", "HALF_DAY"] }, date: { gte: from, lte: to } }, select: { employeeId: true, date: true, checkIn: true, status: true } }),
      prisma.shiftAssignment.findMany({ where: { employeeId: { in: empIds }, isDeleted: null, shift: { isDeleted: null } }, select: { employeeId: true, shift: { select: { startTime: true } } } }),
      SystemConfigService.getLateGraceMinutes(),
    ]);
    const shiftByEmp = new Map<string, Date>();
    for (const s of shiftAssignments) if (s.shift && !shiftByEmp.has(s.employeeId)) shiftByEmp.set(s.employeeId, s.shift.startTime);
    const out: any[] = [];
    for (const r of rows) {
      const e = empById.get(r.employeeId); if (!e) continue;
      const st = shiftByEmp.get(r.employeeId);
      let mins = 0;
      if (st && r.checkIn) mins = Math.max(0, minutesBetween(new Date(r.checkIn), timeOnDate(new Date(r.date), new Date(st))));
      out.push({ code: e.code, name: `${e.name} ${e.surname || ""}`.trim(), department: e.department, date: formatInTimeZone(new Date(r.date), TZ, "yyyy-MM-dd"), checkIn: r.checkIn ? formatInTimeZone(new Date(r.checkIn), TZ, "HH:mm") : "—", lateMinutes: mins, status: r.status });
    }
    return out.sort((a, b) => a.date.localeCompare(b.date) || b.lateMinutes - a.lateMinutes);
  }

  // ====== 4. ABSENTEE LIST (date or range) ====================================================
  async absentees(userId: string | undefined, f: { from: string; to: string; unitId?: string; department?: string; company?: string }): Promise<any[]> {
    const emps = await this.scopedEmployees(userId, f);
    if (!emps.length) return [];
    const empById = new Map(emps.map((e) => [e.id, e]));
    const empIds = emps.map((e) => e.id);
    const from = new Date(f.from); from.setHours(0, 0, 0, 0);
    const to = new Date(f.to); to.setHours(23, 59, 59, 999);
    const rows = await prisma.attendance.findMany({ where: { employeeId: { in: empIds }, isDeleted: null, status: "ABSENT", date: { gte: from, lte: to } }, select: { employeeId: true, date: true } });
    return rows.map((r) => { const e = empById.get(r.employeeId); return e ? { code: e.code, name: `${e.name} ${e.surname || ""}`.trim(), department: e.department, designation: e.designation, date: formatInTimeZone(new Date(r.date), TZ, "yyyy-MM-dd") } : null; })
      .filter(Boolean).sort((a: any, b: any) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name)) as any[];
  }

  // ====== 5. LEAVE BALANCE (all employees, this year) =========================================
  async leaveBalance(userId: string | undefined, f: { year?: number; unitId?: string; department?: string; company?: string }): Promise<any[]> {
    const year = f.year || new Date().getFullYear();
    const emps = await this.scopedEmployees(userId, f);
    if (!emps.length) return [];
    const empIds = emps.map((e) => e.id);
    const yr = yearRange(year); const now = new Date(); const yearEnd = yr.end < now ? yr.end : now;
    const leaves = await prisma.leaveRequest.findMany({ where: { employeeId: { in: empIds }, isDeleted: null, status: "APPROVED", startDate: { lte: yr.end }, endDate: { gte: yr.start } }, select: { employeeId: true, startDate: true, endDate: true } });
    const takenByEmp = new Map<string, number>();
    for (const l of leaves) takenByEmp.set(l.employeeId, (takenByEmp.get(l.employeeId) || 0) + overlapDays(new Date(l.startDate), new Date(l.endDate), yr.start, yearEnd));
    const out: any[] = [];
    for (const e of emps) {
      const ent = await this.hr.previewEntitlement(e.id, year).catch(() => null);
      const entitlement = ent?.annualLeaveDays ?? 0; const taken = takenByEmp.get(e.id) || 0;
      out.push({ code: e.code, name: `${e.name} ${e.surname || ""}`.trim(), department: e.department, entitlement, taken, remaining: Math.max(0, entitlement - taken), medicalEligible: ent?.medicalEligible ?? false });
    }
    return out;
  }

  // ====== 6. ATTENDANCE BY UNIT (month) =======================================================
  async attendanceByUnit(userId: string | undefined, f: MonthlyFilters): Promise<any[]> {
    const unitIds = userId ? await getAccessibleUnitIds(userId, "ams.viewAll.unit.*") : null;
    const units = await prisma.unit.findMany({ where: { isDeleted: null, ...(unitIds !== null ? { id: { in: unitIds } } : {}), ...(f.unitId ? { id: f.unitId } : {}) }, select: { id: true, name: true, employees: { where: { isDeleted: null }, select: { employeeId: true } } } });
    const { start, end } = monthRange(f.year, f.month);
    const out: any[] = [];
    for (const u of units) {
      const empIds = u.employees.map((e) => e.employeeId);
      if (!empIds.length) { out.push({ unit: u.name, employees: 0, present: 0, late: 0, halfDay: 0, absent: 0, onLeave: 0 }); continue; }
      const rows = await prisma.attendance.groupBy({ by: ["status"], where: { employeeId: { in: empIds }, isDeleted: null, date: { gte: start, lte: end } }, _count: { _all: true } });
      const c: Record<string, number> = {}; for (const r of rows) c[r.status] = (r._count as any)._all;
      out.push({ unit: u.name, employees: empIds.length, present: c.PRESENT || 0, late: c.LATE || 0, halfDay: c.HALF_DAY || 0, absent: c.ABSENT || 0, onLeave: c.ON_LEAVE || 0 });
    }
    return out.sort((a, b) => a.unit.localeCompare(b.unit));
  }

  // ====== 7. PROBATION DUE (reuse HR service, unit-scoped) =====================================
  async probationDue(userId: string | undefined, withinDays = 30): Promise<any[]> {
    const rows = await this.hr.probationDue(userId, withinDays);
    return rows.map((e: any) => ({ code: e.code, name: `${e.name} ${e.surname || ""}`.trim(), department: e.department, designation: e.designation, joiningDate: e.joiningDate, probationEnd: e.probationEnd, dueInDays: e.dueInDays, overdue: e.overdue, employeeId: e.id }));
  }
}

function groupBy<T>(arr: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of arr) { const k = key(x); const a = m.get(k); if (a) a.push(x); else m.set(k, [x]); }
  return m;
}
/** Whole days of [s,e] that fall within [winStart, winEnd], inclusive. */
function overlapDays(s: Date, e: Date, winStart: Date, winEnd: Date): number {
  const start = s > winStart ? s : winStart;
  const end = e < winEnd ? e : winEnd;
  if (end < start) return 0;
  return Math.floor((startOfDay(end).getTime() - startOfDay(start).getTime()) / (24 * 60 * 60 * 1000)) + 1;
}
function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

export default AmsReportService;
