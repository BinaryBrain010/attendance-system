/** Small shared helpers for the Work module: task codes, notifications, recurrence. */
import prisma from "../../../core/models/base.model";

/** Next task code TASK-0001. */
export async function nextTaskCode(): Promise<string> {
  const rows = await prisma.task.findMany({ where: { code: { startsWith: "TASK-" } }, select: { code: true } });
  let max = 0;
  for (const r of rows) { const m = (r.code || "").match(/(\d+)/); if (m) max = Math.max(max, parseInt(m[1], 10)); }
  return `TASK-${String(max + 1).padStart(4, "0")}`;
}

export type NotifType = "ASSIGNED" | "DUE_SOON" | "OVERDUE" | "COMMENT" | "REPORT_MISSING";

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

/** Next occurrence date for a recurring task, or null for NONE. */
export function nextRecurrenceDate(rule: string, from: Date): Date | null {
  const d = new Date(from);
  if (rule === "DAILY") { d.setDate(d.getDate() + 1); return d; }
  if (rule === "WEEKLY") { d.setDate(d.getDate() + 7); return d; }
  if (rule === "MONTHLY") { d.setMonth(d.getMonth() + 1); return d; }
  return null;
}
