/**
 * @mentions for leads (2e). Mentions are sent as an explicit array of User ids (the client's mention
 * picker resolves names -> ids — usernames here are emails, so text parsing is unreliable). The
 * backend decides WHO a user may mention and notifies them:
 *   - a manager (ALL lead-scope, or god) may mention anyone;
 *   - everyone else may mention members of their own team (team lead + its members).
 * A mentioned user gets a MENTION notification linking to the lead. Self-mentions are dropped.
 */
import prisma from "../../../core/models/base.model";
import { resolveScope } from "./scope";
import { isGod } from "./access";
import { notify } from "../../Work/shared/workHelpers";

/** The subset of `mentionIds` the mentioner is actually allowed to mention (deduped, minus self). */
export async function resolveMentionTargets(mentionerUserId: string, mentionIds: string[] | undefined): Promise<string[]> {
  const ids = Array.from(new Set((mentionIds || []).filter((x): x is string => !!x)));
  if (!ids.length) return [];
  const scope = await resolveScope(mentionerUserId, "lead");

  let allowed: Set<string>;
  if (isGod(mentionerUserId) || scope.mode === "ALL") {
    // Managers may mention anyone — keep only the ids that are real, non-deleted users.
    const users = await prisma.user.findMany({ where: { id: { in: ids }, isDeleted: null }, select: { id: true } });
    allowed = new Set(users.map((u) => u.id));
  } else {
    // Everyone else: only their own team (the team lead + all its members) that have a linked user.
    allowed = new Set<string>();
    if (scope.agentId) {
      const me = await prisma.salesAgent.findUnique({ where: { id: scope.agentId }, select: { id: true, teamLeadId: true } });
      const teamLead = me?.teamLeadId ?? me?.id;
      if (teamLead) {
        const team = await prisma.salesAgent.findMany({ where: { isDeleted: null, userId: { not: null }, OR: [{ id: teamLead }, { teamLeadId: teamLead }] }, select: { userId: true } });
        for (const t of team) if (t.userId) allowed.add(t.userId);
      }
    }
  }
  return ids.filter((id) => allowed.has(id) && id !== mentionerUserId);
}

/** Resolve + notify the mentioned users (best-effort). `context` is a short label e.g. the lead name. */
export async function notifyMentions(mentionerUserId: string, mentionIds: string[] | undefined, leadId: string, context: string, snippet?: string): Promise<void> {
  try {
    const targets = await resolveMentionTargets(mentionerUserId, mentionIds);
    if (!targets.length) return;
    await notify(targets, "MENTION", `You were mentioned on ${context}`, (snippet || "").slice(0, 160), "Lead", leadId);
  } catch { /* mentions are best-effort */ }
}
