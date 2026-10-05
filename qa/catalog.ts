/**
 * Endpoint catalog for the RBAC/module QA suite.
 * Each entry: module, guard feature (the feature that SHOULD gate it per the RBAC model),
 * HTTP method, path (relative to the module mount), and a "kind" for CRUD-lifecycle testing.
 *
 * NOTE (key finding): backend routes are AUTHENTICATED-ONLY — there is no per-route permission
 * enforcement. The `guard` column is what *should* guard the route (what the frontend checks),
 * used to detect where a user WITHOUT the feature can still read/mutate (a security finding).
 */

export type Kind =
  | "read" | "list" | "create" | "update" | "delete" | "restore"
  | "search" | "history" | "export" | "import" | "approve" | "special";

export interface Endpoint { m: "GET" | "POST" | "PUT" | "DELETE"; p: string; kind: Kind; skipGodRead?: boolean }
export interface ModuleDef {
  module: string;
  mount: string;        // e.g. "/employee"
  guard: string;        // feature prefix that should guard it (frontend)
  open?: boolean;       // registered as an open (no-auth) route
  endpoints: Endpoint[];
}

export const CATALOG: ModuleDef[] = [
  { module: "Auth", mount: "/auth", guard: "(platform-gated login)", open: true, endpoints: [
    { m: "POST", p: "/login", kind: "special" },
    { m: "GET", p: "/logout", kind: "special" },
    { m: "GET", p: "/logoutOfAllDevices", kind: "special" },
    { m: "POST", p: "/logoutUserOfAllDevices", kind: "special" },
  ]},
  { module: "Webhook", mount: "/webhook", guard: "(none)", open: true, endpoints: [
    { m: "POST", p: "/permissions", kind: "read" },
    { m: "GET", p: "/permissions", kind: "read" },
  ]},

  { module: "Customer", mount: "/customer", guard: "customer.*", endpoints: [
    { m: "GET", p: "/get", kind: "list" }, { m: "GET", p: "/getFrequent", kind: "read" },
    { m: "POST", p: "/get", kind: "list" }, { m: "POST", p: "/getDeleted", kind: "list" },
    { m: "GET", p: "/total", kind: "read" }, { m: "POST", p: "/create", kind: "create" },
    { m: "PUT", p: "/update", kind: "update" }, { m: "POST", p: "/search", kind: "search" },
    { m: "POST", p: "/delete", kind: "delete" }, { m: "POST", p: "/getById", kind: "read" },
    { m: "POST", p: "/restore", kind: "restore" },
  ]},
  { module: "Item", mount: "/item", guard: "item.*", endpoints: [
    { m: "GET", p: "/get", kind: "list" }, { m: "GET", p: "/getOutOfStock", kind: "read" },
    { m: "POST", p: "/get", kind: "list" }, { m: "POST", p: "/getDeleted", kind: "list" },
    { m: "GET", p: "/total", kind: "read" }, { m: "POST", p: "/create", kind: "create" },
    { m: "PUT", p: "/update", kind: "update" }, { m: "POST", p: "/delete", kind: "delete" },
    { m: "POST", p: "/search", kind: "search" }, { m: "POST", p: "/getById", kind: "read" },
    { m: "POST", p: "/restore", kind: "restore" }, { m: "POST", p: "/getBySerialNo", kind: "read" },
  ]},
  { module: "GatePass", mount: "/gatePass", guard: "voucher.*", endpoints: [
    { m: "GET", p: "/get", kind: "list" }, { m: "GET", p: "/report", kind: "read" },
    { m: "POST", p: "/get", kind: "list" }, { m: "POST", p: "/getDeleted", kind: "list" },
    { m: "GET", p: "/total", kind: "read" }, { m: "POST", p: "/create", kind: "create" },
    { m: "PUT", p: "/update", kind: "update" }, { m: "POST", p: "/delete", kind: "delete" },
    { m: "POST", p: "/date", kind: "read" }, { m: "POST", p: "/status", kind: "read" },
    { m: "POST", p: "/approve", kind: "approve" }, { m: "POST", p: "/getById", kind: "read" },
    { m: "POST", p: "/customerId", kind: "read" }, { m: "POST", p: "/itemId", kind: "read" },
    { m: "POST", p: "/pdf", kind: "export" }, { m: "POST", p: "/restore", kind: "restore" },
  ]},
  { module: "GatePassItem", mount: "/gatePassItem", guard: "voucher.*", endpoints: [
    { m: "GET", p: "/get", kind: "list" }, { m: "POST", p: "/get", kind: "list" },
    { m: "GET", p: "/total", kind: "read" }, { m: "POST", p: "/create", kind: "create" },
    { m: "PUT", p: "/update", kind: "update" }, { m: "POST", p: "/delete", kind: "delete" },
    { m: "POST", p: "/getById", kind: "read" }, { m: "POST", p: "/restore", kind: "restore" },
  ]},
  { module: "Stats", mount: "/stats", guard: "(none - FINDING)", endpoints: [
    { m: "GET", p: "/dashboard", kind: "read" }, { m: "GET", p: "/gatePass", kind: "read" },
    { m: "GET", p: "/customer", kind: "read" }, { m: "GET", p: "/item", kind: "read" },
    { m: "POST", p: "/dateRange", kind: "read" }, { m: "GET", p: "/widgets", kind: "read" },
  ]},

  { module: "Employee", mount: "/employee", guard: "employee.*", endpoints: [
    { m: "GET", p: "/get", kind: "list" }, { m: "POST", p: "/get", kind: "list" },
    { m: "GET", p: "/getFaceRecognitionData", kind: "read" }, { m: "POST", p: "/getDeleted", kind: "list" },
    { m: "GET", p: "/total", kind: "read" }, { m: "POST", p: "/create", kind: "create" },
    { m: "PUT", p: "/update", kind: "update" }, { m: "POST", p: "/search", kind: "search" },
    { m: "POST", p: "/delete", kind: "delete" }, { m: "POST", p: "/getById", kind: "read" },
    { m: "POST", p: "/getByCode", kind: "read" }, { m: "POST", p: "/restore", kind: "restore" },
    { m: "GET", p: "/getExcel", kind: "export" }, { m: "POST", p: "/getCard", kind: "export" },
    { m: "POST", p: "/getHistoryById", kind: "history" }, { m: "POST", p: "/stats", kind: "read" },
  ]},
  { module: "Attendance", mount: "/attendance", guard: "attendance.*", endpoints: [
    { m: "GET", p: "/get", kind: "list" }, { m: "POST", p: "/get", kind: "list" },
    { m: "POST", p: "/getDate", kind: "read" }, { m: "POST", p: "/getEmployeeAttendance", kind: "read" },
    { m: "GET", p: "/total", kind: "read" }, { m: "POST", p: "/getById", kind: "read" },
    { m: "POST", p: "/create", kind: "create" }, { m: "POST", p: "/markAttendance", kind: "create" },
    { m: "POST", p: "/bulkMarkAttendance", kind: "create" }, { m: "PUT", p: "/update", kind: "update" },
    { m: "POST", p: "/restore", kind: "restore" }, { m: "POST", p: "/delete", kind: "delete" },
    { m: "POST", p: "/search", kind: "search" }, { m: "POST", p: "/excel", kind: "export" },
    { m: "POST", p: "/import", kind: "import" }, { m: "POST", p: "/summary", kind: "read" },
  ]},
  { module: "AttendanceReq", mount: "/attendanceReq", guard: "attendanceReq.*", endpoints: [
    { m: "GET", p: "/get", kind: "list" }, { m: "POST", p: "/get", kind: "list" },
    { m: "POST", p: "/getEmployee", kind: "read" }, { m: "POST", p: "/search", kind: "search" },
    { m: "GET", p: "/total", kind: "read" }, { m: "POST", p: "/create", kind: "create" },
    { m: "PUT", p: "/update", kind: "update" }, { m: "POST", p: "/delete", kind: "delete" },
    { m: "POST", p: "/restore", kind: "restore" }, { m: "POST", p: "/updateStatus", kind: "approve" },
    { m: "POST", p: "/getById", kind: "read" }, { m: "POST", p: "/bulkUpdateStatus", kind: "approve" },
  ]},
  { module: "LeaveReq", mount: "/leave/leave-requests", guard: "leaveReq.*", endpoints: [
    { m: "GET", p: "/get", kind: "list" }, { m: "POST", p: "/get", kind: "list" },
    { m: "POST", p: "/getEmployee", kind: "read" }, { m: "POST", p: "/search", kind: "search" },
    { m: "GET", p: "/total", kind: "read" }, { m: "POST", p: "/create", kind: "create" },
    { m: "PUT", p: "/update", kind: "update" }, { m: "POST", p: "/delete", kind: "delete" },
    { m: "POST", p: "/restore", kind: "restore" }, { m: "POST", p: "/updateStatus", kind: "approve" },
    { m: "GET", p: "/getById", kind: "read" },
  ]},
  { module: "LeaveConf", mount: "/leave/leave-configurations", guard: "leaveConfig.*", endpoints: [
    { m: "GET", p: "/getAll", kind: "list" }, { m: "POST", p: "/get", kind: "list" },
    { m: "POST", p: "/create", kind: "create" }, { m: "PUT", p: "/update", kind: "update" },
    { m: "POST", p: "/delete", kind: "delete" }, { m: "POST", p: "/restore", kind: "restore" },
    { m: "POST", p: "/getById", kind: "read" }, { m: "POST", p: "/search", kind: "search" },
    { m: "GET", p: "/total", kind: "read" },
  ]},
  { module: "LeaveAlloc", mount: "/leave/leave-allocations", guard: "leaveAlloc.*", endpoints: [
    { m: "GET", p: "/get", kind: "list" }, { m: "POST", p: "/get", kind: "list" },
    { m: "POST", p: "/search", kind: "search" }, { m: "GET", p: "/total", kind: "read" },
    { m: "POST", p: "/create", kind: "create" }, { m: "PUT", p: "/update", kind: "update" },
    { m: "POST", p: "/delete", kind: "delete" }, { m: "POST", p: "/restore", kind: "restore" },
    { m: "GET", p: "/getById", kind: "read" }, { m: "POST", p: "/getByEmployeeId", kind: "read" },
    { m: "POST", p: "/assignToAll", kind: "special" },
  ]},
  { module: "Holiday", mount: "/holiday", guard: "holiday.*", endpoints: [
    { m: "GET", p: "/getAll", kind: "list" }, { m: "GET", p: "/get", kind: "list" },
    { m: "GET", p: "/getById", kind: "read" }, { m: "GET", p: "/total", kind: "read" },
    { m: "POST", p: "/create", kind: "create" }, { m: "PUT", p: "/update", kind: "update" },
    { m: "POST", p: "/delete", kind: "delete" }, { m: "POST", p: "/restore", kind: "restore" },
    { m: "POST", p: "/search", kind: "search" }, { m: "POST", p: "/markSundays", kind: "special" },
    { m: "POST", p: "/getHistoryById", kind: "history" },
  ]},
  { module: "Shift", mount: "/shift", guard: "shift.*", endpoints: [
    { m: "GET", p: "/getAll", kind: "list" }, { m: "GET", p: "/get", kind: "list" },
    { m: "GET", p: "/getById", kind: "read" }, { m: "GET", p: "/total", kind: "read" },
    { m: "POST", p: "/create", kind: "create" }, { m: "PUT", p: "/update", kind: "update" },
    { m: "POST", p: "/delete", kind: "delete" }, { m: "POST", p: "/restore", kind: "restore" },
    { m: "POST", p: "/search", kind: "search" }, { m: "POST", p: "/assignToEmployee", kind: "special" },
    { m: "POST", p: "/assignedEmployees", kind: "read" },
  ]},
  { module: "Unit", mount: "/unit", guard: "unit.*", endpoints: [
    { m: "GET", p: "/getAll", kind: "list" }, { m: "GET", p: "/get", kind: "list" },
    { m: "GET", p: "/getById", kind: "read" }, { m: "GET", p: "/total", kind: "read" },
    { m: "POST", p: "/create", kind: "create" }, { m: "PUT", p: "/update", kind: "update" },
    { m: "POST", p: "/delete", kind: "delete" }, { m: "POST", p: "/restore", kind: "restore" },
    { m: "POST", p: "/search", kind: "search" }, { m: "POST", p: "/getHistoryById", kind: "history" },
  ]},
  { module: "SystemConfig", mount: "/systemConfig", guard: "systemConfig.* (UI uses setting.* - FINDING)", endpoints: [
    { m: "GET", p: "/get", kind: "read" }, { m: "PUT", p: "/update", kind: "update" },
    { m: "GET", p: "/schedulerLogs", kind: "read" },
  ]},
  { module: "Analytics", mount: "/analytics", guard: "analytics.*", endpoints: [
    { m: "GET", p: "/personalAttendance", kind: "read" }, { m: "GET", p: "/topAttendance", kind: "read" },
  ]},
  { module: "ActivityLog", mount: "/activityLog", guard: "activityLog.* (no UI bucket - FINDING)", endpoints: [
    { m: "GET", p: "/get", kind: "list" }, { m: "GET", p: "/count", kind: "read" },
    { m: "POST", p: "/getByUser", kind: "read" }, { m: "GET", p: "/me", kind: "read" },
  ]},

  { module: "Visitor", mount: "/visitor", guard: "visitor.*", endpoints: [
    { m: "GET", p: "/getAll", kind: "list" }, { m: "GET", p: "/get", kind: "list" },
    { m: "GET", p: "/getById", kind: "read" }, { m: "GET", p: "/deleted", kind: "list" },
    { m: "GET", p: "/total", kind: "read" }, { m: "GET", p: "/template", kind: "export" },
    { m: "POST", p: "/create", kind: "create" }, { m: "PUT", p: "/update", kind: "update" },
    { m: "POST", p: "/checkout", kind: "update" }, { m: "POST", p: "/delete", kind: "delete" },
    { m: "POST", p: "/restore", kind: "restore" }, { m: "POST", p: "/search", kind: "search" },
    { m: "POST", p: "/stats", kind: "read" }, { m: "GET", p: "/present", kind: "read" },
    { m: "POST", p: "/personHistory", kind: "history" }, { m: "POST", p: "/lookup", kind: "read" },
    { m: "POST", p: "/suggest", kind: "read" }, { m: "POST", p: "/filtered", kind: "list" },
    { m: "POST", p: "/excel", kind: "export" },
  ]},

  { module: "User", mount: "/user", guard: "user.*", endpoints: [
    { m: "GET", p: "/get", kind: "list" }, { m: "POST", p: "/get", kind: "list" },
    { m: "POST", p: "/search", kind: "search" }, { m: "POST", p: "/getById", kind: "read" },
    { m: "GET", p: "/total", kind: "read" }, { m: "POST", p: "/create", kind: "create" },
    { m: "PUT", p: "/update", kind: "update" }, { m: "POST", p: "/delete", kind: "delete" },
    { m: "POST", p: "/restore", kind: "restore" },
  ]},
  { module: "Role", mount: "/role", guard: "role.*", endpoints: [
    { m: "GET", p: "/get", kind: "list" }, { m: "POST", p: "/get", kind: "list" },
    { m: "GET", p: "/total", kind: "read" }, { m: "POST", p: "/getById", kind: "read" },
    { m: "POST", p: "/create", kind: "create" }, { m: "PUT", p: "/update", kind: "update" },
    { m: "POST", p: "/delete", kind: "delete" }, { m: "POST", p: "/restore", kind: "restore" },
    { m: "POST", p: "/search", kind: "search" },
  ]},
  { module: "Group", mount: "/group", guard: "group.*", endpoints: [
    { m: "GET", p: "/get", kind: "list" }, { m: "POST", p: "/get", kind: "list" },
    { m: "GET", p: "/total", kind: "read" }, { m: "POST", p: "/getById", kind: "read" },
    { m: "POST", p: "/create", kind: "create" }, { m: "PUT", p: "/update", kind: "update" },
    { m: "POST", p: "/delete", kind: "delete" }, { m: "POST", p: "/restore", kind: "restore" },
    { m: "POST", p: "/search", kind: "search" },
  ]},
  { module: "Feature", mount: "/appFeature", guard: "feature.*", endpoints: [
    { m: "GET", p: "/get", kind: "list" }, { m: "GET", p: "/hierarchy", kind: "read" },
    { m: "GET", p: "/total", kind: "read" }, { m: "POST", p: "/getByParent", kind: "read" },
    { m: "POST", p: "/create", kind: "create" }, { m: "PUT", p: "/update", kind: "update" },
    { m: "POST", p: "/delete", kind: "delete" }, { m: "POST", p: "/restore", kind: "restore" },
  ]},
  { module: "FeaturePermission", mount: "/featurePermission", guard: "featurePermission.*", endpoints: [
    // NOTE: POST /get maps to getFeaturePermissionById (requires body.id). Missing id -> 500 (minor robustness finding).
    { m: "GET", p: "/get", kind: "list" }, { m: "POST", p: "/get", kind: "read", skipGodRead: true },
    { m: "POST", p: "/allowedFeatures", kind: "read" }, { m: "POST", p: "/create", kind: "create" },
    { m: "PUT", p: "/update", kind: "update" }, { m: "POST", p: "/delete", kind: "delete" },
    { m: "POST", p: "/restore", kind: "restore" },
  ]},
  { module: "Access", mount: "/access", guard: "(none)", endpoints: [
    { m: "POST", p: "/checkPermission", kind: "read" }, { m: "POST", p: "/checkPermissions", kind: "read" },
    { m: "POST", p: "/getPermission", kind: "read" },
  ]},
];

export function allEndpoints(): { module: string; mount: string; guard: string; m: string; p: string; kind: Kind }[] {
  const out: any[] = [];
  for (const mod of CATALOG) for (const e of mod.endpoints)
    out.push({ module: mod.module, mount: mod.mount, guard: mod.guard, m: e.m, p: e.p, kind: e.kind });
  return out;
}
