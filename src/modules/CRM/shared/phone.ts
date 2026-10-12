/**
 * Phone normalization for CRM records. `phoneNormalized` stores the digits only (no spaces, dashes or
 * +92), so lookups do not have to cope with every stored format. It is indexed on Lead, SalesOrder,
 * SalesReturn and Quotation. Matching uses the last 7 digits (the subscriber number) which is stable
 * across 0300-1234567 / +92 300 1234567 / 3001234567.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  const d = String(phone || "").replace(/\D/g, "");
  return d || null;
}

/** The last-7-digit needle used to match a phone against stored phoneNormalized values. */
export function phoneNeedle(phone: string | null | undefined): string {
  const d = String(phone || "").replace(/\D/g, "");
  return d.length >= 7 ? d.slice(-7) : d;
}
