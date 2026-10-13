/**
 * Phone normalization for CRM records.
 *
 * `phoneNormalized` stores the full national number: the 10 significant digits of a Pakistani number
 * with no spaces, dashes, leading 0 or +92. So 0300-1234567, +92 300 1234567 and 03001234567 all
 * become "3001234567". Two different numbers never collide: 0300-1234567 -> "3001234567" and
 * 0321-1234567 -> "3211234567" are not equal.
 *
 * Exact-match the whole national number for lookups (lead form, customer 360, phone filter). There is
 * no last-N-digit matching anywhere.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  let d = String(phone || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0092")) d = d.slice(4);          // 0092 300 ... -> 300...
  else if (d.startsWith("92") && d.length === 12) d = d.slice(2); // 92 300 ... (country code) -> 300...
  else if (d.startsWith("0") && d.length === 11) d = d.slice(1);  // 0300 ... (trunk 0) -> 300...
  return d || null;
}

/**
 * Looser digit form for the free-text search box so a partial phone still matches (prefix or suffix):
 * strips a leading 0 or 92 regardless of length, then the caller uses `contains`. Not used for the
 * exact phone lookups.
 */
export function searchPhoneDigits(s: string | null | undefined): string {
  let d = String(s || "").replace(/\D/g, "");
  if (d.startsWith("0092")) d = d.slice(4);
  else if (d.startsWith("92")) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  return d;
}
