import prisma from "../../../../core/models/base.model";
import { resolveWorkScope, assertTaskInScope } from "../../shared/workScope";
import { nextTaskCode, notify, userIdsForEmployees, nextRecurrenceDate } from "../../shared/workHelpers";
import { AppError, NotFoundError } from "../../../../core/errors/app.error";

const include = {
  team: { select: { id: true, name: true, statuses: true } },
  assignees: { include: { employee: { select: { id: true, name: true, surname: true } } } },
  checklist: { where: { isDeleted: null }, orderBy: { sortOrder: "asc" as const } },
  comments: { where: { isDeleted: null }, orderBy: { createdAt: "asc" as const } },
  watchers: true,
};

function filterWhere(f: any = {}): Record<string, any> {
  const w: Record<string, any> = {};
  if (f.teamId) w.teamId = f.teamId;
  if (f.status) w.status = f.status;
  if (f.priority) w.priority = f.priority;
  if (f.assigneeId) w.assignees = { some: { employeeId: f.assigneeId } };
  if (f.label) w.labels = { has: f.label };
  if (f.linkType) w.linkType = f.linkType;
  if (f.linkId) w.linkId = f.linkId;
  if (f.dueFrom || f.dueTo) { w.dueDate = {}; if (f.dueFrom) w.dueDate.gte = new Date(f.dueFrom); if (f.dueTo) w.dueDate.lte = new Date(f.dueTo); }
  if (f.overdue) { w.dueDate = { lt: new Date() }; }
  if (f.search) w.OR = [{ title: { contains: String(f.search), mode: "insensitive" } }, { code: { contains: String(f.search), mode: "insensitive" } }];
  return w;
}

/** Last configured status of a team is the "done" state (defaults to DONE). */
async function doneStatusFor(teamId: string | null | undefined): Promise<string> {
  if (teamId) { const t = await prisma.team.findUnique({ where: { id: teamId }, select: { statuses: true } }); const s = t?.statuses || []; if (s.length) return s[s.length - 1]; }
  return "DONE";
}

class TaskService {
  async get(userId: string, page = 1, pageSize = 20, filters: any = {}) {
    const scope = await resolveWorkScope(userId, "task");
    const where = { AND: [{ isDeleted: null }, filterWhere(filters), scope.taskWhere] };
    const skip = (page - 1) * pageSize;
    const [data, totalSize] = await Promise.all([
      prisma.task.findMany({ where, include, skip, take: pageSize, orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }] }),
      prisma.task.count({ where }),
    ]);
    return { data, totalSize, scope: scope.mode };
  }

  async getById(userId: string, id: string) {
    const scope = await resolveWorkScope(userId, "task");
    const task: any = await prisma.task.findUnique({ where: { id }, include });
    if (!task || task.isDeleted) return null;
    assertTaskInScope(scope, task);
    return task;
  }

  async create(userId: string, data: any) {
    const { assignees = [], checklist = [], watchers = [], ...h } = data;
    let status = h.status;
    if (!status) { const t = h.teamId ? await prisma.team.findUnique({ where: { id: h.teamId }, select: { statuses: true } }) : null; status = (t?.statuses || ["TODO"])[0]; }
    const code = await nextTaskCode();
    const task: any = await prisma.task.create({
      data: {
        code, title: h.title, description: h.description ?? null, teamId: h.teamId ?? null, status,
        priority: h.priority ?? "MEDIUM", dueDate: h.dueDate ? new Date(h.dueDate) : null, startDate: h.startDate ? new Date(h.startDate) : null,
        estimateHours: h.estimateHours ?? null, labels: h.labels ?? [], attachments: h.attachments ?? [],
        linkType: h.linkType ?? null, linkId: h.linkId ?? null, recurring: h.recurring ?? "NONE",
        createdById: userId, createdBy: userId,
        assignees: { create: (assignees || []).map((e: string) => ({ employeeId: e })) },
        checklist: { create: (checklist || []).map((c: any, i: number) => ({ text: typeof c === "string" ? c : c.text, sortOrder: i })) },
        watchers: { create: (watchers || []).map((e: string) => ({ employeeId: e })) },
      },
      include,
    });
    await notify(await userIdsForEmployees(assignees), "ASSIGNED", `Assigned: ${task.title}`, task.code || "", "Task", task.id);
    return task;
  }

  async update(userId: string, id: string, data: any) {
    const scope = await resolveWorkScope(userId, "task");
    const existing: any = await prisma.task.findUnique({ where: { id }, include: { assignees: true, watchers: true } });
    if (!existing || existing.isDeleted) throw new NotFoundError("Task not found");
    assertTaskInScope(scope, existing);
    const HEADER = ["title", "description", "teamId", "priority", "dueDate", "startDate", "estimateHours", "labels", "linkType", "linkId", "recurring", "attachments", "status"];
    const d: any = { updatedBy: userId };
    for (const k of HEADER) if (k in data) d[k] = k === "dueDate" || k === "startDate" ? (data[k] ? new Date(data[k]) : null) : data[k];
    return prisma.task.update({ where: { id }, data: d, include });
  }

  /** Status change. On reaching the team's done state, stamp completedAt and, if recurring, spawn the next. */
  async setStatus(userId: string, id: string, status: string) {
    const scope = await resolveWorkScope(userId, "task");
    const task: any = await prisma.task.findUnique({ where: { id }, include: { assignees: true, checklist: true, watchers: true } });
    if (!task || task.isDeleted) throw new NotFoundError("Task not found");
    assertTaskInScope(scope, task);
    const done = await doneStatusFor(task.teamId);
    const completedAt = status === done ? new Date() : null;
    const updated = await prisma.task.update({ where: { id }, data: { status, completedAt, updatedBy: userId }, include });
    if (status === done && task.recurring && task.recurring !== "NONE" && task.dueDate) {
      const nextDue = nextRecurrenceDate(task.recurring, new Date(task.dueDate));
      if (nextDue) {
        const code = await nextTaskCode();
        await prisma.task.create({
          data: {
            code, title: task.title, description: task.description, teamId: task.teamId, status: (await prisma.team.findUnique({ where: { id: task.teamId || "" }, select: { statuses: true } }))?.statuses?.[0] || "TODO",
            priority: task.priority, dueDate: nextDue, estimateHours: task.estimateHours, labels: task.labels, linkType: task.linkType, linkId: task.linkId,
            recurring: task.recurring, recurredFromId: task.id, createdById: userId, createdBy: userId,
            assignees: { create: task.assignees.map((a: any) => ({ employeeId: a.employeeId })) },
            checklist: { create: task.checklist.map((c: any, i: number) => ({ text: c.text, sortOrder: i })) },
          },
        });
      }
    }
    return updated;
  }

  /** Replace the assignee set. Notifies newly-added assignees. */
  async assign(userId: string, id: string, employeeIds: string[]) {
    const scope = await resolveWorkScope(userId, "task");
    const task: any = await prisma.task.findUnique({ where: { id }, include: { assignees: true, watchers: true } });
    if (!task || task.isDeleted) throw new NotFoundError("Task not found");
    assertTaskInScope(scope, task);
    const prev = new Set(task.assignees.map((a: any) => a.employeeId));
    await prisma.taskAssignee.deleteMany({ where: { taskId: id } });
    if (employeeIds.length) await prisma.taskAssignee.createMany({ data: employeeIds.map((e) => ({ taskId: id, employeeId: e })) });
    const added = employeeIds.filter((e) => !prev.has(e));
    if (added.length) await notify(await userIdsForEmployees(added), "ASSIGNED", `Assigned: ${task.title}`, task.code || "", "Task", task.id);
    return prisma.task.update({ where: { id }, data: { updatedBy: userId }, include });
  }

  /** Add one assignee to each of several tasks (bulk assign), scope-checked per task. */
  async bulkAssign(userId: string, taskIds: string[], employeeId: string) {
    const scope = await resolveWorkScope(userId, "task");
    let ok = 0;
    for (const id of taskIds) {
      const task: any = await prisma.task.findUnique({ where: { id }, include: { assignees: true, watchers: true } });
      if (!task || task.isDeleted) continue;
      try { assertTaskInScope(scope, task); } catch { continue; }
      await prisma.taskAssignee.upsert({ where: { taskId_employeeId: { taskId: id, employeeId } }, create: { taskId: id, employeeId }, update: {} });
      ok++;
    }
    await notify(await userIdsForEmployees([employeeId]), "ASSIGNED", `Assigned ${ok} task(s)`, "", "Task");
    return { assigned: ok };
  }

  async addComment(userId: string, id: string, body: string) {
    const scope = await resolveWorkScope(userId, "task");
    const task: any = await prisma.task.findUnique({ where: { id }, include: { assignees: true, watchers: true } });
    if (!task || task.isDeleted) throw new NotFoundError("Task not found");
    assertTaskInScope(scope, task);
    const c = await prisma.taskComment.create({ data: { taskId: id, userId, body } });
    const recipients = Array.from(new Set([...task.assignees.map((a: any) => a.employeeId), ...task.watchers.map((w: any) => w.employeeId)]));
    await notify((await userIdsForEmployees(recipients)).filter((u) => u !== userId), "COMMENT", `New comment on ${task.code || task.title}`, body.slice(0, 120), "Task", id);
    return c;
  }

  async setChecklistItem(userId: string, id: string, itemId: string | null, text: string | undefined, done: boolean | undefined) {
    const scope = await resolveWorkScope(userId, "task");
    const task: any = await prisma.task.findUnique({ where: { id }, include: { assignees: true, watchers: true } });
    if (!task || task.isDeleted) throw new NotFoundError("Task not found");
    assertTaskInScope(scope, task);
    if (itemId) return prisma.taskChecklistItem.update({ where: { id: itemId }, data: { ...(text != null ? { text } : {}), ...(done != null ? { done } : {}) } });
    const count = await prisma.taskChecklistItem.count({ where: { taskId: id } });
    return prisma.taskChecklistItem.create({ data: { taskId: id, text: text || "", sortOrder: count } });
  }

  async setWatchers(userId: string, id: string, employeeIds: string[]) {
    const scope = await resolveWorkScope(userId, "task");
    const task: any = await prisma.task.findUnique({ where: { id }, include: { assignees: true, watchers: true } });
    if (!task || task.isDeleted) throw new NotFoundError("Task not found");
    assertTaskInScope(scope, task);
    await prisma.taskWatcher.deleteMany({ where: { taskId: id } });
    if (employeeIds.length) await prisma.taskWatcher.createMany({ data: employeeIds.map((e) => ({ taskId: id, employeeId: e })) });
    return prisma.task.findUnique({ where: { id }, include });
  }

  async addAttachments(userId: string, id: string, paths: string[]) {
    const scope = await resolveWorkScope(userId, "task");
    const task: any = await prisma.task.findUnique({ where: { id }, include: { assignees: true, watchers: true } });
    if (!task || task.isDeleted) throw new NotFoundError("Task not found");
    assertTaskInScope(scope, task);
    return prisma.task.update({ where: { id }, data: { attachments: [...(task.attachments || []), ...paths], updatedBy: userId }, include });
  }

  async remove(userId: string, id: string) {
    const scope = await resolveWorkScope(userId, "task");
    const task: any = await prisma.task.findUnique({ where: { id }, include: { assignees: true, watchers: true } });
    if (!task || task.isDeleted) throw new NotFoundError("Task not found");
    assertTaskInScope(scope, task);
    return prisma.task.update({ where: { id }, data: { isDeleted: new Date(), updatedBy: userId } });
  }
}

export default TaskService;
