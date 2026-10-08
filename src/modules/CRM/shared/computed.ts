/**
 * Computed CRM values (never stored): probability by stage, weighted pipeline, follow-up status,
 * aging, margin. The stage->probability map is the default; it will move into SystemConfig (JSONB
 * `crm` key) in a later phase so it is tunable without a deploy.
 */
export const STAGE_PROBABILITY: Record<string, number> = {
  DRAFT: 5,
  NEW: 10,
  CONTACTED: 25,
  QUALIFIED: 40,
  QUOTATION: 60,
  NEGOTIATION: 75,
  WON: 100,
  LOST: 0,
  ON_HOLD: 20,
};

/** Open = not yet won/lost. */
export const OPEN_STAGES = ["DRAFT", "NEW", "CONTACTED", "QUALIFIED", "QUOTATION", "NEGOTIATION", "ON_HOLD"];

export function probabilityFor(stage: string): number {
  return STAGE_PROBABILITY[stage] ?? 0;
}

export function weightedValue(stage: string, estimatedValue: number | null | undefined): number {
  return Math.round(((estimatedValue || 0) * probabilityFor(stage)) / 100);
}

export function daysBetween(from: Date | null | undefined, to: Date = new Date()): number | null {
  if (!from) return null;
  return Math.floor((to.getTime() + 0 - new Date(from).getTime()) / 86400000);
}

export function followUpStatus(nextFollowUpAt: Date | null | undefined, now: Date = new Date()): string {
  if (!nextFollowUpAt) return "NONE";
  const a = new Date(nextFollowUpAt); a.setHours(0, 0, 0, 0);
  const b = new Date(now); b.setHours(0, 0, 0, 0);
  if (a.getTime() < b.getTime()) return "OVERDUE";
  if (a.getTime() === b.getTime()) return "DUE_TODAY";
  return "UPCOMING";
}
