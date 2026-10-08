/**
 * Agent scope resolver (own / team / all) for CRM documents.
 *
 * The read-scope FEATURE the caller holds is the authority for how much data is exposed; the
 * caller's `SalesAgent.scope` is applied as a cap (an agent configured OWN can never see more than
 * own, even if granted a broader feature by mistake). The result is a Prisma `where` fragment that
 * every list / getById / report / export for leads, quotations and orders folds into its query.
 *
 *   ALL  -> {}                                  (no row restriction)
 *   TEAM -> { agentId: { in: [self, ...reports] } }
 *   OWN  -> { agentId: self }
 *   NONE -> { agentId: "__none__" }             (matches nothing; caller has no read feature)
 *
 * god bypasses everything (ALL).
 */
import prisma from "../../../core/models/base.model";
import { AgentScope } from "@prisma/client";
import { GOD_ID, getFeatureSet, holds } from "./access";

export type CrmEntity = "lead" | "quotation" | "order";
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
