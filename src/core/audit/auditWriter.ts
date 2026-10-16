/**
 * Builds and writes AuditLog rows. Pure helpers plus writeAudit (called by the Prisma extension
 * inside the business transaction) and auditEvent (called explicitly for non-DB events:
 * LOGIN / LOGOUT / LOGIN_FAILED / PERMISSION_CHANGE / EXPORT / IMPORT).
 *
 * Only changed fields are recorded. Secrets are masked; large/binary fields are collapsed to a
 * marker so the log stays small. See docs/AUDIT_INVENTORY.md for excluded tables.
 */
import { getContext, SYSTEM_USER_ID } from "../context/requestContext";

type AnyRec = Record<string, any>;

// model name -> module label (for filtering in the UI).
const MODULE: Record<string, string> = {
  Customer: "App", Item: "App", GatePass: "App", GatePassItem: "App",
  User: "RBAC", Group: "RBAC", Role: "RBAC", UserGroup: "RBAC", UserRole: "RBAC", GroupRole: "RBAC",
  AppFeature: "RBAC", FeaturePermission: "RBAC",
  Employee: "AMS", Attendance: "AMS", LeaveRequest: "AMS", AttendanceRequest: "AMS",
  LeaveConfiguration: "AMS", LeaveAllocation: "AMS", Shift: "AMS", ShiftTimetable: "AMS",
  ShiftTimetableBlock: "AMS", ShiftAssignment: "AMS", Holiday: "AMS", Unit: "AMS",
  UnitEmployee: "AMS", SystemConfig: "AMS",
  Team: "Work", TeamMember: "Work", Task: "Work", TaskAssignee: "Work", TaskChecklistItem: "Work",
  TaskComment: "Work", TaskWatcher: "Work", DailyReport: "Work", DailyReportComment: "Work",
  Visitor: "Frontdesk",
  Category: "CRM", Brand: "CRM", Product: "CRM", ProductVariant: "CRM", ProductImage: "CRM",
  PriceList: "CRM", Bundle: "CRM", BundleItem: "CRM", SalesAgent: "CRM", Lead: "CRM",
  LeadActivity: "CRM", Quotation: "CRM", QuotationItem: "CRM", SalesOrder: "CRM",
  SalesOrderItem: "CRM", SalesReturn: "CRM", ReturnItem: "CRM",
};
export function moduleFor(model: string): string | null {
  return MODULE[model] || null;
}

// Models whose writes are always a permission/role change.
const PERMISSION_MODELS = new Set(["FeaturePermission", "UserRole", "GroupRole", "UserGroup", "Role", "Group"]);
// Models whose writes are an assignment.
const ASSIGN_MODELS = new Set(["TaskAssignee", "TaskWatcher"]);

const SENSITIVE_RE = /pass|password|token|otp|secret|apikey|api_key|signature|faceDescriptor/i;
// Large/binary fields collapsed to a marker instead of stored verbatim.
const BIG_FIELDS = new Set([
  "image", "images", "filePaths", "previousUpdates", "specs", "attributes", "config",
  "faceDescriptor", "metadata", "readAccess", "writeAccess", "permissions",
]);
const MAX_VAL_LEN = 1000;

function redact(key: string, val: any): any {
  if (SENSITIVE_RE.test(key)) return "***";
  if (BIG_FIELDS.has(key)) return "[redacted]";
  if (typeof val === "string" && val.length > MAX_VAL_LEN) return "[large]";
  return val;
}

function eq(a: any, b: any): boolean {
  if (a === b) return true;
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
}

/** Diff before/after for the keys the writer touched (keys). Returns only changed fields. */
export function diffChanges(before: AnyRec | null, after: AnyRec | null, keys: string[]): AnyRec {
  const out: AnyRec = {};
  for (const k of keys) {
    if (k === "createdById" || k === "updatedById" || k === "deletedById" || k === "updatedAt") continue;
    const b = before ? before[k] : undefined;
    const a = after ? after[k] : undefined;
    if (BIG_FIELDS.has(k)) {
      if (!eq(b, a)) out[k] = { before: "[changed]", after: "[changed]" };
      continue;
    }
    if (!eq(b, a)) out[k] = { before: redact(k, b), after: redact(k, a) };
  }
  return out;
}

function lowerFirst(s: string): string { return s.charAt(0).toLowerCase() + s.slice(1); }

/** Decide the action verb for a write op given the computed change set. */
export function actionFor(model: string, operation: string, args: AnyRec, changes: AnyRec): string {
  if (operation === "delete" || operation === "deleteMany") return "DELETE";
  if (operation === "create" || operation === "createMany" || operation === "createManyAndReturn") {
    if (ASSIGN_MODELS.has(model)) return "ASSIGN";
    if (PERMISSION_MODELS.has(model)) return "PERMISSION_CHANGE";
    return "CREATE";
  }
  // update / updateMany / upsert
  const data = args && args.data ? args.data : {};
  if (Object.prototype.hasOwnProperty.call(data, "isDeleted")) {
    if (data.isDeleted === null) return "RESTORE";
    if (data.isDeleted !== undefined) return "DELETE"; // soft delete
  }
  if (PERMISSION_MODELS.has(model)) return "PERMISSION_CHANGE";
  if (ASSIGN_MODELS.has(model)) return "ASSIGN";
  if (changes && (changes.status || changes.stage)) return "STATUS_CHANGE";
  if (changes && changes.agentId) return "ASSIGN";
  return "UPDATE";
}

/** Load the pre-image of a single-row update/delete/upsert on the given tx client. */
export async function loadBefore(txClient: any, model: string, operation: string, args: AnyRec): Promise<AnyRec | null> {
  if (!args || !args.where) return null;
  if (!["update", "delete", "upsert"].includes(operation)) return null;
  const delegate = txClient[lowerFirst(model)];
  if (!delegate) return null;
  try {
    return await delegate.findUnique({ where: args.where });
  } catch {
    try { return await delegate.findFirst({ where: args.where }); } catch { return null; }
  }
}

export interface AuditInput {
  model: string;
  operation: string;
  args: AnyRec;
  before: AnyRec | null;
  result: any;
}

/** Insert one AuditLog row on the given (transaction) client for a business write. */
export async function writeAudit(txClient: any, input: AuditInput): Promise<void> {
  const { model, operation, args, before, result } = input;
  const ctx = getContext();
  let changes: AnyRec | null = null;
  let entityId: string | null = null;

  if (operation === "createMany" || operation === "updateMany" || operation === "deleteMany") {
    changes = { filter: args.where ?? null, count: (result && typeof result.count === "number") ? result.count : undefined };
  } else if (operation === "create" || operation === "createManyAndReturn") {
    const after = (result && typeof result === "object" && !Array.isArray(result)) ? result : (args.data || {});
    entityId = after && after.id ? after.id : null;
    changes = diffChanges(null, after, Object.keys(args.data || {}));
  } else if (operation === "delete") {
    entityId = before && before.id ? before.id : (args.where && args.where.id) || null;
    changes = { deleted: true };
  } else {
    // update / upsert
    const after = (result && typeof result === "object") ? result : null;
    entityId = (after && after.id) || (before && before.id) || (args.where && args.where.id) || null;
    const keys = Object.keys((operation === "upsert" ? args.update : args.data) || {});
    changes = diffChanges(before, after, keys);
    // An update that changed nothing auditable still logs the attempt (empty changes) only for
    // status-free updates? Keep it: record even empty so the actor/time is captured.
  }

  const action = actionFor(model, operation, args, changes || {});

  // Skip no-op updates (nothing meaningful changed, e.g. an upsert that re-set the same values, or a
  // save that only touched updatedAt/updatedById). CREATE/DELETE/RESTORE/STATUS_CHANGE/ASSIGN always log.
  if (action === "UPDATE" && (!changes || Object.keys(changes).length === 0)) return;

  await txClient.auditLog.create({
    data: {
      module: moduleFor(model),
      entity: model,
      entityId,
      action,
      changes: changes && Object.keys(changes).length ? changes : undefined,
      userId: ctx?.userId ?? null,
      ip: ctx?.ip ?? null,
      userAgent: ctx?.userAgent ?? null,
      platform: ctx?.platform ?? null,
      requestId: ctx?.requestId ?? null,
    },
  });
}

/** Explicit event (no business row): LOGIN / LOGOUT / LOGIN_FAILED / PERMISSION_CHANGE / EXPORT / IMPORT.
 * ip/userAgent/platform/requestId can be passed explicitly (e.g. from the login handler, which runs
 * before the context middleware); otherwise they come from the request context. */
export async function auditEvent(
  client: any,
  opts: {
    module?: string | null; entity: string; entityId?: string | null; action: string;
    changes?: AnyRec | null; userId?: string | null;
    ip?: string | null; userAgent?: string | null; platform?: string | null; requestId?: string | null;
  },
): Promise<void> {
  const ctx = getContext();
  try {
    await client.auditLog.create({
      data: {
        module: opts.module ?? null,
        entity: opts.entity,
        entityId: opts.entityId ?? null,
        action: opts.action,
        changes: opts.changes ?? undefined,
        userId: opts.userId ?? ctx?.userId ?? null,
        ip: opts.ip ?? ctx?.ip ?? null,
        userAgent: opts.userAgent ?? ctx?.userAgent ?? null,
        platform: opts.platform ?? ctx?.platform ?? null,
        requestId: opts.requestId ?? ctx?.requestId ?? null,
      },
    });
  } catch (e) {
    // Explicit events are best-effort: never break a login/export because logging failed.
    // eslint-disable-next-line no-console
    console.error("auditEvent failed:", (e as Error)?.message);
  }
}

export { lowerFirst, SYSTEM_USER_ID };
