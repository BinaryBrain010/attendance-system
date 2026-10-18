/**
 * Agent scope resolver (own / team / all) for CRM documents. SINGLE SOURCE OF TRUTH — every CRM
 * read, getById, report, export, and write (create/update/delete/restore/transition/assign) for
 * leads, quotations and orders resolves authorization through `resolveScope` + the assert helpers
 * below. No other module decides scope.
 *
 * Effective scope = the NARROWER of:
 *   - the read-scope FEATURE held: ALL if `crm.<e>.read.all.*` (or an ancestor like `crm.<e>.read.*`
 *     / `crm.*`), else TEAM if `read.team.*`, else OWN if `read.own.*`, else NONE; and
 *   - the caller's `SalesAgent.scope` (OWN/TEAM/ALL).
 *
 * No SalesAgent profile (SAFETY, see #4):
 *   - with the explicit view-all feature (featureScope ALL) -> ALL (a pure admin keeps feature-ALL);
 *   - with only a read.own / read.team feature -> fall back to OWN **by createdBy** (the caller's own
 *     created rows), NEVER ALL, and log a warning (the account is mis-configured: it can sell/read but
 *     has no agent row to scope by). Previously this collapsed to NONE (saw nothing);
 *   - with no read feature -> NONE.
 *
 * Team membership = agents whose `teamLeadId` is the caller's own agent id (direct reports) + self.
 *
 *   ALL          -> {}                                  (no row restriction)
 *   TEAM         -> { agentId: { in: [self, ...reports] } }
 *   OWN (agent)  -> { agentId: self }
 *   OWN (created)-> { createdById: userId }             (no agent row; own-by-creator)
 *   NONE         -> { agentId: "__none__" }             (matches nothing)
 *
 * god bypasses everything (ALL).
 */
import prisma from "../../../core/models/base.model";
import { AgentScope } from "@prisma/client";
import { GOD_ID, getFeatureSet, holds } from "./access";
import { ForbiddenError } from "../../../core/errors/app.error";
import logger from "../../../core/logger/logger";

export type CrmEntity = "lead" | "quotation" | "order" | "return";
export type ScopeMode = "ALL" | "TEAM" | "OWN" | "NONE";

/** Row-ownership shape the assert helpers read: an agent-owned row and/or a created-by row. */
export type OwnedRow = { agentId?: string | null; createdById?: string | null };

export interface ScopeResult {
  mode: ScopeMode;
  where: Record<string, any>;
  agentId: string | null;
  teamAgentIds: string[];
  /** Set only for the no-agent OWN-by-createdBy fallback: the caller's user id. null otherwise. */
  createdById: string | null;
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
    return { mode: "ALL", where: {}, agentId: null, teamAgentIds: [], createdById: null };
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

  // ---- No SalesAgent profile: safety fallback (#4) ---------------------------------------------
  if (!agent) {
    if (featureScope === "ALL") {
      // Holds the explicit view-all feature (crm.<e>.read.all.* or an all-ancestor): truly ALL.
      return { mode: "ALL", where: {}, agentId: null, teamAgentIds: [], createdById: null };
    }
    if (featureScope === "OWN" || featureScope === "TEAM") {
      // Has a read feature but no agent row. NEVER expose ALL: restrict to the caller's OWN created
      // rows and warn (mis-configured account — link it to a SalesAgent, see the agent-linking UI).
      logger.warn(
        `[crm.scope] user=${userId} entity=${entity} holds ${featureScope} read but has no SalesAgent profile; ` +
          `restricting to OWN-by-createdBy (never ALL). Link this login to an agent.`
      );
      return { mode: "OWN", where: { createdById: userId }, agentId: null, teamAgentIds: [], createdById: userId };
    }
    // No read feature at all.
    return { mode: "NONE", where: { agentId: "__none__" }, agentId: null, teamAgentIds: [], createdById: null };
  }

  // ---- Has a SalesAgent profile: effective = min(featureScope, agentScope) ----------------------
  const agentCap: ScopeMode = scopeFromAgent(agent.scope);
  const effective: ScopeMode = RANK[featureScope] <= RANK[agentCap] ? featureScope : agentCap;

  if (effective === "ALL") {
    return { mode: "ALL", where: {}, agentId: agent.id, teamAgentIds: [], createdById: null };
  }
  if (effective === "NONE") {
    return { mode: "NONE", where: { agentId: "__none__" }, agentId: agent.id, teamAgentIds: [], createdById: null };
  }
  if (effective === "OWN") {
    return { mode: "OWN", where: { agentId: agent.id }, agentId: agent.id, teamAgentIds: [agent.id], createdById: null };
  }
  // TEAM: self + direct reports
  const members = await prisma.salesAgent.findMany({
    where: { teamLeadId: agent.id, isDeleted: null },
    select: { id: true },
  });
  const teamAgentIds = [agent.id, ...members.map((m) => m.id)];
  return { mode: "TEAM", where: { agentId: { in: teamAgentIds } }, agentId: agent.id, teamAgentIds, createdById: null };
}

/** True if a single row is visible under a resolved scope. Pass the row (agentId + createdById). */
export function rowInScope(scope: ScopeResult, row: OwnedRow | null | undefined): boolean {
  if (scope.mode === "ALL") return true;
  if (scope.mode === "NONE") return false;
  // OWN-by-createdBy fallback: only the caller's own created rows are visible.
  if (scope.createdById) return !!row?.createdById && row.createdById === scope.createdById;
  // Agent scopes (OWN/TEAM): visible iff the row's agentId is in the resolved team set.
  return !!row?.agentId && scope.teamAgentIds.includes(row.agentId);
}

/** Throw 403 unless the row is within the caller's scope. Used on read-one + every write. */
export function assertRowInScope(scope: ScopeResult, row: OwnedRow | null | undefined, what = "record"): void {
  if (!rowInScope(scope, row)) throw new ForbiddenError(`${what} is outside your scope`);
}

/**
 * Can the caller assign/own a record to `agentId`?
 *   ALL  -> any agent (or null/unassigned);
 *   TEAM -> only agents in the caller's team;
 *   OWN  -> only the caller's own agent;
 *   NONE -> never.
 * (The no-agent createdBy fallback has no agent to assign to; `resolveAssignment` handles it.)
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
 * For the no-agent createdBy fallback the record carries no agent (agentId stays null, it is owned by
 * createdBy); a non-null requested agent is rejected (the caller has no agent and cannot assign).
 */
export function resolveAssignment(scope: ScopeResult, requestedAgentId: string | null | undefined): string | null {
  if (scope.createdById) {
    if (requestedAgentId) throw new ForbiddenError("you have no agent profile; cannot assign this record to an agent");
    return null;
  }
  let target = requestedAgentId ?? null;
  if (target === null && (scope.mode === "OWN" || scope.mode === "TEAM")) target = scope.agentId;
  if (!canAssignTo(scope, target)) throw new ForbiddenError("cannot assign this record to that agent (out of scope)");
  return target;
}
