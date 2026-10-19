/**
 * Which models carry which audit actor columns. Kept in one place so the stamping extension
 * (stamp.ts) and the audit-log writer (auditExtension.ts, Part 3) agree on what exists.
 *
 * The column set per model must match prisma/schema.prisma exactly: stamping a column a model
 * does not have makes Prisma throw "Unknown argument". See docs/AUDIT_INVENTORY.md for the
 * classification (business / feed / line-item / join / excluded).
 */

// Top-level business models: createdById + updatedById + deletedById.
export const FULL: string[] = [
  "Customer", "Item", "GatePass", "User", "Group", "Role", "FeaturePermission",
  "Employee", "Attendance", "LeaveRequest", "AttendanceRequest", "LeaveConfiguration", "LeaveAllocation",
  "Shift", "ShiftAssignment", "Team", "Task", "DailyReport", "Holiday", "Unit", "Visitor",
  "Category", "Brand", "Product", "PriceList", "Bundle", "SalesAgent", "Lead", "Quotation", "SalesOrder", "SalesReturn",
];

// Append-only feeds: createdById only (immutable, no update/delete stamping).
const FEED = ["LeadActivity", "TaskComment", "DailyReportComment"];

export const HAS_CREATED_BY = new Set<string>([...FULL, ...FEED]);
export const HAS_UPDATED_BY = new Set<string>([...FULL, "SystemConfig"]);
export const HAS_DELETED_BY = new Set<string>(FULL);

// Models excluded from the central AuditLog entirely (session / token / log / noise). Used in Part 3.
export const AUDIT_EXCLUDE = new Set<string>([
  "BlacklistToken", "LoggedInUsers", "AttendanceScheduler", "Notification", "ActivityLog", "AuditLog",
  // ImpersonationSession is logged via explicit IMPERSONATE_START/END events, not row auto-audit.
  "ImpersonationSession",
  // GatePassStatusHistory IS the status log; the GatePass status change itself is already audited.
  "GatePassStatusHistory",
]);

// Write operations the extension acts on. Reads are passed straight through.
export const WRITE_OPS = new Set<string>([
  "create", "createMany", "createManyAndReturn",
  "update", "updateMany", "updateManyAndReturn",
  "upsert", "delete", "deleteMany",
]);
