/**
 * Insights entity scope — the SINGLE place analytics turns the caller's permissions into a Prisma
 * `where` fragment, reusing the existing module resolvers so analytics never widens anyone's reach:
 *   - CRM entities (lead/quotation/order/return) -> CRM resolveScope (own/team/all, agent-based).
 *   - Work entities (task/report)                -> Work resolveWorkScope (own/team/all, team-based).
 *   - Everything else (attendance/visitor/gatePass/auditLog) -> feature-gated org-wide (the module's
 *     read feature is all-or-nothing today, matching the rest of the app's reads).
 * `visible:false` means the caller may not see this entity at all (widget/data is withheld).
 */
import { resolveScope } from "../../CRM/shared/scope";
import { resolveWorkScope } from "../../Work/shared/workScope";
import { GOD_ID, holdsRead } from "./gating";

export type Entity =
  | "attendance" | "visitor" | "gatePass" | "gatePassItem"
  | "lead" | "quotation" | "salesOrder" | "salesReturn"
  | "task" | "dailyReport" | "auditLog";

export interface EntityScope {
  visible: boolean;
  /** Prisma where-fragment restricting rows to the caller's scope (merge into an AND). */
  where: Record<string, any>;
  /** short human note for debugging/response (e.g. "OWN", "TEAM", "ALL", "org"). */
  mode: string;
}

const NONE: EntityScope = { visible: false, where: { id: "__none__" }, mode: "NONE" };

export async function entityScope(userId: string, entity: Entity, feats: Set<string>): Promise<EntityScope> {
  if (userId === GOD_ID) return { visible: true, where: {}, mode: "ALL" };

  switch (entity) {
    case "lead": {
      const s = await resolveScope(userId, "lead");
      return { visible: s.mode !== "NONE", where: s.where, mode: s.mode };
    }
    case "quotation": {
      const s = await resolveScope(userId, "quotation");
      return { visible: s.mode !== "NONE", where: s.where, mode: s.mode };
    }
    case "salesOrder": {
      const s = await resolveScope(userId, "order");
      return { visible: s.mode !== "NONE", where: s.where, mode: s.mode };
    }
    case "salesReturn": {
      const s = await resolveScope(userId, "return");
      return { visible: s.mode !== "NONE", where: s.where, mode: s.mode };
    }
    case "task": {
      const s = await resolveWorkScope(userId, "task");
      return { visible: s.mode !== "NONE", where: s.taskWhere, mode: s.mode };
    }
    case "dailyReport": {
      const s = await resolveWorkScope(userId, "report");
      return { visible: s.mode !== "NONE", where: s.reportWhere, mode: s.mode };
    }
    case "attendance":
      return holdsRead(feats, "attendance") ? { visible: true, where: {}, mode: "org" } : NONE;
    case "visitor":
      return holdsRead(feats, "visitor") ? { visible: true, where: {}, mode: "org" } : NONE;
    case "gatePass":
    case "gatePassItem":
      return holdsRead(feats, "voucher") ? { visible: true, where: {}, mode: "org" } : NONE;
    case "auditLog":
      return holdsRead(feats, "audit") ? { visible: true, where: {}, mode: "org" } : NONE;
    default:
      return NONE;
  }
}
