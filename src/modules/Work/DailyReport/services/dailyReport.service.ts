import prisma from "../../../../core/models/base.model";
import { resolveWorkScope } from "../../shared/workScope";
import { notify, userIdsForEmployees, expectedReporters } from "../../shared/workHelpers";
import { AppError, NotFoundError, ForbiddenError } from "../../../../core/errors/app.error";

const LATE_HOUR = 18; // a report submitted after 18:00 local on its day is flagged late

const include = {
  employee: { select: { id: true, name: true, surname: true } },
  comments: { where: { isDeleted: null }, orderBy: { createdAt: "asc" as const } },
};

/** Midnight (local) of a date-or-today. */
function dayOf(dateStr?: string): Date {
  const d = dateStr ? new Date(dateStr) : new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

class DailyReportService {
  /** Employee id for a user (reports are authored by the logged-in employee). */
  private async myEmployee(userId: string): Promise<string> {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { employeeId: true } });
    if (!u?.employeeId) throw new ForbiddenError("your account is not linked to an employee");
    return u.employeeId;
  }

  /** Create or update today's report (one per employee per day). Editable the same day only. */
  async submit(userId: string, data: any) {
    const employeeId = await this.myEmployee(userId);
    const date = dayOf(data.date);
    if (!sameDay(date, new Date())) throw new ForbiddenError("daily reports can only be submitted or edited on the same day");
    const late = new Date().getHours() >= LATE_HOUR;
    const payload = {
      whatIDid: data.whatIDid ?? null, taskIds: data.taskIds ?? [], hours: data.hours != null ? Number(data.hours) : null,
      blockers: data.blockers ?? null, planTomorrow: data.planTomorrow ?? null, attachments: data.attachments ?? [],
    };
    const existing = await prisma.dailyReport.findUnique({ where: { employeeId_date: { employeeId, date } } });
    if (existing && existing.isDeleted) throw new NotFoundError("report not found");
    if (existing) {
      if (!sameDay(new Date(existing.date), new Date())) throw new ForbiddenError("this report is from another day and can no longer be edited");
      return prisma.dailyReport.update({ where: { id: existing.id }, data: payload, include });
    }
    return prisma.dailyReport.create({ data: { employeeId, date, late, ...payload }, include });
  }

  async myToday(userId: string, dateStr?: string) {
    const employeeId = await this.myEmployee(userId);
    const date = dayOf(dateStr);
    const r = await prisma.dailyReport.findUnique({ where: { employeeId_date: { employeeId, date } }, include });
    return r && !r.isDeleted ? r : null;
  }

  async get(userId: string, page = 1, pageSize = 30, filters: any = {}) {
    const scope = await resolveWorkScope(userId, "report");
    const w: Record<string, any> = {};
    if (filters.date) w.date = dayOf(filters.date);
    if (filters.employeeId) w.employeeId = filters.employeeId;
    if (filters.from || filters.to) { w.date = {}; if (filters.from) w.date.gte = dayOf(filters.from); if (filters.to) w.date.lte = dayOf(filters.to); }
    const where = { AND: [{ isDeleted: null }, w, scope.reportWhere] };
    const skip = (page - 1) * pageSize;
    const [data, totalSize] = await Promise.all([
      prisma.dailyReport.findMany({ where, include, skip, take: pageSize, orderBy: [{ date: "desc" }] }),
      prisma.dailyReport.count({ where }),
    ]);
    return { data, totalSize, scope: scope.mode };
  }

  /**
   * Manager view: who submitted vs who is missing for a given day, within the caller's scope.
   * Only required team members are expected; non-members are shown nowhere. Weekly offs and holidays
   * make the day non-working; members on approved leave are not counted as missing.
   */
  async compliance(userId: string, dateStr?: string) {
    const scope = await resolveWorkScope(userId, "report");
    const date = dayOf(dateStr);
    const exp = await expectedReporters({ mode: scope.mode, ledTeamIds: scope.ledTeamIds, employeeId: scope.employeeId }, date);
    if (exp.nonWorkingDay) return { date, nonWorkingDay: true, reason: exp.reason, total: 0, submitted: 0, onLeave: 0, missing: 0, rows: [] };
    const empIds = exp.employees.map((e) => e.id);
    const reports = empIds.length ? await prisma.dailyReport.findMany({ where: { date, isDeleted: null, employeeId: { in: empIds } }, select: { employeeId: true, hours: true, late: true } }) : [];
    const byEmp = new Map(reports.map((r) => [r.employeeId, r]));
    const rows = exp.employees.map((e) => {
      const r = byEmp.get(e.id);
      const submitted = !!r;
      const status = submitted ? (r!.late ? "late" : "submitted") : e.onLeave ? "leave" : "missing";
      return { employeeId: e.id, name: `${e.name} ${e.surname || ""}`.trim(), submitted, onLeave: e.onLeave, late: r?.late || false, hours: r?.hours ?? null, status };
    });
    return {
      date, nonWorkingDay: false,
      total: rows.length,
      submitted: rows.filter((r) => r.submitted).length,
      onLeave: rows.filter((r) => !r.submitted && r.onLeave).length,
      missing: rows.filter((r) => !r.submitted && !r.onLeave).length,
      rows,
    };
  }

  async addComment(userId: string, id: string, body: string) {
    const scope = await resolveWorkScope(userId, "report");
    const report = await prisma.dailyReport.findUnique({ where: { id } });
    if (!report || report.isDeleted) throw new NotFoundError("report not found");
    if (scope.mode !== "ALL" && scope.mode !== "TEAM" && report.employeeId !== scope.employeeId) throw new ForbiddenError("report is outside your scope");
    const c = await prisma.dailyReportComment.create({ data: { reportId: id, userId, body } });
    await notify((await userIdsForEmployees([report.employeeId])).filter((u) => u !== userId), "COMMENT", "Comment on your daily report", body.slice(0, 120), "DailyReport", id);
    return c;
  }
}

export default DailyReportService;
