/**
 * Shared analytics query helpers: date windows from global filters, Prisma where fragments, grouped
 * counts (capped), and JS time-bucketing. Keeps the widget registry small and consistent. All group
 * results are capped (default 50) so a runaway group-by can never return unbounded rows.
 */
import prisma from "../../../core/models/base.model";

export const GROUP_CAP = 50;

export interface Filters {
  from?: string | Date;
  to?: string | Date;
  preset?: string;        // today | 7d | 30d | 90d | thisMonth | thisYear | all
  unitId?: string;
  teamId?: string;
  agentId?: string;
  bucket?: "day" | "week" | "month";
}

export interface Window { from?: Date; to?: Date }

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

/** Resolve a {from,to} window from explicit dates or a preset. No preset + no dates => unbounded. */
export function parseWindow(f: Filters = {}): Window {
  if (f.from || f.to) {
    return { from: f.from ? new Date(f.from) : undefined, to: f.to ? new Date(f.to) : undefined };
  }
  const now = new Date();
  const to = now;
  switch (f.preset) {
    case "today": return { from: startOfDay(now), to };
    case "7d": return { from: startOfDay(new Date(now.getTime() - 6 * 864e5)), to };
    case "30d": return { from: startOfDay(new Date(now.getTime() - 29 * 864e5)), to };
    case "90d": return { from: startOfDay(new Date(now.getTime() - 89 * 864e5)), to };
    case "thisMonth": return { from: new Date(now.getFullYear(), now.getMonth(), 1), to };
    case "thisYear": return { from: new Date(now.getFullYear(), 0, 1), to };
    default: return {};
  }
}

/** The previous window of equal length (for KPI trend vs previous period). */
export function previousWindow(w: Window): Window | null {
  if (!w.from || !w.to) return null;
  const len = w.to.getTime() - w.from.getTime();
  return { from: new Date(w.from.getTime() - len), to: new Date(w.from.getTime()) };
}

/** Prisma where-fragment for a date field within a window (empty when unbounded). */
export function dateWhere(field: string, w: Window): Record<string, any> {
  if (!w.from && !w.to) return {};
  const range: any = {};
  if (w.from) range.gte = w.from;
  if (w.to) range.lte = w.to;
  return { [field]: range };
}

export const todayWhere = (field: string): Record<string, any> => dateWhere(field, parseWindow({ preset: "today" }));

/** Base `where` for a model: live rows + scope + date window. */
export function baseWhere(scopeWhere: Record<string, any>, dateField: string | null, w: Window): Record<string, any> {
  const and: any[] = [{ isDeleted: null }, scopeWhere];
  if (dateField) { const d = dateWhere(dateField, w); if (Object.keys(d).length) and.push(d); }
  return { AND: and };
}

/** groupBy a single field with _count, sorted desc, capped. Returns [{key,count}]. */
export async function groupCount(model: string, by: string, where: Record<string, any>, cap = GROUP_CAP): Promise<Array<{ key: any; count: number }>> {
  const rows: any[] = await (prisma as any)[model].groupBy({ by: [by], where, _count: { _all: true } });
  return rows
    .map((r) => ({ key: r[by], count: r._count._all as number }))
    .sort((a, b) => b.count - a.count)
    .slice(0, cap);
}

/** groupBy a field summing a numeric column, sorted desc, capped. Returns [{key,sum}]. */
export async function groupSum(model: string, by: string, field: string, where: Record<string, any>, cap = GROUP_CAP): Promise<Array<{ key: any; sum: number }>> {
  const rows: any[] = await (prisma as any)[model].groupBy({ by: [by], where, _sum: { [field]: true } });
  return rows
    .map((r) => ({ key: r[by], sum: Number(r._sum?.[field] ?? 0) }))
    .sort((a, b) => b.sum - a.sum)
    .slice(0, cap);
}

const bucketKey = (d: Date, bucket: "day" | "week" | "month"): string => {
  const y = d.getFullYear();
  if (bucket === "month") return `${y}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  if (bucket === "week") { const onejan = new Date(y, 0, 1); const wk = Math.ceil((((d.getTime() - onejan.getTime()) / 864e5) + onejan.getDay() + 1) / 7); return `${y}-W${String(wk).padStart(2, "0")}`; }
  return `${y}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Bucket an array of dates into an ordered {labels,data} time series. */
export function bucketSeries(dates: Array<Date | null | undefined>, bucket: "day" | "week" | "month" = "day"): { labels: string[]; data: number[] } {
  const counts = new Map<string, number>();
  for (const d of dates) { if (!d) continue; const k = bucketKey(new Date(d), bucket); counts.set(k, (counts.get(k) || 0) + 1); }
  const labels = Array.from(counts.keys()).sort();
  return { labels, data: labels.map((l) => counts.get(l) || 0) };
}

export { prisma };
