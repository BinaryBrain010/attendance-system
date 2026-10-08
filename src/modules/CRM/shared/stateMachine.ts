/**
 * Server-enforced document state machines (allowed-transitions tables + one guard).
 * Phase 2 wires Lead; Quotation / SalesOrder / Return tables are here for Phase 3-4 and use the
 * same guard. A transition is rejected (409) unless `to` is in ALLOWED[entity][from]; moving to a
 * reason-required state without a reason is rejected (400). Mirrors the gatePass gpApprovePass guard
 * (load current -> check -> AppError -> update), generalized to a table.
 */
import { AppError } from "../../../core/errors/app.error";

export type SmEntity = "lead" | "quotation" | "order" | "return";

const LEAD: Record<string, string[]> = {
  DRAFT: ["NEW"],
  NEW: ["CONTACTED", "LOST", "ON_HOLD"],
  CONTACTED: ["QUALIFIED", "LOST", "ON_HOLD"],
  QUALIFIED: ["QUOTATION", "LOST", "ON_HOLD"],
  QUOTATION: ["NEGOTIATION", "WON", "LOST", "ON_HOLD"],
  NEGOTIATION: ["WON", "LOST", "ON_HOLD"],
  ON_HOLD: ["CONTACTED", "QUALIFIED", "LOST"],
  WON: [],   // terminal
  LOST: [],  // terminal
};

const QUOTATION: Record<string, string[]> = {
  DRAFT: ["SENT"], SENT: ["ACCEPTED", "REJECTED", "EXPIRED"], ACCEPTED: [], REJECTED: [], EXPIRED: ["SENT"],
};
const ORDER: Record<string, string[]> = {
  DRAFT: ["CONFIRMED", "CANCELLED"], CONFIRMED: ["PACKED", "CANCELLED"], PACKED: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["DELIVERED", "RETURNED"], DELIVERED: ["RETURNED"], RETURNED: [], CANCELLED: [],
};
const RETURN: Record<string, string[]> = {
  REPORTED: ["RECEIVED_BACK"], RECEIVED_BACK: ["RESTOCKED", "DAMAGED"], RESTOCKED: [], DAMAGED: [],
};

const TABLES: Record<SmEntity, Record<string, string[]>> = { lead: LEAD, quotation: QUOTATION, order: ORDER, return: RETURN };
const REASON_REQUIRED: Record<SmEntity, string[]> = {
  lead: ["LOST", "ON_HOLD"],
  quotation: ["REJECTED"],
  order: ["CANCELLED", "RETURNED"],
  return: ["DAMAGED"],
};

/** Allowed next states from `from` for an entity (for UIs). */
export function allowedNext(entity: SmEntity, from: string): string[] {
  return TABLES[entity]?.[from] ?? [];
}

/** Throw unless from->to is a legal transition; enforce reason-required states. */
export function assertTransition(entity: SmEntity, from: string, to: string, reason?: string | null): void {
  const table = TABLES[entity];
  if (!table) throw new AppError(400, `no state machine for ${entity}`);
  if (!(from in table)) throw new AppError(409, `unknown current state ${from}`);
  if (from === to) throw new AppError(409, `already in state ${to}`);
  if (!table[from].includes(to)) throw new AppError(409, `Invalid transition ${from} -> ${to}`);
  if (REASON_REQUIRED[entity].includes(to) && !(reason && String(reason).trim())) {
    throw new AppError(400, `a reason is required to move to ${to}`);
  }
}
