/**
 * Walks the ACTUAL registered Express routers (the same classes server.ts mounts) and emits every
 * route (method + full path) at runtime. Does not start the HTTP server. Writes qa/_routes.json.
 *   npx ts-node qa/routewalk.ts
 */
import fs from "fs";
import path from "path";
import RoutesHelper from "../src/helper/routes.helper";

import CustomerRoutes from "../src/modules/app/customer/routes/customer.routes";
import GatePassRoutes from "../src/modules/app/gatePass/routes/gatePass.routes";
import GatePassItemRoutes from "../src/modules/app/gatePassItem/routes/gatePassItem.routes";
import ItemRoutes from "../src/modules/app/item/routes/item.routes";
import StatsRoutes from "../src/modules/app/stats/routes/stats.routes";
import AuthRoutes from "../src/Auth/routes/auth.routes";
import UserRoutes from "../src/modules/rbac/user/routes/user.routes";
import RoleRoutes from "../src/modules/rbac/role/routes/role.routes";
import AccessRoutes from "../src/modules/rbac/Access/routes/access.routes";
import GroupRoutes from "../src/modules/rbac/group/routes/group.routes";
import GroupRoleRoutes from "../src/modules/rbac/group/routes/groupRole.routes";
import UserGroupRoutes from "../src/modules/rbac/group/routes/userGroup.routes";
import AppFeatureRoutes from "../src/modules/rbac/Features/routes/feature.routes";
import UserRoleRoutes from "../src/modules/rbac/user/routes/userRole.routes";
import FeaturePermissionRoutes from "../src/modules/rbac/Features/routes/featurePermission.routes";
import WebhookRoutes from "../src/modules/rbac/Access/routes/webhook.routes";
import AttendanceReqRoutes from "../src/modules/AMS/Attendance/routes/attendaceReq.routes";
import EmployeeRoutes from "../src/modules/AMS/Employee/routes/employee.routes";
import AttendanceRoutes from "../src/modules/AMS/Attendance/routes/attendance.routes";
import LeaveRoutes from "../src/modules/AMS/Leaves/routes/leave.routes";
import HolidayRoutes from "../src/modules/AMS/Holiday/routes/holiday.routes";
import UnitRoutes from "../src/modules/AMS/Unit/routes/unit.routes";
import UnitEmployeeRoutes from "../src/modules/AMS/Unit/routes/unitEmployee.routes";
import ShiftRoutes from "../src/modules/AMS/Shift/routes/shift.routes";
import SystemConfigRoutes from "../src/modules/AMS/SystemConfig/routes/systemConfig.routes";
import AnalyticsRoutes from "../src/modules/AMS/Analytics/routes/analytics.routes";
import ActivityLogRoutes from "../src/modules/ActivityLog/routes/activityLog.routes";
import VisitorRoutes from "../src/modules/Frontdesk/Visitor/routes/visitor.routes";
import CrmCategoryRoutes from "../src/modules/CRM/Catalogue/Category/routes/category.routes";
import CrmBrandRoutes from "../src/modules/CRM/Catalogue/Brand/routes/brand.routes";
import CrmProductRoutes from "../src/modules/CRM/Catalogue/Product/routes/product.routes";
import CrmPriceListRoutes from "../src/modules/CRM/Catalogue/PriceList/routes/pricelist.routes";
import CrmBundleRoutes from "../src/modules/CRM/Catalogue/Bundle/routes/bundle.routes";
import SalesAgentRoutes from "../src/modules/CRM/SalesAgent/routes/salesAgent.routes";
import LeadRoutes from "../src/modules/CRM/Lead/routes/lead.routes";
import LeadActivityRoutes from "../src/modules/CRM/LeadActivity/routes/leadActivity.routes";
import QuotationRoutes from "../src/modules/CRM/Quotation/routes/quotation.routes";
import SalesOrderRoutes from "../src/modules/CRM/SalesOrder/routes/salesOrder.routes";
import SalesReturnRoutes from "../src/modules/CRM/Return/routes/salesReturn.routes";
import CrmReportRoutes from "../src/modules/CRM/Report/routes/report.routes";

const authed: any[] = [
  CustomerRoutes, GatePassRoutes, GatePassItemRoutes, ItemRoutes, StatsRoutes,
  GroupRoutes, GroupRoleRoutes, RoleRoutes, UserRoutes, UserGroupRoutes, UserRoleRoutes,
  FeaturePermissionRoutes, AccessRoutes, AppFeatureRoutes,
  EmployeeRoutes, LeaveRoutes, AttendanceReqRoutes, AttendanceRoutes, HolidayRoutes,
  UnitRoutes, UnitEmployeeRoutes, ShiftRoutes, SystemConfigRoutes, AnalyticsRoutes,
  ActivityLogRoutes, VisitorRoutes,
  CrmCategoryRoutes, CrmBrandRoutes, CrmProductRoutes, CrmPriceListRoutes, CrmBundleRoutes,
  SalesAgentRoutes, LeadRoutes, LeadActivityRoutes, QuotationRoutes, SalesOrderRoutes, SalesReturnRoutes, CrmReportRoutes,
];
const open: any[] = [AuthRoutes, WebhookRoutes];

// Recover a mounted sub-router's path segment from its layer regexp.
function mountSegment(layer: any): string {
  if (!layer.regexp || layer.regexp.fast_slash) return "";
  const s = layer.regexp.toString();
  // matches /^\/leave-requests\/?(?=\/|$)/i -> "leave-requests"
  const m = s.match(/\\\/((?:[A-Za-z0-9_~-]|\\.)+)\\\/\?/);
  return m ? "/" + m[1].replace(/\\(.)/g, "$1") : "";
}

function walk(stack: any[], prefix: string, out: { method: string; path: string }[]) {
  for (const layer of stack || []) {
    if (layer.route) {
      const rp = layer.route.path;
      const paths = Array.isArray(rp) ? rp : [rp];
      const methods = Object.keys(layer.route.methods || {}).filter((m) => layer.route.methods[m]);
      for (const p of paths) for (const m of methods) {
        if (m === "_all") continue;
        out.push({ method: m.toUpperCase(), path: prefix + p });
      }
    } else if ((layer.name === "router" || layer.handle?.stack) && layer.handle?.stack) {
      walk(layer.handle.stack, prefix + mountSegment(layer), out);
    }
  }
}

function collect(classes: any[], open: boolean): { method: string; path: string; mount: string; open: boolean }[] {
  const rows: any[] = [];
  for (const cls of classes) {
    const mount = RoutesHelper.generateRoutePath(cls);
    let router: any;
    try { router = new cls().getRouter(); } catch (e: any) { console.warn(`skip ${cls.name}: ${e?.message}`); continue; }
    const sub: { method: string; path: string }[] = [];
    walk(router.stack, "", sub);
    for (const r of sub) rows.push({ method: r.method, path: mount + r.path, mount, open });
  }
  return rows;
}

const routes = [...collect(authed, false), ...collect(open, true)];
// de-dup
const seen = new Set<string>();
const unique = routes.filter((r) => { const k = `${r.method} ${r.path}`; if (seen.has(k)) return false; seen.add(k); return true; });
unique.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
fs.writeFileSync(path.join(__dirname, "_routes.json"), JSON.stringify(unique, null, 2));
console.log(`[routewalk] ${unique.length} routes from ${authed.length + open.length} routers`);
console.log("sample:", unique.slice(0, 5).map((r) => `${r.method} ${r.path}`).join(" | "));
console.log("leave sub-routes:", unique.filter((r) => r.path.startsWith("/leave/")).slice(0, 4).map((r) => `${r.method} ${r.path}`).join(" | "));
process.exit(0);
