import prisma from "../../../../core/models/base.model";
import { resolveWorkScope } from "../../shared/workScope";
import { expectedReporters } from "../../shared/workHelpers";

const empName = (e: any) => (e ? `${e.name} ${e.surname || ""}`.trim() : "Unassigned");

class WorkReportService {
  private async tasks(userId: string, extra: Record<string, any> = {}) {
    const scope = await resolveWorkScope(userId, "task");
    return prisma.task.findMany({
      where: { AND: [{ isDeleted: null }, extra, scope.taskWhere] },
      include: { team: { select: { id: true, name: true, statuses: true } }, assignees: { include: { employee: { select: { id: true, name: true, surname: true } } } } },
    });
  }

  /** Completion rate overall and per team. Done = last status of the task's team (or DONE). */
  async completion(userId: string, f: any = {}) {
    const rows = await this.tasks(userId, f.teamId ? { teamId: f.teamId } : {});
    const isDone = (t: any) => { const s = t.team?.statuses || []; const done = s.length ? s[s.length - 1] : "DONE"; return t.status === done || !!t.completedAt; };
    const byTeam = new Map<string, { team: string; total: number; done: number }>();
    let total = 0, done = 0;
    for (const t of rows) {
      total++; const d = isDone(t); if (d) done++;
      const key = t.team?.name || "No team";
      const e = byTeam.get(key) || { team: key, total: 0, done: 0 }; e.total++; if (d) e.done++; byTeam.set(key, e);
    }
    return {
      overall: { total, done, completionPct: total ? Math.round((done / total) * 100) : 0 },
      byTeam: Array.from(byTeam.values()).map((x) => ({ ...x, completionPct: x.total ? Math.round((x.done / x.total) * 100) : 0 })),
    };
  }

  /** Overdue (dueDate < now and not done) by person and by team. */
  async overdue(userId: string, f: any = {}) {
    const rows = await this.tasks(userId, { dueDate: { lt: new Date() } });
    const open = rows.filter((t: any) => { const s = t.team?.statuses || []; const done = s.length ? s[s.length - 1] : "DONE"; return t.status !== done && !t.completedAt; });
    const byPerson = new Map<string, { person: string; count: number }>();
    const byTeam = new Map<string, { team: string; count: number }>();
    for (const t of open) {
      const team = t.team?.name || "No team"; const te = byTeam.get(team) || { team, count: 0 }; te.count++; byTeam.set(team, te);
      const assignees = t.assignees.length ? t.assignees : [{ employee: null }];
      for (const a of assignees) { const p = empName(a.employee); const pe = byPerson.get(p) || { person: p, count: 0 }; pe.count++; byPerson.set(p, pe); }
    }
    return { total: open.length, byPerson: Array.from(byPerson.values()).sort((a, b) => b.count - a.count), byTeam: Array.from(byTeam.values()).sort((a, b) => b.count - a.count) };
  }

  /** Average time to complete (completedAt - createdAt), overall and per team. */
  async timeToComplete(userId: string, f: any = {}) {
    const rows = (await this.tasks(userId, { completedAt: { not: null } })).filter((t: any) => t.completedAt && t.createdAt);
    const days = (t: any) => (new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime()) / 86400000;
    const byTeam = new Map<string, number[]>();
    const all: number[] = [];
    for (const t of rows) { const d = days(t); all.push(d); const k = t.team?.name || "No team"; byTeam.set(k, [...(byTeam.get(k) || []), d]); }
    const avg = (a: number[]) => (a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : 0);
    return { overallAvgDays: avg(all), completed: all.length, byTeam: Array.from(byTeam.entries()).map(([team, a]) => ({ team, completed: a.length, avgDays: avg(a) })) };
  }

  /** Workload = open (not-done) tasks per person. */
  async workload(userId: string, f: any = {}) {
    const rows = await this.tasks(userId);
    const open = rows.filter((t: any) => { const s = t.team?.statuses || []; const done = s.length ? s[s.length - 1] : "DONE"; return t.status !== done && !t.completedAt; });
    const byPerson = new Map<string, { person: string; open: number; overdue: number }>();
    const now = Date.now();
    for (const t of open) {
      const assignees = t.assignees.length ? t.assignees : [{ employee: null }];
      for (const a of assignees) { const p = empName(a.employee); const pe = byPerson.get(p) || { person: p, open: 0, overdue: 0 }; pe.open++; if (t.dueDate && new Date(t.dueDate).getTime() < now) pe.overdue++; byPerson.set(p, pe); }
    }
    return { byPerson: Array.from(byPerson.values()).sort((a, b) => b.open - a.open) };
  }

  /**
   * Daily-report compliance over a date range. Per day: only required team members (within scope)
   * are expected; weekly offs and holidays are non-working (not counted); members on approved leave
   * are not counted as missing.
   */
  async compliance(userId: string, f: any = {}) {
    const scope = await resolveWorkScope(userId, "report");
    const to = f.to ? new Date(f.to) : new Date();
    const from = f.from ? new Date(f.from) : new Date(to.getTime() - 6 * 86400000);
    const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
    const rows: any[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = new Date(d);
      const exp = await expectedReporters({ mode: scope.mode, ledTeamIds: scope.ledTeamIds, employeeId: scope.employeeId }, day);
      const k = day.toISOString().slice(0, 10);
      if (exp.nonWorkingDay) { rows.push({ date: k, nonWorking: true, reason: exp.reason, expected: 0, submitted: 0, missing: 0, compliancePct: 100 }); continue; }
      const empIds = exp.employees.map((e) => e.id);
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      const submittedIds = new Set(empIds.length ? (await prisma.dailyReport.findMany({ where: { isDeleted: null, employeeId: { in: empIds }, date: dayStart }, select: { employeeId: true } })).map((r) => r.employeeId) : []);
      const expected = exp.employees.filter((e) => !e.onLeave).length; // on-leave not expected to submit
      const submitted = exp.employees.filter((e) => submittedIds.has(e.id)).length;
      rows.push({ date: k, expected, submitted, onLeave: exp.employees.filter((e) => e.onLeave).length, missing: Math.max(0, expected - submitted), compliancePct: expected ? Math.round((submitted / expected) * 100) : 100 });
    }
    return { rows };
  }

  /** Hours logged per person and per team over a date range. */
  async hours(userId: string, f: any = {}) {
    const scope = await resolveWorkScope(userId, "report");
    const to = f.to ? new Date(f.to) : new Date();
    const from = f.from ? new Date(f.from) : new Date(to.getTime() - 29 * 86400000);
    const reports = await prisma.dailyReport.findMany({ where: { AND: [{ isDeleted: null, date: { gte: from, lte: to } }, scope.reportWhere] }, include: { employee: { select: { name: true, surname: true } } } });
    const byPerson = new Map<string, number>();
    let total = 0;
    for (const r of reports) { const p = empName(r.employee); const h = r.hours || 0; byPerson.set(p, (byPerson.get(p) || 0) + h); total += h; }
    return { totalHours: +total.toFixed(1), byPerson: Array.from(byPerson.entries()).map(([person, h]) => ({ person, hours: +h.toFixed(1) })).sort((a, b) => b.hours - a.hours) };
  }
}

export default WorkReportService;
