/**
 * Custom-widget builder whitelist — the SINGLE source of truth for what a user may query with the
 * no-SQL builder. Only safe scalar fields are listed (never passwords, tokens, CNIC, salaries,
 * signatures, or cost — cost columns live on child item tables and are deliberately not exposed;
 * add them here only behind `requires: 'crm.catalogue.cost.*'`). Extend day-2 entities by adding an
 * entry here and nothing else. Every query the builder runs is validated against this list and ANDed
 * with the caller's entity scope, so the builder can never widen reach or read an un-whitelisted field.
 */
import { Entity } from "../shared/scope";
import { ModuleKey } from "../shared/gating";

export type FieldKind = "dim" | "date" | "num";
export interface FieldDef { field: string; label: string; kind: FieldKind; requires?: string }

export interface EntityDef {
  key: string;            // builder id, e.g. "lead"
  model: string;          // prisma delegate name, e.g. "lead"
  label: string;
  module: ModuleKey;      // appModules gate
  scopeEntity: Entity;    // which entityScope to apply
  dateField: string | null; // default date field for the global window
  dimensions: FieldDef[]; // group-by eligible (scalar)
  dates: FieldDef[];      // date fields (bucketable + windowable)
  metrics: FieldDef[];    // numeric fields (sum/avg/min/max); count is always available
  filters: FieldDef[];    // filterable scalar fields
}

const d = (field: string, label: string): FieldDef => ({ field, label, kind: "dim" });
const dt = (field: string, label: string): FieldDef => ({ field, label, kind: "date" });
const n = (field: string, label: string, requires?: string): FieldDef => ({ field, label, kind: "num", requires });

export const ENTITIES: EntityDef[] = [
  {
    key: "attendance", model: "attendance", label: "Attendance", module: "quickMark", scopeEntity: "attendance", dateField: "date",
    dimensions: [d("status", "Status"), d("employeeId", "Employee"), d("location", "Location")],
    dates: [dt("date", "Date")], metrics: [],
    filters: [d("status", "Status"), d("employeeId", "Employee"), d("location", "Location")],
  },
  {
    key: "visitor", model: "visitor", label: "Visitor", module: "frontdesk", scopeEntity: "visitor", dateField: "visitDate",
    dimensions: [d("outcome", "Outcome"), d("purchased", "Purchased"), d("referredToEmployeeId", "Referred to")],
    dates: [dt("visitDate", "Visit date")], metrics: [n("purchaseAmount", "Purchase amount")],
    filters: [d("outcome", "Outcome"), d("purchased", "Purchased"), d("referredToEmployeeId", "Referred to")],
  },
  {
    key: "gatePass", model: "gatePass", label: "Gate pass", module: "quickPass", scopeEntity: "gatePass", dateField: "createdAt",
    dimensions: [d("status", "Status"), d("customerId", "Recipient"), d("location", "Location"), d("storeIncharge", "Store incharge")],
    dates: [dt("createdAt", "Created"), dt("issuedAt", "Issued")], metrics: [],
    filters: [d("status", "Status"), d("customerId", "Recipient"), d("location", "Location")],
  },
  {
    key: "gatePassItem", model: "gatePassItem", label: "Gate pass item", module: "quickPass", scopeEntity: "gatePassItem", dateField: "createdAt",
    dimensions: [d("itemId", "Item")], dates: [dt("createdAt", "Created")], metrics: [n("quantity", "Quantity")],
    filters: [d("itemId", "Item")],
  },
  {
    key: "lead", model: "lead", label: "Lead", module: "crm", scopeEntity: "lead", dateField: "dateReceived",
    dimensions: [d("stage", "Stage"), d("channel", "Channel"), d("city", "City"), d("company", "Company"), d("agentId", "Agent"), d("priority", "Priority")],
    dates: [dt("dateReceived", "Received"), dt("nextFollowUpAt", "Next follow-up")], metrics: [n("estimatedValue", "Estimated value")],
    filters: [d("stage", "Stage"), d("channel", "Channel"), d("city", "City"), d("company", "Company"), d("agentId", "Agent"), d("priority", "Priority")],
  },
  {
    key: "quotation", model: "quotation", label: "Quotation", module: "crm", scopeEntity: "quotation", dateField: "createdAt",
    dimensions: [d("status", "Status"), d("tier", "Tier"), d("company", "Company"), d("agentId", "Agent")],
    dates: [dt("createdAt", "Created"), dt("validUntil", "Valid until")], metrics: [n("total", "Total"), n("subtotal", "Subtotal"), n("discount", "Discount")],
    filters: [d("status", "Status"), d("tier", "Tier"), d("company", "Company"), d("agentId", "Agent")],
  },
  {
    key: "salesOrder", model: "salesOrder", label: "Sales order", module: "crm", scopeEntity: "salesOrder", dateField: "createdAt",
    dimensions: [d("status", "Status"), d("channel", "Channel"), d("paymentType", "Payment"), d("company", "Company"), d("city", "City"), d("agentId", "Agent")],
    dates: [dt("createdAt", "Created"), dt("dispatchedAt", "Dispatched"), dt("deliveredAt", "Delivered")],
    metrics: [n("total", "Total"), n("subtotal", "Subtotal"), n("discount", "Discount"), n("amountReceived", "Amount received"), n("reattemptCount", "Reattempts")],
    filters: [d("status", "Status"), d("channel", "Channel"), d("company", "Company"), d("city", "City"), d("agentId", "Agent")],
  },
  {
    key: "salesReturn", model: "salesReturn", label: "Sales return", module: "crm", scopeEntity: "salesReturn", dateField: "reportedAt",
    dimensions: [d("status", "Status"), d("reason", "Reason"), d("city", "City"), d("company", "Company"), d("agentId", "Agent")],
    dates: [dt("reportedAt", "Reported")], metrics: [],
    filters: [d("status", "Status"), d("city", "City"), d("company", "Company"), d("agentId", "Agent")],
  },
  {
    key: "task", model: "task", label: "Task", module: "work", scopeEntity: "task", dateField: "createdAt",
    dimensions: [d("status", "Status"), d("priority", "Priority"), d("teamId", "Team"), d("company", "Company")],
    dates: [dt("createdAt", "Created"), dt("dueDate", "Due"), dt("completedAt", "Completed")], metrics: [n("estimateHours", "Estimate (h)")],
    filters: [d("status", "Status"), d("priority", "Priority"), d("teamId", "Team")],
  },
  {
    key: "dailyReport", model: "dailyReport", label: "Daily report", module: "work", scopeEntity: "dailyReport", dateField: "date",
    dimensions: [d("employeeId", "Employee"), d("late", "Late")], dates: [dt("date", "Date")], metrics: [n("hours", "Hours")],
    filters: [d("employeeId", "Employee"), d("late", "Late")],
  },
  {
    key: "auditLog", model: "auditLog", label: "Audit log", module: "access", scopeEntity: "auditLog", dateField: "createdAt",
    dimensions: [d("module", "Module"), d("entity", "Entity"), d("action", "Action"), d("userId", "User"), d("platform", "Platform")],
    dates: [dt("createdAt", "Created")], metrics: [],
    filters: [d("module", "Module"), d("entity", "Entity"), d("action", "Action"), d("userId", "User")],
  },
];

export const ENTITY_BY_KEY: Record<string, EntityDef> = Object.fromEntries(ENTITIES.map((e) => [e.key, e]));

export const OPERATORS = ["eq", "ne", "in", "gt", "gte", "lt", "lte", "contains"] as const;
export type Operator = (typeof OPERATORS)[number];
export const CHART_TYPES = ["bar", "line", "area", "pie", "donut", "kpi", "table", "leaderboard"] as const;
export const AGGREGATIONS = ["count", "sum", "avg", "min", "max"] as const;
