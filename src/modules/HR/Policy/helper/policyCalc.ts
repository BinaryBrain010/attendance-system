/**
 * Pure HR-policy maths — no DB, fully unit-testable. Service-length bands, yearly entitlement
 * (flat on Jan 1 or pro-rata across a mid-year band crossing) and probation default end date.
 */

export interface PolicyRuleLike {
  minYears: number;
  maxYears: number | null;
  annualLeaveDays: number;
  leaveByType?: Record<string, number> | null;
  medicalEligible: boolean;
  effectiveFrom: Date | string;
  isActive?: boolean;
  isDeleted?: Date | null;
}

/** Completed (whole) years of service from `joiningDate` to `asOf`. 11 months -> 0, 3y1d -> 3. */
export function completedServiceYears(joiningDate: Date | string, asOf: Date | string): number {
  const j = new Date(joiningDate);
  const a = new Date(asOf);
  let years = a.getFullYear() - j.getFullYear();
  // The anniversary in asOf's year; if we haven't reached it yet, we've completed one fewer year.
  const anniv = new Date(a.getFullYear(), j.getMonth(), j.getDate());
  if (a < anniv) years -= 1;
  return Math.max(0, years);
}

/**
 * The rule that applies for `years` of service as of `asOf`. Band is [minYears, maxYears) with
 * maxYears exclusive (null = open-ended). Among matching, the latest effectiveFrom <= asOf wins.
 */
export function applicableRule<T extends PolicyRuleLike>(rules: T[], years: number, asOf: Date | string): T | null {
  const a = new Date(asOf);
  const eligible = rules.filter(
    (r) =>
      !r.isDeleted &&
      r.isActive !== false &&
      new Date(r.effectiveFrom) <= a &&
      years >= r.minYears &&
      (r.maxYears == null || years < r.maxYears)
  );
  if (!eligible.length) return null;
  eligible.sort((x, y) => new Date(y.effectiveFrom).getTime() - new Date(x.effectiveFrom).getTime());
  return eligible[0];
}

function daysInYear(year: number): number {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}
function dayDiff(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000));
}

export interface EntitlementResult {
  year: number;
  serviceYearsAtStart: number;
  annualLeaveDays: number; // rounded entitlement for the year
  medicalEligible: boolean;
  proRated: boolean;
  rule: PolicyRuleLike | null;
  detail: string;
}

/**
 * Yearly leave entitlement for `year`, derived from joining date and the matching rule.
 * - Default: the rule that applies on Jan 1 of the year (flat).
 * - Pro-rata (setting): if the employee crosses into a higher band on their anniversary within the
 *   year, blend the two bands' daily rates by the days spent in each. Medical eligibility follows the
 *   band in force at year end.
 */
export function entitlementForYear(
  joiningDate: Date | string,
  year: number,
  rules: PolicyRuleLike[],
  proRata: boolean
): EntitlementResult {
  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);
  const j = new Date(joiningDate);
  const yearsAtStart = completedServiceYears(j, jan1);
  const ruleStart = applicableRule(rules, yearsAtStart, jan1);

  const base: EntitlementResult = {
    year,
    serviceYearsAtStart: yearsAtStart,
    annualLeaveDays: ruleStart?.annualLeaveDays ?? 0,
    medicalEligible: ruleStart?.medicalEligible ?? false,
    proRated: false,
    rule: ruleStart,
    detail: ruleStart ? `Flat band ${ruleStart.minYears}+ : ${ruleStart.annualLeaveDays} days` : "No rule",
  };

  if (!proRata) return base;

  // Anniversary within this year (exclusive of Jan 1, since Jan-1 anniversaries are already counted).
  const anniv = new Date(year, j.getMonth(), j.getDate());
  if (!(anniv > jan1 && anniv <= dec31)) return base;

  const ruleBefore = applicableRule(rules, yearsAtStart, new Date(anniv.getTime() - 1));
  const ruleAfter = applicableRule(rules, yearsAtStart + 1, anniv);
  const before = ruleBefore?.annualLeaveDays ?? 0;
  const after = ruleAfter?.annualLeaveDays ?? 0;
  if (!ruleAfter || before === after) return base; // no band change in rate -> flat is correct

  const total = daysInYear(year);
  const daysBefore = dayDiff(anniv, jan1); // days in the lower band
  const daysAfter = total - daysBefore;
  const prorated = Math.round((before * daysBefore) / total + (after * daysAfter) / total);

  return {
    year,
    serviceYearsAtStart: yearsAtStart,
    annualLeaveDays: prorated,
    medicalEligible: ruleAfter.medicalEligible,
    proRated: true,
    rule: ruleAfter,
    detail: `Pro-rata: ${before}d×${daysBefore}/${total} + ${after}d×${daysAfter}/${total} = ${prorated}`,
  };
}

/** Human label for the service band, e.g. "Under 1 year", "1–3 years", "3+ years". */
export function bandLabel(rule: PolicyRuleLike | null): string {
  if (!rule) return "—";
  if (rule.maxYears == null) return `${rule.minYears}+ years`;
  if (rule.minYears === 0 && rule.maxYears === 1) return "Under 1 year";
  return `${rule.minYears}–${rule.maxYears} years`;
}

/** Default probation end = joining date + `months` calendar months. */
export function probationDefaultEnd(joiningDate: Date | string, months: number): Date {
  const d = new Date(joiningDate);
  d.setMonth(d.getMonth() + months);
  return d;
}
