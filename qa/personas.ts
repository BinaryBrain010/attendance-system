/**
 * QA persona / role / group definitions.
 * Feature strings are "desired"; run.ts intersects them with the live AppFeature table and
 * records any desired-but-unregistered features as notes/gaps. Single-module users get ALL
 * live features under their module prefix (computed at runtime).
 */

export const HR_PREFIXES = ["employee", "attendance", "attendanceReq", "leaveReq", "leaveConfig", "leaveAlloc", "holiday", "shift"];

/** Roles: each gets a FeaturePermission of parentType=Role. */
export const ROLES: Record<string, { features: string[] }> = {
  QA_RoleGatePassView: { features: ["login.admin.*", "voucher.read.*"] },
  QA_RoleHR: { features: ["login.admin.*", "attendance.request.approve.*"] }, // HR module features expanded at runtime from HR_PREFIXES; approve feature lets HR approve attendance requests
  QA_RoleMixedDirectRole: { features: ["employee.read.*"] },   // for QA_Mixed via direct role
  QA_RoleMixedViaGroup: { features: ["holiday.read.*"] },      // for QA_Mixed via role-in-group
};

/** Groups: FeaturePermission of parentType=Group (own features) + roles linked via GroupRole. */
export const GROUPS: Record<string, { features: string[]; roles: string[] }> = {
  QA_GrpGatePass: { features: ["login.admin.*", "voucher.*"], roles: [] },
  QA_GrpHR: { features: ["login.admin.*"], roles: ["QA_RoleHR"] },        // HR via role-in-group
  QA_GrpMixed: { features: ["shift.read.*"], roles: ["QA_RoleMixedViaGroup"] }, // group own + role-in-group
};

export interface Persona {
  name: string;
  /** platforms on which login SHOULD succeed */
  platformsAllowed: ("Mobile" | "Admin" | "Attendance App")[];
  directFeatures: string[];
  roles: string[];   // userRole links
  groups: string[];  // userGroup links
  unitIds?: string[]; // set in JWT via token (we test unit scoping with a minted token)
  /** modulePrefix => grant ALL live features under this prefix as DIRECT (single-module users) */
  modulePrefix?: string;
  note?: string;
}

export const NAMED_PERSONAS: Persona[] = [
  { name: "QA_NoAccess", platformsAllowed: [], directFeatures: [], roles: [], groups: [] },
  { name: "QA_AdminLogin_NoModules", platformsAllowed: ["Admin"], directFeatures: ["login.admin.*"], roles: [], groups: [] },
  { name: "QA_MobileOnly", platformsAllowed: ["Mobile"], directFeatures: ["login.app.*", "voucher.read.*"], roles: [], groups: [] },
  { name: "QA_QuickMarkOnly", platformsAllowed: ["Attendance App"], directFeatures: ["login.quickmark.*", "attendanceReq.create.*", "attendance.filter.*"], roles: [], groups: [] },
  { name: "QA_GatePassViewer", platformsAllowed: ["Admin"], directFeatures: [], roles: ["QA_RoleGatePassView"], groups: [] },
  { name: "QA_GatePassManager", platformsAllowed: ["Admin"], directFeatures: [], roles: [], groups: ["QA_GrpGatePass"] },
  { name: "QA_HR", platformsAllowed: ["Admin"], directFeatures: [], roles: [], groups: ["QA_GrpHR"] }, // HR via role-in-group
  { name: "QA_Frontdesk", platformsAllowed: ["Admin"], directFeatures: ["login.admin.*", "visitor.*"], roles: [], groups: [] },
  { name: "QA_Mixed", platformsAllowed: ["Admin"], directFeatures: ["login.admin.*", "customer.read.*"], roles: ["QA_RoleMixedDirectRole"], groups: ["QA_GrpMixed"],
    note: "Union must combine: direct(customer.read,login.admin) + role(employee.read) + group own(shift.read) + role-in-group(holiday.read)" },
  { name: "QA_UnitScoped", platformsAllowed: ["Admin"], directFeatures: ["login.admin.*", "employee.read.*", "employee.read.all.*", "attendance.read.*"], roles: [], groups: [], unitIds: ["__FIRST_UNIT__"],
    note: "unitIds set in JWT; check whether employee/attendance data is actually filtered by unit" },
  { name: "QA_Revoked", platformsAllowed: ["Admin"], directFeatures: ["login.admin.*", "visitor.*"], roles: [], groups: [],
    note: "granted visitor.* then revoked mid-test; union must drop it" },
  { name: "QA_AttendanceApprover", platformsAllowed: ["Admin"], directFeatures: ["login.admin.*", "attendanceReq.*", "attendance.request.approve.*", "ams.viewAll.unit.*"], roles: [], groups: [],
    note: "holds attendance.request.approve.* (the feature the approve route actually enforces); ams.viewAll.unit.* = cross-unit HR approver (hotfix 2026-10-23)" },
];

/** One full-access user per module (direct grant of all live features under the prefix). */
export const SINGLE_MODULE_PREFIXES = [
  "customer", "item", "voucher", "employee", "attendance", "attendanceReq",
  "leaveReq", "leaveConfig", "leaveAlloc", "holiday", "unit", "shift",
  "systemConfig", "analytics", "activityLog", "visitor",
  "user", "role", "group", "feature", "featurePermission",
];

export function singleModulePersonas(): Persona[] {
  return SINGLE_MODULE_PREFIXES.map((p) => ({
    name: `QA_Mod_${p}`,
    platformsAllowed: ["Admin"] as any,
    // Full AMS module operators (attendance/attendanceReq) are cross-unit by nature, so they carry
    // ams.viewAll.unit.* — the hotfix 2026-10-23 bypass — matching how a real HR/attendance admin is
    // set up. Without it they would be scoped to their own (non-existent) unit and could mark nobody.
    directFeatures: ["login.admin.*", ...(p === "attendance" || p === "attendanceReq" || p === "leaveReq" ? ["ams.viewAll.unit.*"] : [])],
    roles: [], groups: [], modulePrefix: p,
  }));
}
