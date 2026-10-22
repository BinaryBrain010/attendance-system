/** Small shared helpers for the Work module: task codes, notifications, recurrence. */
import prisma from "../../../core/models/base.model";

/** Next task code TASK-0001. */
export async function nextTaskCode(): Promise<string> {
  const rows = await prisma.task.findMany({ where: { code: { startsWith: "TASK-" } }, select: { code: true } });
  let max = 0;
  for (const r of rows) { const m = (r.code || "").match(/(\d+)/); if (m) max = Math.max(max, parseInt(m[1], 10)); }
  return `TASK-${String(max + 1).padStart(4, "0")}`;
}

export type NotifType =
  | "ASSIGNED" | "DUE_SOON" | "OVERDUE" | "COMMENT" | "REPORT_MISSING"
  // CRM (leads): unassigned-lead alert to managers, lead transfer, @mention.
  | "LEAD_UNASSIGNED" | "LEAD_TRANSFER" | "MENTION"
  // Frontdesk (6b): a visitor was referred to this employee.
  | "VISITOR";

/** Create a notification for each recipient User id (deduped, skips empties). */
export async function notify(userIds: (string | null | undefined)[], type: NotifType, title: string, body?: string, entityType?: string, entityId?: string): Promise<void> {
  const ids = Array.from(new Set(userIds.filter((u): u is string => !!u)));
  if (!ids.length) return;
  try {
    await prisma.notification.createMany({ data: ids.map((userId) => ({ userId, type, title, body: body ?? null, entityType: entityType ?? null, entityId: entityId ?? null })) });
  } catch { /* notifications are best-effort */ }
}

/** Resolve the User ids for a set of employee ids (for notifying assignees/watchers). */
export async function userIdsForEmployees(employeeIds: string[]): Promise<string[]> {
  if (!employeeIds.length) return [];
  const users = await prisma.user.findMany({ where: { employeeId: { in: employeeIds }, isDeleted: null }, select: { id: true } });
  return users.map((u) => u.id);
}

function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function endOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999); }

export interface ExpectedResult {
  nonWorkingDay: boolean;
  reason?: string;
  employees: { id: string; name: string; surname: string | null; onLeave: boolean }[];
}

/**
 * Who is EXPECTED to file a daily report on `date`, within the caller's scope. Only team members
 * with requiresDailyReport = true are expected; non-members appear nowhere. A weekly off (Sunday) or
 * an active Holiday makes the whole day non-working (nobody expected). Members on APPROVED leave that
 * day are returned with onLeave=true so callers can exclude them from "missing".
 */
export async function expectedReporters(
  scope: { mode: string; ledTeamIds: string[]; employeeId: string | null },
  date: Date
): Promise<ExpectedResult> {
  if (date.getDay() === 0) return { nonWorkingDay: true, reason: "Weekly off (Sunday)", employees: [] };
  const hol = await prisma.holiday.findFirst({ where: { isActive: true, isDeleted: null, date: { gte: startOfDay(date), lte: endOfDay(date) } }, select: { reason: true } });
  if (hol) return { nonWorkingDay: true, reason: hol.reason ? `Holiday: ${hol.reason}` : "Holiday", employees: [] };

  const where: any = { requiresDailyReport: true, isDeleted: null, team: { isDeleted: null } };
  if (scope.mode === "TEAM") where.teamId = { in: scope.ledTeamIds };
  else if (scope.mode === "OWN") where.employeeId = scope.employeeId ?? "__none__";
  else if (scope.mode === "NONE") return { nonWorkingDay: false, employees: [] };
  // ALL -> no extra filter

  const members = await prisma.teamMember.findMany({ where, select: { employeeId: true } });
  const empIds = Array.from(new Set(members.map((m) => m.employeeId)));
  if (!empIds.length) return { nonWorkingDay: false, employees: [] };
  const emps = await prisma.employee.findMany({ where: { id: { in: empIds }, isDeleted: null }, select: { id: true, name: true, surname: true } });
  const onLeave = new Set(
    (await prisma.leaveRequest.findMany({ where: { employeeId: { in: empIds }, status: "APPROVED", isDeleted: null, startDate: { lte: endOfDay(date) }, endDate: { gte: startOfDay(date) } }, select: { employeeId: true } })).map((l) => l.employeeId)
  );
  return { nonWorkingDay: false, employees: emps.map((e) => ({ id: e.id, name: e.name, surname: e.surname, onLeave: onLeave.has(e.id) })) };
}

/** Next occurrence date for a recurring task, or null for NONE. */
export function nextRecurrenceDate(rule: string, from: Date): Date | null {
  const d = new Date(from);
  if (rule === "DAILY") { d.setDate(d.getDate() + 1); return d; }
  if (rule === "WEEKLY") { d.setDate(d.getDate() + 7); return d; }
  if (rule === "MONTHLY") { d.setMonth(d.getMonth() + 1); return d; }
  return null;
}
