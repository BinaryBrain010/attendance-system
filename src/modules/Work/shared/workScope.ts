/**
 * Work module scope resolver (own / team / all) for Tasks and Daily reports. Mirrors the CRM
 * scope.ts rule: effective scope = the NARROWER of the read-scope FEATURE held
 * (work.<entity>.read.{own|team|all}.*) and the caller's team-lead relation (you can only exercise
 * TEAM if you actually lead at least one team; otherwise TEAM collapses to OWN).
 *
 *   ALL  -> {}
 *   TEAM -> tasks of teams you lead (+ your own); reports of members of teams you lead (+ your own)
 *   OWN  -> tasks assigned to / created / watched by you; your own reports
 *   NONE -> matches nothing
 *
 * god bypasses to ALL. A user with no linked employee can only ever be ALL (pure admin) else NONE.
 */
import prisma from "../../../core/models/base.model";
import { GOD_ID, getFeatureSet, holds } from "../../CRM/shared/access";
import { ForbiddenError } from "../../../core/errors/app.error";

export type ScopeMode = "ALL" | "TEAM" | "OWN" | "NONE";
const RANK: Record<ScopeMode, number> = { NONE: 0, OWN: 1, TEAM: 2, ALL: 3 };

export interface WorkScope {
  mode: ScopeMode;
  userId: string;
  employeeId: string | null;
  ledTeamIds: string[];
  teamEmployeeIds: string[];
  taskWhere: Record<string, any>;
  reportWhere: Record<string, any>;
}

export async function resolveWorkScope(userId: string, entity: "task" | "report"): Promise<WorkScope> {
  const god = userId === GOD_ID;
  const feats = await getFeatureSet(userId);
  let featureScope: ScopeMode = "NONE";
  if (god || holds(feats, `work.${entity}.read.all.*`)) featureScope = "ALL";
  else if (holds(feats, `work.${entity}.read.team.*`)) featureScope = "TEAM";
  else if (holds(feats, `work.${entity}.read.own.*`)) featureScope = "OWN";

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { employeeId: true } });
  const employeeId = user?.employeeId ?? null;

  const ledTeams = employeeId
    ? await prisma.team.findMany({ where: { leadId: employeeId, isDeleted: null }, select: { id: true } })
    : [];
  const ledTeamIds = ledTeams.map((t) => t.id);
  let teamEmployeeIds: string[] = employeeId ? [employeeId] : [];
  if (ledTeamIds.length) {
    const mem = await prisma.teamMember.findMany({ where: { teamId: { in: ledTeamIds }, isDeleted: null }, select: { employeeId: true } });
    teamEmployeeIds = Array.from(new Set([...teamEmployeeIds, ...mem.map((m) => m.employeeId)]));
  }

  const teamCap: ScopeMode = ledTeamIds.length ? "TEAM" : "OWN";
  let effective: ScopeMode = god ? "ALL" : featureScope;
  if (effective === "TEAM" && RANK[teamCap] < RANK.TEAM) effective = "OWN";
  if (!employeeId && effective !== "ALL") effective = "NONE";

  let taskWhere: Record<string, any> = {};
  let reportWhere: Record<string, any> = {};
  if (effective === "ALL") { taskWhere = {}; reportWhere = {}; }
  else if (effective === "NONE") { taskWhere = { id: "__none__" }; reportWhere = { id: "__none__" }; }
  else if (effective === "OWN") {
    taskWhere = { OR: [{ assignees: { some: { employeeId } } }, { createdById: userId }, { watchers: { some: { employeeId } } }] };
    reportWhere = { employeeId };
  } else {
    taskWhere = { OR: [{ teamId: { in: ledTeamIds } }, { assignees: { some: { employeeId } } }, { createdById: userId }] };
    reportWhere = { employeeId: { in: teamEmployeeIds } };
  }
  return { mode: effective, userId, employeeId, ledTeamIds, teamEmployeeIds, taskWhere, reportWhere };
}

/** Throw 403 unless a loaded task row is visible under the caller's scope. */
export function assertTaskInScope(scope: WorkScope, task: { teamId?: string | null; createdById?: string | null; assignees?: { employeeId: string }[]; watchers?: { employeeId: string }[] }): void {
  if (scope.mode === "ALL") return;
  if (scope.mode === "NONE") throw new ForbiddenError("task is outside your scope");
  const me = scope.employeeId;
  const mine = (task.assignees || []).some((a) => a.employeeId === me) || (task.watchers || []).some((w) => w.employeeId === me) || task.createdById === scope.userId;
  const teamOk = scope.mode === "TEAM" && !!task.teamId && scope.ledTeamIds.includes(task.teamId);
  if (!mine && !teamOk) throw new ForbiddenError("task is outside your scope");
}
