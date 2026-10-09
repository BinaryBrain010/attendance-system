/**
 * Agent scope resolver (own / team / all) for CRM documents. SINGLE SOURCE OF TRUTH — every CRM
 * read, getById, report, export, and write (create/update/delete/restore/transition/assign) for
 * leads, quotations and orders resolves authorization through `resolveScope` + the assert helpers
 * below. No other module decides scope.
 *
 * Effective scope = the NARROWER of:
 *   - the read-scope FEATURE held: ALL if `crm.<e>.read.all.*` (or an ancestor like `crm.<e>.read.*`
 *     / `crm.*`), else TEAM if `read.team.*`, else OWN if `read.own.*`, else NONE; and
 *   - the caller's `SalesAgent.scope` (OWN/TEAM/ALL). A caller with no SalesAgent row has no cap
 *     (treated as ALL) so a pure admin keeps feature-ALL; but TEAM/OWN cannot resolve an agentId
 *     without an agent row, so they collapse to NONE (match nothing).
 *
 * Team membership = agents whose `teamLeadId` is the caller's own agent id (direct reports) + self.
 *
 *   ALL  -> {}                                  (no row restriction)
 *   TEAM -> { agentId: { in: [self, ...reports] } }
 *   OWN  -> { agentId: self }
 *   NONE -> { agentId: "__none__" }             (matches nothing)
 *
 * god bypasses everything (ALL).
 */
import prisma from "../../../core/models/base.model";
import { AgentScope } from "@prisma/client";
import { GOD_ID, getFeatureSet, holds } from "./access";
import { ForbiddenError } from "../../../core/errors/app.error";

export type CrmEntity = "lead" | "quotation" | "order" | "return";
export type ScopeMode = "ALL" | "TEAM" | "OWN" | "NONE";

export interface ScopeResult {
  mode: ScopeMode;
  where: Record<string, any>;
  agentId: string | null;
  teamAgentIds: string[];
}

const RANK: Record<ScopeMode, number> = { NONE: 0, OWN: 1, TEAM: 2, ALL: 3 };

function scopeFromAgent(s: AgentScope | undefined | null): ScopeMode {
  if (s === "ALL") return "ALL";
  if (s === "TEAM") return "TEAM";
  return "OWN";
}

/** Resolve the caller's scope for a CRM entity into a Prisma where-fragment. */
export async function resolveScope(userId: string, entity: CrmEntity): Promise<ScopeResult> {
  if (userId === GOD_ID) {
    return { mode: "ALL", where: {}, agentId: null, teamAgentIds: [] };
  }

  const feats = await getFeatureSet(userId);
  let featureScope: ScopeMode = "NONE";
  if (holds(feats, `crm.${entity}.read.all.*`)) featureScope = "ALL";
  else if (holds(feats, `crm.${entity}.read.team.*`)) featureScope = "TEAM";
  else if (holds(feats, `crm.${entity}.read.own.*`)) featureScope = "OWN";

  const agent = await prisma.salesAgent.findFirst({
    where: { userId, isDeleted: null },
    select: { id: true, scope: true },
  });

  // Effective scope = min(featureScope, agentScope). An admin with no agent row keeps featureScope
  // (so ALL stays ALL); without an agent row, TEAM/OWN cannot resolve an agentId -> matches nothing.
  const agentCap: ScopeMode = agent ? scopeFromAgent(agent.scope) : "ALL";
  const effective: ScopeMode =
    RANK[featureScope] <= RANK[agentCap] ? featureScope : agentCap;

  if (effective === "ALL") {
    return { mode: "ALL", where: {}, agentId: agent?.id ?? null, teamAgentIds: [] };
  }
  if (effective === "NONE" || !agent) {
    return { mode: "NONE", where: { agentId: "__none__" }, agentId: agent?.id ?? null, teamAgentIds: [] };
  }
  if (effective === "OWN") {
    return { mode: "OWN", where: { agentId: agent.id }, agentId: agent.id, teamAgentIds: [agent.id] };
  }
  // TEAM: self + direct reports
  const members = await prisma.salesAgent.findMany({
    where: { teamLeadId: agent.id, isDeleted: null },
    select: { id: true },
  });
  const teamAgentIds = [agent.id, ...members.map((m) => m.id)];
  return { mode: "TEAM", where: { agentId: { in: teamAgentIds } }, agentId: agent.id, teamAgentIds };
}

/** True if a single row (by its agentId) is visible under a resolved scope. */
export function rowInScope(scope: ScopeResult, rowAgentId: string | null | undefined): boolean {
  if (scope.mode === "ALL") return true;
  if (scope.mode === "NONE") return false;
  return !!rowAgentId && scope.teamAgentIds.includes(rowAgentId);
}

/** Throw 403 unless the row (by its agentId) is within the caller's scope. Used on read-one + every write. */
export function assertRowInScope(scope: ScopeResult, rowAgentId: string | null | undefined, what = "record"): void {
  if (!rowInScope(scope, rowAgentId)) throw new ForbiddenError(`${what} is outside your scope`);
}

/**
 * Can the caller assign/own a record to `agentId`?
 *   ALL  -> any agent (or null/unassigned);
 *   TEAM -> only agents in the caller's team;
 *   OWN  -> only the caller's own agent;
 *   NONE -> never.
 */
export function canAssignTo(scope: ScopeResult, agentId: string | null | undefined): boolean {
  if (scope.mode === "ALL") return true;
  if (scope.mode === "NONE") return false;
  if (!agentId) return false; // own/team must target a concrete agent
  return scope.teamAgentIds.includes(agentId);
}

/**
 * Resolve the agentId a write should carry and enforce assignment rules.
 * For OWN/TEAM a missing target defaults to the caller's own agent; assigning to anyone outside
 * the scope (an "own" agent handing a lead to another agent, say) throws 403.
 */
export function resolveAssignment(scope: ScopeResult, requestedAgentId: string | null | undefined): string | null {
  let target = requestedAgentId ?? null;
  if (target === null && (scope.mode === "OWN" || scope.mode === "TEAM")) target = scope.agentId;
  if (!canAssignTo(scope, target)) throw new ForbiddenError("cannot assign this record to that agent (out of scope)");
  return target;
}
