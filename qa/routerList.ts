/**
 * Shared list of the route classes server.ts mounts, in two groups: authed (behind auth) and open.
 * Extracted so routewalk.ts (featuremap source) and selfOwnerCheck.ts walk the EXACT same routers.
 */
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
import HrPolicyRoutes from "../src/modules/HR/Policy/routes/hrPolicy.routes";
import AmsReportRoutes from "../src/modules/AMS/Report/routes/amsReport.routes";
import VisitorRoutes from "../src/modules/Frontdesk/Visitor/routes/visitor.routes";
import CrmCategoryRoutes from "../src/modules/CRM/Catalogue/Category/routes/category.routes";
import CrmBrandRoutes from "../src/modules/CRM/Catalogue/Brand/routes/brand.routes";
import CrmProductRoutes from "../src/modules/CRM/Catalogue/Product/routes/product.routes";
import CrmPriceListRoutes from "../src/modules/CRM/Catalogue/PriceList/routes/pricelist.routes";
import CrmBundleRoutes from "../src/modules/CRM/Catalogue/Bundle/routes/bundle.routes";
import SalesAgentRoutes from "../src/modules/CRM/SalesAgent/routes/salesAgent.routes";
import LeadRoutes from "../src/modules/CRM/Lead/routes/lead.routes";
import LeadActivityRoutes from "../src/modules/CRM/LeadActivity/routes/leadActivity.routes";
import LeadReviewRoutes from "../src/modules/CRM/LeadReview/routes/leadReview.routes";
import QuotationRoutes from "../src/modules/CRM/Quotation/routes/quotation.routes";
import SalesOrderRoutes from "../src/modules/CRM/SalesOrder/routes/salesOrder.routes";
import SalesReturnRoutes from "../src/modules/CRM/Return/routes/salesReturn.routes";
import CrmReportRoutes from "../src/modules/CRM/Report/routes/report.routes";
import TeamRoutes from "../src/modules/Work/Team/routes/team.routes";
import TaskRoutes from "../src/modules/Work/Task/routes/task.routes";
import DailyReportRoutes from "../src/modules/Work/DailyReport/routes/dailyReport.routes";
import NotificationRoutes from "../src/modules/Work/Notification/routes/notification.routes";
import WorkReportRoutes from "../src/modules/Work/Report/routes/workReport.routes";
import AuditLogRoutes from "../src/modules/Audit/routes/auditLog.routes";
import InsightsRoutes from "../src/modules/Insights/routes/insights.routes";
import FaceCaptureRoutes from "../src/modules/AMS/FaceCapture/routes/faceCapture.routes";
import FaceCapturePublicRoutes from "../src/modules/AMS/FaceCapture/routes/faceCapturePublic.routes";
import StorageRoutes from "../src/modules/Admin/Storage/routes/storage.routes";

const authed: any[] = [
  CustomerRoutes, GatePassRoutes, GatePassItemRoutes, ItemRoutes, StatsRoutes,
  GroupRoutes, GroupRoleRoutes, RoleRoutes, UserRoutes, UserGroupRoutes, UserRoleRoutes,
  FeaturePermissionRoutes, AccessRoutes, AppFeatureRoutes,
  EmployeeRoutes, LeaveRoutes, AttendanceReqRoutes, AttendanceRoutes, HolidayRoutes,
  UnitRoutes, UnitEmployeeRoutes, ShiftRoutes, SystemConfigRoutes, AnalyticsRoutes,
  HrPolicyRoutes, AmsReportRoutes, FaceCaptureRoutes,
  ActivityLogRoutes, VisitorRoutes,
  CrmCategoryRoutes, CrmBrandRoutes, CrmProductRoutes, CrmPriceListRoutes, CrmBundleRoutes,
  SalesAgentRoutes, LeadRoutes, LeadActivityRoutes, LeadReviewRoutes, QuotationRoutes, SalesOrderRoutes, SalesReturnRoutes, CrmReportRoutes,
  TeamRoutes, TaskRoutes, DailyReportRoutes, NotificationRoutes, WorkReportRoutes,
  AuditLogRoutes, StorageRoutes,
  InsightsRoutes,
];
const open: any[] = [AuthRoutes, WebhookRoutes, FaceCapturePublicRoutes];

export { authed, open };
