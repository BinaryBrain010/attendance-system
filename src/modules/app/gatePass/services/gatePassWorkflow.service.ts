/**
 * Gate-pass status state machine (web admin). The EXISTING approve endpoint (pending -> approved) is
 * left completely untouched; these are the new transitions, each a new endpoint with its own feature
 * and a server-enforced state machine (invalid move -> 409). Every transition writes a
 * GatePassStatusHistory row (who / when / reason) and restocks items when they come back.
 *
 *   PENDING ──approve──▶ APPROVED ──dispatch──▶ DISPATCHED ──return──▶ RETURNED ──close──▶ CLOSED
 *      └── reject / cancel (reason) ──▶ REJECTED / CANCELLED        └── close ──▶ CLOSED
 *   reject & cancel are allowed only from PENDING or APPROVED.
 */
import prisma from "../../../../core/models/base.model";
import { Status } from "../../../../enums/schema";
import { AppError, NotFoundError } from "../../../../core/errors/app.error";
import { getActorId } from "../../../../core/context/requestContext";

export type TransitionAction = "reject" | "dispatch" | "return" | "cancel";

interface Rule {
  from: Status[];
  to: Status;
  feature: string;
  reasonRequired: boolean;
}

// `return` with { close: true } (and a returned pass) targets CLOSED instead of RETURNED.
const RULES: Record<TransitionAction, Rule> = {
  reject:   { from: [Status.PENDING, Status.APPROVED], to: Status.REJECTED,   feature: "gatePass.reject.*",   reasonRequired: true },
  cancel:   { from: [Status.PENDING, Status.APPROVED], to: Status.CANCELLED,  feature: "gatePass.cancel.*",   reasonRequired: true },
  dispatch: { from: [Status.APPROVED],                 to: Status.DISPATCHED, feature: "gatePass.dispatch.*", reasonRequired: false },
  return:   { from: [Status.DISPATCHED],               to: Status.RETURNED,   feature: "gatePass.return.*",   reasonRequired: false },
};

// Stock is decremented at approve; it is still "out" while approved/dispatched. Moving to a state that
// gives the goods back (returned / cancelled / rejected) from one of those restocks; closing does not.
const STOCK_OUT = new Set<string>([Status.APPROVED, Status.DISPATCHED]);
function shouldRestock(from: Status, to: Status): boolean {
  return (to === Status.RETURNED || to === Status.CANCELLED || to === Status.REJECTED) && STOCK_OUT.has(from);
}

class GatePassWorkflowService {
  /** Apply a transition. `close` turns a `return` into a close (DISPATCHED/RETURNED -> CLOSED). */
  async transition(action: TransitionAction, id: string, opts: { reason?: string; close?: boolean } = {}) {
    if (!id) throw new AppError(400, "A gate pass id is required.");
    const rule = RULES[action];
    const pass = await prisma.gatePass.findFirst({ where: { id, isDeleted: null }, select: { id: true, status: true } });
    if (!pass) throw new NotFoundError("Gate pass");

    const from = pass.status as Status;
    let to = rule.to;
    let allowedFrom = rule.from;

    // `return` with close=true targets CLOSED and is also allowed from RETURNED.
    if (action === "return" && opts.close) {
      to = Status.CLOSED;
      allowedFrom = [Status.DISPATCHED, Status.RETURNED];
    }

    if (!allowedFrom.includes(from)) {
      throw new AppError(409, `A ${from} gate pass cannot be ${to}.`);
    }

    const reason = (opts.reason || "").trim();
    if (rule.reasonRequired && reason.length < 3) {
      throw new AppError(400, `A reason (at least 3 characters) is required to ${action} a gate pass.`);
    }

    const actor = getActorId();

    await prisma.$transaction(async (tx: any) => {
      // Restock items that are coming back into inventory.
      if (shouldRestock(from, to)) {
        const lines = await tx.gatePassItem.findMany({ where: { gatePassId: id, isDeleted: null }, select: { itemId: true, quantity: true } });
        for (const l of lines) {
          if (l.itemId && l.quantity) {
            await tx.item.update({ where: { id: l.itemId }, data: { quantity: { increment: l.quantity } } });
          }
        }
      }
      // The status change itself (audited as STATUS_CHANGE via the audit extension).
      await tx.gatePass.update({ where: { id }, data: { status: to } });
      // Append the history row (reason + who + when). Excluded from auto-audit.
      await tx.gatePassStatusHistory.create({
        data: { gatePassId: id, fromStatus: from, toStatus: to, reason: reason || null, changedById: actor || null },
      });
    });

    return { success: true, message: `Gate pass ${to}.`, id, status: to, from };
  }

  /** Status history for a gate pass (newest first), with actor display names. */
  async history(gatePassId: string) {
    const rows = await prisma.gatePassStatusHistory.findMany({
      where: { gatePassId },
      orderBy: { changedAt: "desc" },
    });
    const ids = Array.from(new Set(rows.map((r) => r.changedById).filter(Boolean))) as string[];
    const users = ids.length
      ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, username: true, employee: { select: { name: true, surname: true } } } })
      : [];
    const map = new Map(users.map((u) => [u.id, u]));
    return rows.map((r) => {
      const u = r.changedById ? map.get(r.changedById) : null;
      const name = u?.employee ? `${u.employee.name || ""} ${u.employee.surname || ""}`.trim() : null;
      return { ...r, changedBy: u ? { id: u.id, username: u.username, name: name || u.username } : null };
    });
  }
}

/** Feature required for each transition (for featureMap parity / docs). */
export const TRANSITION_FEATURE: Record<TransitionAction, string> = {
  reject: RULES.reject.feature,
  cancel: RULES.cancel.feature,
  dispatch: RULES.dispatch.feature,
  return: RULES.return.feature,
};

export default GatePassWorkflowService;
