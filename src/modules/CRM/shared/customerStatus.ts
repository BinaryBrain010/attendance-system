/**
 * CRM customer lifecycle status, computed from a person's leads + orders. CRM "customers" are not a
 * stored entity — they are derived per phone from leads/orders/returns — so status is computed from
 * the same rows the customers list / 360 already load (always accurate; no table, no backfill, no
 * update hooks to drift).
 *
 *   CUSTOMER : at least one WON lead, OR at least one committed order (confirmed..delivered).
 *   LOST     : has lead(s), every lead is LOST, and no committed order.
 *   PROSPECT : anything else (only open leads / no orders yet) — the default.
 */
export type CustomerStatus = "PROSPECT" | "CUSTOMER" | "LOST";

// A "real" order = past DRAFT and not cancelled/returned-out. Confirmed or further = committed.
const COMMITTED_ORDER = new Set(["CONFIRMED", "PACKED", "DISPATCHED", "DELIVERED"]);

export function computeCustomerStatus(leadStages: string[], orderStatuses: string[]): CustomerStatus {
  const hasWon = leadStages.includes("WON");
  const hasCommittedOrder = orderStatuses.some((s) => COMMITTED_ORDER.has(s));
  if (hasWon || hasCommittedOrder) return "CUSTOMER";
  const hasLead = leadStages.length > 0;
  const allLost = hasLead && leadStages.every((s) => s === "LOST");
  if (allLost) return "LOST";
  return "PROSPECT";
}
