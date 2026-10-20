/**
 * Custom-widget engine. Takes a builder DEFINITION (entity + metric + group-by + filters + chart
 * type), validates every part against the whitelist, resolves the caller's scope, and computes the
 * result with Prisma groupBy / aggregate / count ONLY — never raw SQL and never a field that is not
 * whitelisted. Anything unknown is rejected (ValidationError); anything outside the caller's module
 * or scope is refused (ForbiddenError). Reused for both live preview and saved-widget rendering.
 */
import { ForbiddenError, ValidationError } from "../../../core/errors/app.error";
import { entityScope } from "../shared/scope";
import { moduleEnabled, holds, holdsRead, GOD_ID } from "../shared/gating";
import { Filters, parseWindow, dateWhere, GROUP_CAP, prisma } from "../shared/query";
import { ENTITY_BY_KEY, EntityDef, OPERATORS, AGGREGATIONS, Operator } from "./whitelist";

export interface CustomDef {
  entity: string;
  agg: typeof AGGREGATIONS[number];
  metricField?: string | null;
  groupBy?: { field?: string; dateField?: string; bucket?: "day" | "week" | "month" } | null;
  filters?: { field: string; op: Operator; value: any }[];
  chartType: string;
  colors?: string[];
  options?: any;
}

function assert(cond: any, msg: string): asserts cond { if (!cond) throw new ValidationError(msg); }

function canSee(userId: string, feats: Set<string>, e: EntityDef): boolean {
  if (userId === GOD_ID) return true;
  if (!moduleEnabled(feats, userId, e.module)) return false;
  // same read gate the catalog uses
  const base: Record<string, string> = { attendance: "attendance", visitor: "visitor", gatePass: "voucher", gatePassItem: "voucher", lead: "crm.lead", quotation: "crm.quotation", salesOrder: "crm.order", salesReturn: "crm.return", task: "work.task", dailyReport: "work.report", auditLog: "audit" };
  return holdsRead(feats, base[e.key]);
}

function buildFilterClause(e: EntityDef, f: { field: string; op: Operator; value: any }) {
  const def = e.filters.find((x) => x.field === f.field) || e.dates.find((x) => x.field === f.field);
  assert(def, `Field not allowed as filter: ${f.field}`);
  assert(OPERATORS.includes(f.op), `Bad operator: ${f.op}`);
  const isDate = !!e.dates.find((x) => x.field === f.field);
  const coerce = (v: any) => (isDate ? new Date(v) : v);
  switch (f.op) {
    case "eq": return { [f.field]: coerce(f.value) };
    case "ne": return { [f.field]: { not: coerce(f.value) } };
    case "in": { assert(Array.isArray(f.value), "`in` needs an array"); return { [f.field]: { in: f.value.map(coerce) } }; }
    case "gt": return { [f.field]: { gt: coerce(f.value) } };
    case "gte": return { [f.field]: { gte: coerce(f.value) } };
    case "lt": return { [f.field]: { lt: coerce(f.value) } };
    case "lte": return { [f.field]: { lte: coerce(f.value) } };
    case "contains": return { [f.field]: { contains: String(f.value), mode: "insensitive" } };
    default: throw new ValidationError(`Bad operator: ${f.op}`);
  }
}

const bucketOf = (dt: Date, bucket: "day" | "week" | "month"): string => {
  const y = dt.getFullYear();
  if (bucket === "month") return `${y}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
  if (bucket === "week") { const oj = new Date(y, 0, 1); const wk = Math.ceil((((dt.getTime() - oj.getTime()) / 864e5) + oj.getDay() + 1) / 7); return `${y}-W${String(wk).padStart(2, "0")}`; }
  return `${y}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

export async function runCustom(userId: string, feats: Set<string>, def: CustomDef, filters: Filters = {}) {
  const e = ENTITY_BY_KEY[def.entity];
  assert(e, `Unknown entity: ${def.entity}`);
  if (!canSee(userId, feats, e)) throw new ForbiddenError("This data is outside your access");
  assert(AGGREGATIONS.includes(def.agg), `Bad aggregation: ${def.agg}`);

  // metric field validation + cost gate
  let metricField: string | null = null;
  if (def.agg !== "count") {
    const m = e.metrics.find((x) => x.field === def.metricField);
    assert(m, `Metric not allowed: ${def.metricField}`);
    if (m.requires && userId !== GOD_ID && !holds(feats, m.requires)) throw new ForbiddenError(`You cannot read ${m.label}`);
    metricField = m.field;
  }

  const scope = await entityScope(userId, e.scopeEntity, feats);
  if (!scope.visible) return shape(def.chartType, { labels: [], data: [], rows: [], value: 0 });

  // where = live + scope + window + filters
  const and: any[] = [];
  if (e.key !== "auditLog") and.push({ isDeleted: null });
  and.push(scope.where);
  if (e.dateField) { const w = dateWhere(e.dateField, parseWindow(filters)); if (Object.keys(w).length) and.push(w); }
  for (const f of def.filters || []) and.push(buildFilterClause(e, f));
  const where = { AND: and };

  const model = (prisma as any)[e.model];
  const aggSel = () => (def.agg === "count" ? { _count: { _all: true } } : { [`_${def.agg}`]: { [metricField!]: true } });
  const readAgg = (r: any) => (def.agg === "count" ? r._count._all : Number(r[`_${def.agg}`]?.[metricField!] ?? 0));

  // ---- no group-by: single value ----
  if (!def.groupBy || (!def.groupBy.field && !def.groupBy.dateField)) {
    if (def.agg === "count") return shape(def.chartType, { value: await model.count({ where }) });
    const a = await model.aggregate({ where, ...aggSel() });
    return shape(def.chartType, { value: Number(a[`_${def.agg}`]?.[metricField!] ?? 0) });
  }

  // ---- group by a dimension ----
  if (def.groupBy.field) {
    const gf = def.groupBy.field;
    assert(e.dimensions.find((x) => x.field === gf), `Group-by not allowed: ${gf}`);
    const rows: any[] = await model.groupBy({ by: [gf], where, ...aggSel() });
    const mapped = rows.map((r) => ({ key: r[gf], value: readAgg(r) })).sort((a, b) => b.value - a.value).slice(0, GROUP_CAP);
    return shape(def.chartType, { labels: mapped.map((m) => String(m.key ?? "—")), data: mapped.map((m) => m.value), rows: mapped.map((m) => ({ label: String(m.key ?? "—"), value: m.value })) });
  }

  // ---- group by a date bucket (JS bucketing; groupBy can't truncate dates) ----
  const dfield = def.groupBy.dateField!;
  assert(e.dates.find((x) => x.field === dfield), `Date field not allowed: ${dfield}`);
  const bucket = def.groupBy.bucket || "day";
  const sel: any = { [dfield]: true }; if (metricField) sel[metricField] = true;
  const recs: any[] = await model.findMany({ where, select: sel, take: 50000 });
  const agg = new Map<string, { sum: number; n: number; min: number; max: number }>();
  for (const r of recs) {
    const dv = r[dfield]; if (!dv) continue;
    const k = bucketOf(new Date(dv), bucket);
    const v = metricField ? Number(r[metricField] ?? 0) : 1;
    const cur = agg.get(k) || { sum: 0, n: 0, min: Infinity, max: -Infinity };
    cur.sum += v; cur.n += 1; cur.min = Math.min(cur.min, v); cur.max = Math.max(cur.max, v);
    agg.set(k, cur);
  }
  const labels = [...agg.keys()].sort();
  const pick = (b: { sum: number; n: number; min: number; max: number }) =>
    def.agg === "count" ? b.n : def.agg === "sum" ? b.sum : def.agg === "avg" ? (b.n ? b.sum / b.n : 0) : def.agg === "min" ? (b.min === Infinity ? 0 : b.min) : (b.max === -Infinity ? 0 : b.max);
  const data = labels.map((l) => Math.round(pick(agg.get(l)!) * 100) / 100);
  return shape(def.chartType, { labels, data, rows: labels.map((l, i) => ({ label: l, value: data[i] })) });
}

function shape(chartType: string, parts: { labels?: string[]; data?: number[]; rows?: { label: string; value: number }[]; value?: number }) {
  const t = chartType;
  if (t === "kpi") return { value: parts.value ?? (parts.data ? parts.data.reduce((a, b) => a + b, 0) : 0) };
  if (t === "pie" || t === "donut") return { labels: parts.labels || [], data: parts.data || [] };
  if (t === "leaderboard") return { rows: parts.rows || [] };
  if (t === "table") return { columns: [{ key: "label", label: "Group" }, { key: "value", label: "Value" }], rows: (parts.rows || []).map((r) => ({ label: r.label, value: r.value })) };
  // bar / line / area
  return { labels: parts.labels || [], series: [{ name: "Value", data: parts.data || [] }] };
}
