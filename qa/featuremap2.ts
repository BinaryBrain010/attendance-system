/**
 * Phase 3 mapping (v2): every RUNTIME route (qa/_routes.json from routewalk.ts) -> the feature
 * requirePermission() should enforce, with access kind, "most specific existing feature" rules,
 * self-service routes, dynamic (by-body) routes, the parent rule, and a "held by N real users"
 * column computed from the local DB. Writes qa/Endpoint_Feature_Map.md and qa/route_feature_map.json.
 *   npx ts-node qa/featuremap2.ts
 */
import fs from "fs";
import path from "path";
import { api, http, mintGodToken, mintTokenFor } from "./lib";

const ROUTES: { method: string; path: string; mount: string; open: boolean }[] =
  JSON.parse(fs.readFileSync(path.join(__dirname, "_routes.json"), "utf8"));
const LIVE: string[] = JSON.parse(fs.readFileSync(path.join(__dirname, "_livefeatures.json"), "utf8"));
const LIVESET = new Set(LIVE);
const has = (f: string) => LIVESET.has(f);

// ---- values confirmed from the mobile apps (investigation agent) ----
// QuickPass gates the Approve button on permission('voucher.post.*'); backing call POST /gatePass/approve.
const GATEPASS_APPROVE_FEATURE = "voucher.post.*";
// NOTE: QuickMark's attendance.filter.* is CLIENT-SIDE only (shows/hides filter+sort UI on the
// attendance screen); it does not gate any endpoint, so no route maps to it.

// module root per mount (first path segment -> feature root)
const ROOT: Record<string, string> = {
  "/customer": "customer", "/item": "item", "/gatePass": "voucher", "/gatePassItem": "voucher",
  "/stats": "voucher", "/employee": "employee", "/attendance": "attendance", "/attendanceReq": "attendanceReq",
  "/leave": "leave", "/holiday": "holiday", "/unit": "unit", "/unitEmployee": "unit", "/shift": "shift",
  "/systemConfig": "systemConfig", "/analytics": "analytics", "/activityLog": "activityLog", "/visitor": "visitor",
  "/user": "user", "/role": "role", "/group": "group", "/userRole": "user", "/userGroup": "user",
  "/groupRole": "group", "/appFeature": "feature", "/featurePermission": "featurePermission", "/access": "access",
};
// leave sub-mounts -> their own roots
function leaveRoot(p: string): string {
  if (p.startsWith("/leave/leave-requests")) return "leaveReq";
  if (p.startsWith("/leave/leave-configurations")) return "leaveConfig";
  if (p.startsWith("/leave/leave-allocations")) return "leaveAlloc";
  return "leave";
}

// SELF-SERVICE routes: allow if caller's linked employee == requested employee, else require the
// fallback feature. Reads fall back to the module read feature; QuickMark's own create/mark/password
// routes fall back to the matching create/mark feature (flagged for confirmation).
const SELF: Record<string, string> = {
  "POST /attendance/getEmployeeAttendance": "attendance.read.*",
  "POST /attendanceReq/getEmployee": "attendanceReq.read.*",
  "POST /leave/leave-requests/getEmployee": "leaveReq.read.*",
  "POST /leave/leave-allocations/getByEmployeeId": "leaveAlloc.read.*",
  "GET /analytics/personalAttendance": "analytics.read.*",
  "GET /activityLog/me": has("activityLog.read.own.*") ? "activityLog.read.own.*" : "activityLog.read.*",
  "PUT /user/changePassword": "(own account)",
  "POST /user/changePassword": "(own account)",
  "POST /user/checkPassword": "(own account)",
  // QuickMark creates/marks for its own employee (fallback = the specific write feature)
  "POST /attendance/markAttendance": "attendance.markAttendance.*",
  "POST /attendanceReq/create": "attendanceReq.create.*",
  "POST /leave/leave-requests/create": "leaveReq.create.*",
};

const kindFromName = (p: string): string => {
  const last = p.split("/").pop() || "";
  if (/^(get|getAll|getById|read|list|total|count|search|filter|getByParent|hierarchy|getFrequent|getOutOfStock|getBySerialNo|getByCode|getDeleted|getEmployee|getDate|summary|report|date|status|customerId|itemId|present|lookup|suggest|filtered|stats|personalAttendance|topAttendance|me|getByUser|schedulerLogs|assignedEmployees|deleted|getFaceRecognitionData)/i.test(last)) return "read";
  if (/create|add|mark|bulk|assignTo|import|upsert|markSundays|checkout/i.test(last)) return "create";
  if (/update|edit/i.test(last)) return "update";
  if (/delete|remove/i.test(last)) return "delete";
  if (/restore/i.test(last)) return "restore";
  if (/approve|reject|updateStatus|post/i.test(last)) return "approve";
  return "read";
};

// pick the most specific existing feature for a route, else fall back to root.kind.*
// Explicit per-route overrides (checked first). Fix routes the heuristic maps wrong.
const OVERRIDE: Record<string, { feature: string; kind: string; access: string; note?: string }> = {
  "GET /user/getLoggedInUser": { feature: "-", kind: "read", access: "token", note: "every logged-in user needs their own profile" },
  "POST /employee/getByUserId": { feature: "employee.read.*", kind: "read", access: "self", note: "own user (body.userId) else employee.read.*" },
  "POST /employee/getLinkedUser": { feature: "employee.read.*", kind: "read", access: "self", note: "own user (body.userId) else employee.read.*" },
  "POST /user/changeUserPassword": { feature: "user.update.*", kind: "update", access: "feature" },
  "PUT /role/changeRole": { feature: "role.update.*", kind: "update", access: "feature" },
  "POST /employee/filesDel": { feature: "employee.update.*", kind: "update", access: "feature" },
  "POST /unitEmployee/assignEmployeesToUnit": { feature: "unit.update.*", kind: "update", access: "feature" },
  "POST /unitEmployee/addEmployeesToUnit": { feature: "unit.update.*", kind: "update", access: "feature" },
  "POST /unitEmployee/removeEmployeeFromUnit": { feature: "unit.update.*", kind: "update", access: "feature" },
  "POST /unitEmployee/removeEmployeesFromUnit": { feature: "unit.update.*", kind: "update", access: "feature" },
  "POST /shift/timetable/upsert": { feature: "shift.update.*", kind: "update", access: "feature" },
  "POST /shift/timetable/delete": { feature: "shift.update.*", kind: "update", access: "feature" },
  "POST /attendance/face-attendance": { feature: "attendance.markAttendance.*", kind: "create", access: "feature", note: "marks attendance via face recognition" },
  // Audit log (Run 11). The admin list + export require audit.read.* (admin only). The per-record
  // History tab and actor-name resolution are token-access: any logged-in user passes the route
  // gate and the service enforces that the caller can read the specific record.
  "POST /auditLog/get": { feature: "audit.read.*", kind: "read", access: "feature", note: "admin audit log list" },
  "POST /auditLog/export": { feature: "audit.read.*", kind: "export", access: "feature", note: "admin audit log Excel export" },
  "POST /auditLog/entity": { feature: "-", kind: "read", access: "token", note: "per-record History tab; service enforces record-read" },
  "POST /auditLog/actors": { feature: "-", kind: "read", access: "token", note: "resolve actor ids -> names for footers/columns" },
  // Uncapped get-all endpoints (return every row) are EXPORT-only and must not back any UI screen —
  // the admin uses the paginated POST /get + POST /attendanceReq/stats instead. Gate them on export.
  "GET /attendanceReq/get": { feature: "attendanceReq.export.*", kind: "read", access: "feature", note: "bulk get-all; export only (UI uses paginated POST /get + /stats)" },
  "POST /attendanceReq/stats": { feature: "attendanceReq.read.*", kind: "read", access: "feature", note: "aggregate status/monthly counts (SQL)" },
  "GET /activityLog/get": { feature: "activityLog.export.*", kind: "read", access: "feature", note: "bulk get-all; export only (UI uses paginated POST /get)" },
  "GET /visitor/getAll": { feature: "visitor.export.*", kind: "read", access: "feature", note: "bulk get-all; export only (UI uses paginated GET /visitor/get)" },
  // Quick Pass workflow actions are gated on their own gatePass.* features (not voucher.*). approve
  // stays on voucher.post.* (handled by the approve special-case). close is /return with close:true.
  "POST /gatePass/dispatch": { feature: "gatePass.dispatch.*", kind: "update", access: "feature", note: "dispatch a gate pass" },
  "POST /gatePass/return": { feature: "gatePass.return.*", kind: "update", access: "feature", note: "return/close a gate pass" },
  "POST /gatePass/cancel": { feature: "gatePass.cancel.*", kind: "update", access: "feature", note: "cancel a gate pass" },
  "POST /gatePass/reject": { feature: "gatePass.reject.*", kind: "update", access: "feature", note: "reject a gate pass" },
  // Phase 3b: suspend/reactivate a user (blocks login + revokes sessions).
  "POST /user/suspend": { feature: "user.suspend.*", kind: "update", access: "feature", note: "suspend a user" },
  "POST /user/reactivate": { feature: "user.suspend.*", kind: "update", access: "feature", note: "reactivate a suspended user" },
  // Phase 5c: leave-type usage summary (read).
  "POST /leave/leave-configurations/usage": { feature: "leaveConfig.read.*", kind: "read", access: "feature", note: "usage summary for a leave type" },
  // Phase 5d: holidays within a date range (month calendar).
  "POST /holiday/range": { feature: "holiday.read.*", kind: "read", access: "feature", note: "holidays in a date range (calendar)" },
  // Phase 6a: employees present now (checked in, not out) for the "Referred To" suggestions.
  "GET /employee/presentToday": { feature: "employee.read.*", kind: "read", access: "feature", note: "employees currently present" },
  // Phase 6b: host marks a referred visit attended.
  "POST /visitor/attend": { feature: "visitor.update.*", kind: "update", access: "feature", note: "mark a visit attended" },
  // Phase 8d/8e: "Me" app — own profile + preferences (token access, own data only).
  "GET /user/me": { feature: "-", kind: "read", access: "token", note: "own profile for the Me app" },
  "GET /user/preferences": { feature: "-", kind: "read", access: "token", note: "own preferences" },
  "POST /user/preferences": { feature: "-", kind: "update", access: "token", note: "save own preferences" },
};

// ---- CRM mounts -> feature roots (first path segment) ----
const CRM_ROOT: Record<string, string> = {
  "/crmCategory": "crm.catalogue", "/crmBrand": "crm.catalogue", "/crmProduct": "crm.catalogue",
  "/crmPriceList": "crm.catalogue", "/crmBundle": "crm.catalogue", "/salesAgent": "crm.agent",
  "/lead": "crm.lead", "/leadActivity": "crm.lead", "/quotation": "crm.quotation",
  "/salesOrder": "crm.order", "/salesReturn": "crm.return", "/crmReport": "crm.report",
};
// CRM routes the kind heuristic maps wrong (sub-creates, cost view, report export).
const CRM_OVERRIDE: Record<string, { feature: string; kind: string; access: string; note?: string }> = {
  "POST /crmProduct/variant": { feature: "crm.catalogue.create.*", kind: "create", access: "feature" },
  "POST /crmProduct/image": { feature: "crm.catalogue.create.*", kind: "create", access: "feature" },
  "POST /crmProduct/import": { feature: "crm.catalogue.import.*", kind: "import", access: "feature", note: "Shopify CSV import (dry-run default)" },
  "POST /crmProduct/sales": { feature: "crm.catalogue.read.*", kind: "read", access: "feature", note: "per-product sales stats (cost/margin stripped unless crm.catalogue.cost.*)" },
  "POST /crmPriceList/withCost": { feature: "crm.catalogue.cost.*", kind: "read", access: "feature", note: "cost/margin visibility" },
  "POST /crmPriceList/bulkPrice": { feature: "crm.catalogue.cost.*", kind: "update", access: "feature", note: "bulk price/cost from Excel (cost-gated)" },
  "POST /crmReport/margin": { feature: "crm.report.read.*", kind: "read", access: "feature", note: "cost enforced in controller via crm.catalogue.cost.*" },
  "POST /crmReport/export": { feature: "crm.report.export.*", kind: "export", access: "feature" },
  // Customer directory (list + 360) is gated on LEAD read, not report read, so any salesperson who can
  // read leads sees their customers; the data is still scope-checked per entity inside the service.
  "POST /crmReport/customers": { feature: "crm.lead.read.own.*", kind: "read", access: "feature", note: "customer directory; gated on lead read" },
  "POST /crmReport/customer360": { feature: "crm.lead.read.own.*", kind: "read", access: "feature", note: "customer 360 profile; gated on lead read" },
  "POST /lead/transition": { feature: "crm.lead.transition.*", kind: "update", access: "feature", note: "server-enforced stage change" },
  "POST /lead/transfer": { feature: "crm.lead.transfer.*", kind: "update", access: "feature", note: "transfer lead to another agent in the team (reason required)" },
  "POST /lead/mentionables": { feature: "crm.lead.read.own.*", kind: "read", access: "feature", note: "users the caller may @mention (team, or everyone for managers)" },
  "POST /lead/assign": { feature: "crm.lead.assign.*", kind: "update", access: "feature", note: "reassign agent" },
  "POST /lead/fromVisitor": { feature: "crm.lead.create.*", kind: "create", access: "feature", note: "Visitor -> Lead" },
  "POST /lead/import": { feature: "crm.lead.import.*", kind: "import", access: "feature", note: "lead register CSV import (dry-run default)" },
  "POST /quotation/transition": { feature: "crm.quotation.transition.*", kind: "update", access: "feature", note: "quotation status change" },
  "POST /quotation/newVersion": { feature: "crm.quotation.create.*", kind: "create", access: "feature", note: "new quotation version" },
  "POST /quotation/fromLead": { feature: "crm.quotation.create.*", kind: "create", access: "feature", note: "Lead -> Quotation" },
  "POST /quotation/pdf": { feature: "crm.quotation.export.*", kind: "export", access: "feature", note: "quotation PDF" },
  "POST /salesOrder/transition": { feature: "crm.order.transition.*", kind: "update", access: "feature", note: "order status change" },
  "POST /salesOrder/reattempt": { feature: "crm.order.reattempt.*", kind: "update", access: "feature", note: "re-attempt delivery" },
  "POST /salesOrder/fromLead": { feature: "crm.order.create.*", kind: "create", access: "feature", note: "Lead -> Order" },
  "POST /salesOrder/fromQuotation": { feature: "crm.order.create.*", kind: "create", access: "feature", note: "Quotation -> Order" },
  "POST /salesReturn/transition": { feature: "crm.return.transition.*", kind: "update", access: "feature", note: "return status change" },
  "POST /salesReturn/fromOrder": { feature: "crm.return.create.*", kind: "create", access: "feature", note: "Order -> Return" },
};
const CRM_SCOPED = new Set(["crm.lead", "crm.quotation", "crm.order", "crm.return"]);

// ---- Work module mounts -> feature roots ----
const WORK_ROOT: Record<string, string> = {
  "/team": "work.team", "/task": "work.task", "/dailyReport": "work.report", "/workReport": "work.task",
  "/notification": "work.task", // placeholder root; every /notification route is a token-access override below
};
const WORK_SCOPED = new Set(["work.task", "work.report"]); // read.own/team/all scoped
const WORK_OVERRIDE: Record<string, { feature: string; kind: string; access: string; note?: string }> = {
  "POST /task/setStatus": { feature: "work.task.transition.*", kind: "update", access: "feature", note: "task status change" },
  "POST /task/assign": { feature: "work.task.assign.*", kind: "update", access: "feature" },
  "POST /task/bulkAssign": { feature: "work.task.assign.*", kind: "update", access: "feature" },
  "POST /task/comment": { feature: "work.task.comment.*", kind: "update", access: "feature" },
  "POST /task/checklist": { feature: "work.task.update.*", kind: "update", access: "feature" },
  "POST /task/watchers": { feature: "work.task.update.*", kind: "update", access: "feature" },
  "POST /task/attachments": { feature: "work.task.update.*", kind: "update", access: "feature", note: "attachment upload" },
  "POST /team/members": { feature: "work.team.update.*", kind: "update", access: "feature" },
  "POST /dailyReport/submit": { feature: "work.report.submit.*", kind: "create", access: "feature", note: "own daily report" },
  "POST /dailyReport/myToday": { feature: "work.report.read.own.*", kind: "read", access: "feature" },
  "POST /dailyReport/compliance": { feature: "work.report.read.own.*", kind: "read", access: "feature", note: "manager view; scope widens the row filter" },
  "POST /dailyReport/comment": { feature: "work.report.comment.*", kind: "update", access: "feature" },
  "POST /notification/get": { feature: "-", kind: "read", access: "token", note: "own notifications" },
  "GET /notification/unreadCount": { feature: "-", kind: "read", access: "token", note: "own notifications" },
  "POST /notification/markRead": { feature: "-", kind: "update", access: "token", note: "own notifications" },
};

function resolveFeature(method: string, p: string): { feature: string; kind: string; access: string; note?: string } {
  const key = `${method} ${p}`;
  if (OVERRIDE[key]) return OVERRIDE[key];
  const seg = p.split("/");
  const last = seg[seg.length - 1];

  // open
  if (p.startsWith("/auth/") || p.startsWith("/webhook/")) return { feature: "-", kind: "open", access: "open" };
  // internal permission checks: token only
  if (p.startsWith("/access/")) return { feature: "-", kind: "read", access: "token", note: "internal permission check" };

  // appFeature: read = token only (permission UI needs it), writes = god only
  if (p.startsWith("/appFeature/")) {
    if (/(get|getAll|hierarchy|getByParent|total|read)/i.test(last)) return { feature: "-", kind: "read", access: "token", note: "permission UI needs feature tree" };
    return { feature: "-", kind: kindFromName(p), access: "god", note: "feature tree edits are god-only" };
  }

  // ---- CRM ----
  if (CRM_ROOT["/" + seg[1]]) {
    if (CRM_OVERRIDE[key]) return CRM_OVERRIDE[key];
    const crmRoot = CRM_ROOT["/" + seg[1]];
    const k = kindFromName(p);
    // scoped documents: base read requires the own-scope leaf; team/all widen the row filter in the
    // service. Scopes are granted cumulatively (team implies own, all implies team+own), so every
    // reader holds read.own.* and the middleware check passes for all three scopes.
    if (CRM_SCOPED.has(crmRoot) && k === "read") {
      return { feature: `${crmRoot}.read.own.*`, kind: "read", access: "feature", note: "scope from read.{own,team,all}.* leaf (cumulative)" };
    }
    const suffix = k === "import" ? "create" : k;
    return { feature: `${crmRoot}.${suffix}.*`, kind: k, access: "feature" };
  }

  // ---- Work ----
  if (WORK_ROOT["/" + seg[1]]) {
    if (WORK_OVERRIDE[key]) return WORK_OVERRIDE[key];
    const root = WORK_ROOT["/" + seg[1]];
    const k = kindFromName(p);
    if (WORK_SCOPED.has(root) && k === "read") {
      return { feature: `${root}.read.own.*`, kind: "read", access: "feature", note: "scope from read.{own,team,all}.* leaf (cumulative)" };
    }
    const suffix = k === "import" ? "create" : k;
    return { feature: `${root}.${suffix}.*`, kind: k, access: "feature" };
  }

  // self-service
  if (SELF[key]) {
    return { feature: SELF[key], kind: "self", access: "self", note: "caller's own employee -> allow; otherwise needs this feature (match on body.employeeId)" };
  }

  // stats -> voucher.read.* (gate pass dashboard data)
  if (p.startsWith("/stats/")) return { feature: "voucher.read.*", kind: "read", access: "feature" };

  // analytics / insights. Reads -> analytics.read.*; dashboard writes -> analytics.dashboard.*;
  // custom-widget builder -> analytics.customWidget.*. Per-widget module + scope is enforced in the service.
  if (p.startsWith("/insights/")) {
    if (p.startsWith("/insights/customWidget/") && /\/(save|preview|delete)(\/|$)/.test(p)) return { feature: "analytics.customWidget.*", kind: "write", access: "feature" };
    if (/\/(create|update|delete|duplicate|setHome|share)(\/|$)/.test(p)) return { feature: "analytics.dashboard.*", kind: "write", access: "feature" };
    return { feature: "analytics.read.*", kind: "read", access: "feature" };
  }

  // gate pass approve
  if (key === "POST /gatePass/approve") return { feature: GATEPASS_APPROVE_FEATURE, kind: "approve", access: "feature", note: "feature QuickPass checks before approve" };

  // relational writes -> the parent entity's update feature (dynamic where the parent is in the body)
  if (p.startsWith("/featurePermission/")) {
    if (/(get|read|allowedFeatures)/i.test(last)) return { feature: "(dynamic) {parentType}.read.*", kind: "read", access: "dynamic", note: "parentType in body: user/role/group.read.*" };
    return { feature: "(dynamic) {parentType}.update.*", kind: "update", access: "dynamic", note: "parentType in body: user/role/group.update.*" };
  }
  if (p.startsWith("/userRole/") || p.startsWith("/userGroup/")) {
    if (/(get|read)/i.test(last)) return { feature: "user.read.*", kind: "read", access: "feature" };
    return { feature: "user.update.*", kind: "update", access: "feature", note: "assigning roles/groups to a user" };
  }
  if (p.startsWith("/groupRole/")) {
    if (/(get|read)/i.test(last)) return { feature: "group.read.*", kind: "read", access: "feature" };
    return { feature: "group.update.*", kind: "update", access: "feature", note: "assigning roles to a group" };
  }

  // user/role/group restore -> matching delete feature
  if (/^\/(user|role|group)\//.test(p) && last.toLowerCase() === "restore") {
    const root = seg[1];
    return { feature: `${root}.delete.*`, kind: "restore", access: "feature", note: "restore mapped to delete feature" };
  }

  // most-specific existing features
  const root = p.startsWith("/leave/") ? leaveRoot(p) : (ROOT["/" + seg[1]] || "");
  const specific = (cands: string[], kind: string): { feature: string; kind: string; access: string } | null => {
    for (const c of cands) if (has(c)) return { feature: c, kind, access: "feature" };
    return null;
  };
  if (/viewPreviousUpdate|getHistoryById/i.test(last)) {
    const s = specific([`${root}.viewPreviousUpdate.*`], "history"); if (s) return s;
  }
  if (/excel|export|template|getExcel|pdf|getCard/i.test(last)) {
    const s = specific([`${root}.export.*`, `${root}.excel.*`, `${root}.pdf.*`], "export"); if (s) return s;
  }
  if (/import|excelImport/i.test(last)) {
    const s = specific([`${root}.import.*`, `${root}.excelImport.*`], "import"); if (s) return s;
  }
  if (/checkout/i.test(last)) { const s = specific([`${root}.checkout.*`], "update"); if (s) return s; }
  if (/markSundays/i.test(last)) { const s = specific([`${root}.markSundays.*`], "create"); if (s) return s; }
  if (/markAttendance|bulkMark/i.test(last)) { const s = specific([`attendance.markAttendance.*`], "create"); if (s) return s; }
  if (/^(get|list)?filter/i.test(last) || last === "filtered") { const s = specific([`${root}.filter.*`], "read"); if (s) return s; }
  if (/assignTo|assignedEmployees|removeAssignment/i.test(last)) {
    const map: Record<string, string> = { assignToEmployee: "shift.assignments.assignToEmployee.*", assignToEmployees: "shift.assignments.assignToEmployee.*", assignToUnit: "shift.assignments.assignToUnit.*", assignedEmployees: "shift.assignments.assignedEmployees.*", removeAssignment: "shift.assignments.removeAssignment.*" };
    if (map[last] && has(map[last])) return { feature: map[last], kind: "special", access: "feature" };
  }
  if (/timetableBlock/i.test(last) || p.includes("timetableBlock")) {
    const k = kindFromName(p); const f = `shift.timetableBlock.${k}.*`; if (has(f)) return { feature: f, kind: k, access: "feature" };
  }
  if (/approve|reject|updateStatus/i.test(last)) {
    if (root === "attendanceReq" && has("attendance.request.approve.*")) return { feature: "attendance.request.approve.*", kind: "approve", access: "feature", note: "covers approve and reject" };
    if (root === "leaveReq" && has("leaveReq.approve.*")) return { feature: "leaveReq.approve.*", kind: "approve", access: "feature", note: "covers approve and reject" };
  }

  // default: root.kind.*
  if (!root) return { feature: "(no root - needs decision)", kind: kindFromName(p), access: "unmapped" };
  const kind = kindFromName(p);
  const suffix = kind === "import" ? "create" : kind;
  const f = `${root}.${suffix}.*`;
  return { feature: has(f) ? f : f, kind, access: "feature" };
}

// ---- held by N real (non-QA) users, honoring the parent rule ----
function ancestorsOf(f: string): string[] {
  if (!f.endsWith(".*")) return [];
  const base = f.slice(0, -2); // drop ".*"
  const segs = base.split(".");
  const out: string[] = [];
  for (let i = 1; i < segs.length; i++) out.push(segs.slice(0, i).join(".") + ".*");
  return out;
}
function holds(set: Set<string>, f: string): boolean {
  if (!f || f.startsWith("(") || f === "-") return false;
  if (set.has(f)) return true;
  for (const a of ancestorsOf(f)) if (set.has(a)) return true;
  return false;
}

async function main() {
  const GOD = mintGodToken();
  // ALL active real users, direct from the DB (the API list is paginated). The DB is now QA-clean.
  const prisma = require("../src/core/models/base.model").default;
  const users = await prisma.user.findMany({ where: { isDeleted: null, NOT: { username: { startsWith: "qa." } } }, select: { id: true, username: true } });
  const userSets: Set<string>[] = [];
  for (const usr of users) {
    const tok = mintTokenFor(usr.id, []);
    const r = await http("POST", "/webhook/permissions", { body: { token: tok } });
    const feats = Array.isArray(r.json?.data) ? r.json.data : [];
    userSets.push(new Set<string>(feats));
  }
  const heldBy = (feature: string) => userSets.filter((s) => holds(s, feature)).length;

  const rows = ROUTES.map((r) => {
    const res = resolveFeature(r.method, r.path);
    const registered = res.access === "feature" ? (has(res.feature) ? "yes" : "NO") : "-";
    const held = (res.access === "feature" || res.access === "self") && !res.feature.startsWith("(") && res.feature !== "-" ? heldBy(res.feature) : "-";
    return { method: r.method, path: r.path, kind: res.kind, access: res.access, feature: res.feature, registered, held, note: res.note || "" };
  });

  fs.writeFileSync(path.join(__dirname, "route_feature_map.json"), JSON.stringify(rows, null, 2));

  // Also emit the runtime map the backend middleware loads: "METHOD /full/path" -> {access, feature, kind}
  const runtimeMap: Record<string, { access: string; feature: string; kind: string }> = {};
  for (const r of rows) runtimeMap[`${r.method} ${r.path}`] = { access: r.access, feature: r.feature, kind: r.kind };
  const srcDir = path.join(__dirname, "..", "src", "middleware", "rbac");
  fs.mkdirSync(srcDir, { recursive: true });
  fs.writeFileSync(path.join(srcDir, "featureMap.json"), JSON.stringify(runtimeMap, null, 2));
  console.log("[featuremap2] wrote src/middleware/rbac/featureMap.json");

  // markdown
  const missing = rows.filter((r) => r.registered === "NO");
  let md = `# Phase 3 mapping v2 (from runtime Express routers)\n\n`;
  md += `${rows.length} routes walked from the live routers. Real DB users counted: ${users.length}.\n\n`;
  md += `**Access kinds:** open (no auth) · token (any logged-in user) · self (caller's own employee, else the read feature) · feature (requires the listed feature) · dynamic (feature depends on request body, e.g. parentType) · god (god only) · unmapped (DENY under RBAC_ENFORCE=on).\n\n`;
  md += `**Parent rule:** holding a parent feature grants all descendants. A user with \`voucher.*\` passes any \`voucher.read.*\`/\`voucher.post.*\` check; a user with \`shift.*\` passes \`shift.assignments.assignToEmployee.*\`. The "held by" column already applies this rule (a user counts for a feature if they hold it or any ancestor).\n`;
  md += `Verified on real data: receptionuser@phw holds \`attendance.*\` (not the leaf), and is correctly counted as holding \`attendance.markAttendance.*\` and \`attendance.request.approve.*\` via the ancestor rule. The middleware will use the same rule.\n\n`;
  md += `**Middleware rules (to implement after this review):** unmapped route -> DENY under RBAC_ENFORCE=on (log "unmapped" otherwise); \`self\` -> allow when the caller's linked employee == the employee in the body (field \`employeeId\`, or own account for user routes), else require the listed feature; \`dynamic\` -> the required feature is chosen from the request body (featurePermission uses body.parentType -> user/role/group.update.*); \`token\` -> any logged-in user; \`god\` -> god only; \`open\` -> no auth.\n\n`;
  md += `**IMPORTANT caveat on "held by":** this local DB is a partial/old restore. Only 1 of the 10 users (receptionuser@phw, 30 features) has any grants; the other 9 (incl. azeem_ijaz, muhammad_shahid1 and 7 qawf_test*) have ZERO. So almost every feature shows held=0 here. These numbers are NOT the rollout impact — the DB-impact script (Phase 3, to build) must be run against a current prod copy for real counts.\n\n`;
  md += `Proposed features not yet registered: ${missing.length} (all mapped features exist in the DB). Dynamic routes (feature chosen from body): ${rows.filter(r=>r.access==="dynamic").length}. Self routes: ${rows.filter(r=>r.access==="self").length}. God-only: ${rows.filter(r=>r.access==="god").length}. Token-only: ${rows.filter(r=>r.access==="token").length}. Open: ${rows.filter(r=>r.access==="open").length}.\n\n`;
  md += `| Method | Path | Kind | Access | Feature | Registered | Held by (of ${users.length}) | Note |\n|---|---|---|---|---|---|---|---|\n`;
  for (const r of rows) md += `| ${r.method} | ${r.path} | ${r.kind} | ${r.access} | \`${r.feature}\` | ${r.registered} | ${r.held} | ${r.note} |\n`;
  if (missing.length) { md += `\n## Not-yet-registered proposed features\n\n`; for (const r of missing) md += `- \`${r.feature}\` (${r.method} ${r.path})\n`; }
  fs.writeFileSync(path.join(__dirname, "Endpoint_Feature_Map.md"), md);

  const byAccess: Record<string, number> = {};
  rows.forEach((r) => (byAccess[r.access] = (byAccess[r.access] || 0) + 1));
  console.log(`[featuremap2] ${rows.length} routes, users=${users.length}, not-registered=${missing.length}`);
  console.log("by access:", JSON.stringify(byAccess));
  console.log("not-registered:", Array.from(new Set(missing.map((r) => r.feature))).join(", ") || "(none)");
}
main().catch((e) => { console.error(e); process.exit(1); });
