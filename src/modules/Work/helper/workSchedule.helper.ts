/**
 * Work module scheduled notifications. Runs once a day for due-soon/overdue task reminders and once
 * in the evening for the "daily report missing" reminder. All DB work is sequential and wrapped in
 * try/catch so a failure can never leak an unhandled rejection (see NIGHT_LOG Run 8).
 */
import schedule from "node-schedule";
import prisma from "../../../core/models/base.model";
import { notify, userIdsForEmployees, expectedReporters } from "../shared/workHelpers";
import { runAsSystem } from "../../../core/context/requestContext";

const REPORT_REMINDER_HOUR = 18; // configurable: when to remind employees who have not submitted

class WorkSchedulerHelper {
  constructor() {
    // 08:00 daily: due-soon + overdue task reminders
    schedule.scheduleJob("0 8 * * *", () => { runAsSystem(() => this.taskReminders()).catch((e) => console.error("[work] taskReminders error:", e?.message || e)); });
    // configured hour: daily-report missing reminder
    schedule.scheduleJob(`0 ${REPORT_REMINDER_HOUR} * * *`, () => { runAsSystem(() => this.reportMissing()).catch((e) => console.error("[work] reportMissing error:", e?.message || e)); });
  }

  private async taskReminders() {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 3600 * 1000);
    // Open tasks (exclude those already stamped completed). "Done" per team is the last status.
    const soon = await prisma.task.findMany({ where: { isDeleted: null, completedAt: null, dueDate: { gte: now, lte: in24h } }, include: { team: { select: { statuses: true } }, assignees: true } });
    const overdue = await prisma.task.findMany({ where: { isDeleted: null, completedAt: null, dueDate: { lt: now } }, include: { team: { select: { statuses: true } }, assignees: true } });
    const notDone = (t: any) => { const s = t.team?.statuses || []; const done = s.length ? s[s.length - 1] : "DONE"; return t.status !== done; };
    for (const t of soon.filter(notDone)) {
      try { await notify(await userIdsForEmployees(t.assignees.map((a: any) => a.employeeId)), "DUE_SOON", `Due soon: ${t.title}`, t.code || "", "Task", t.id); } catch (e: any) { console.error("[work] due-soon notify failed:", e?.message || e); }
    }
    for (const t of overdue.filter(notDone)) {
      try { await notify(await userIdsForEmployees(t.assignees.map((a: any) => a.employeeId)), "OVERDUE", `Overdue: ${t.title}`, t.code || "", "Task", t.id); } catch (e: any) { console.error("[work] overdue notify failed:", e?.message || e); }
    }
  }

  private async reportMissing() {
    const today = new Date();
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    // Only REQUIRED team members are expected. A weekly off / holiday makes it non-working (skip);
    // members on approved leave or who already submitted are not reminded.
    const exp = await expectedReporters({ mode: "ALL", ledTeamIds: [], employeeId: null }, date);
    if (exp.nonWorkingDay) return;
    const empIds = exp.employees.filter((e) => !e.onLeave).map((e) => e.id);
    if (!empIds.length) return;
    const submitted = new Set((await prisma.dailyReport.findMany({ where: { date, isDeleted: null, employeeId: { in: empIds } }, select: { employeeId: true } })).map((r) => r.employeeId));
    const missingEmpIds = empIds.filter((id) => !submitted.has(id));
    const users = await prisma.user.findMany({ where: { isDeleted: null, employeeId: { in: missingEmpIds } }, select: { id: true } });
    for (const u of users) {
      try { await notify([u.id], "REPORT_MISSING", "Daily report missing", "Please submit your daily report for today.", "DailyReport"); } catch (e: any) { console.error("[work] report-missing notify failed:", e?.message || e); }
    }
  }
}

export default new WorkSchedulerHelper();
