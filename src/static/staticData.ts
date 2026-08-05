import { UserData } from "../modules/rbac/user/types/user";
export const tableNames = [
  // "GroupRole",
  // "UserRole",
  // "UserGroup",
  "BlacklistToken",
  "LoggedInUsers",
  // "GatePassItem",
  // "GatePass",
  // "Item",
  // "Customer",
  // "Group",
  "AppFeature",
  // "Role",
  // "User",
];
import { AppFeature } from "../modules/rbac/Features/types/feature";
export const defaultUser: UserData[] = [
  // {
  //   id: "40cfe759-6fgr-4c9a-bcdf-82b9e1b457fb",
  //   username: "bss@admin",
  //   password: "pass2word",
  //   userRole: [],
  //   userGroup: [],
  // },
  // {
  //   id: "40cfe759-6fgr-4c9a-abcd-82b9e1b457fb",
  //   username: "bss@guest",
  //   password: "pass2word",
  //   userRole: [],
  //   userGroup: [],
  // },
  // {
  //   id: "40cfe759-6fgr-4c9a-abcd-83c8d1b457fb",
  //   username: "bss@account",
  //   password: "pass2word",
  //   userRole: [],
  //   userGroup: [],
  // },
  {
    id: "58c55d6a-910c-46f8-a422-4604bea6cd15",
    username: "admin@panel.com",
    password: "pass4everything",
    userRole: [],
    userGroup: [],
    //   companyUser: [],
  },
];

export const features: AppFeature[] = [
  { name: "login.*", label: "Login" },
  { name: "analytics.*", label: "Analytics" },
  {
    name: "analytics.nav.*",
    label: "Analytics (Nav)",
    parentFeatureId: "analytics.*",
  },
  {
    name: "analytics.read.*",
    label: "Analytics Read",
    parentFeatureId: "analytics.*",
  },
  {
    name: "analytics.graphs.*",
    label: "Analytics Graphs",
    parentFeatureId: "analytics.*",
  },
  { name: "login.app.*", label: "Login App", parentFeatureId: "login.*" },
  { name: "login.admin.*", label: "Login Admin", parentFeatureId: "login.*" },
  { name: "login.quickmark.*", label: "Login Attendance App", parentFeatureId: "login.*" },
  { name: "voucher.*", label: "Voucher (Nav)" },
  { name: "voucher.create.*", parentFeatureId: "voucher.*", label: "Create" },
  { name: "voucher.read.*", parentFeatureId: "voucher.*", label: "Read" },
  { name: "voucher.update.*", parentFeatureId: "voucher.*", label: "Update" },
  { name: "voucher.restore.*", parentFeatureId: "voucher.*", label: "Restore" },
  {
    name: "voucher.updatePost.*",
    parentFeatureId: "voucher.*",
    label: "Update Post ",
  },
  { name: "voucher.delete.*", parentFeatureId: "voucher.*", label: "Delete" },
  { name: "voucher.pdf.*", parentFeatureId: "voucher.*", label: "Print" },
  { name: "voucher.post.*", parentFeatureId: "voucher.*", label: "Post" },
  { name: "customer.*", label: "Customer (Nav)" },
  { name: "customer.create.*", parentFeatureId: "customer.*", label: "Create" },
  { name: "customer.read.*", parentFeatureId: "customer.*", label: "Read" },
  { name: "customer.update.*", parentFeatureId: "customer.*", label: "Update" },
  { name: "customer.delete.*", parentFeatureId: "customer.*", label: "Delete" },
  {
    name: "customer.restore.*",
    parentFeatureId: "customer.*",
    label: "Restore",
  },
  { name: "item.*", label: "Item (Nav)" },
  { name: "item.create.*", parentFeatureId: "item.*", label: "Create" },
  { name: "item.read.*", parentFeatureId: "item.*", label: "Read" },
  { name: "item.update.*", parentFeatureId: "item.*", label: "Update" },
  { name: "item.delete.*", parentFeatureId: "item.*", label: "Delete" },
  { name: "item.restore.*", parentFeatureId: "item.*", label: "Restore" },
  { name: "user.*", label: "User (Nav)" },
  { name: "user.create.*", parentFeatureId: "user.*", label: "Create" },
  { name: "user.read.*", parentFeatureId: "user.*", label: "Read" },
  { name: "user.update.*", parentFeatureId: "user.*", label: "Update" },
  { name: "user.delete.*", parentFeatureId: "user.*", label: "Delete" },
  {
    name: "user.logout.*",
    parentFeatureId: "user.*",
    label: "Logout(of all devices)",
  },
  {
    name: "user.changePassword.*",
    parentFeatureId: "user.*",
    label: "Change Password",
  },
  { name: "profile.*", label: "Profile" },
  {
    name: "profile.changePassword.*",
    parentFeatureId: "profile.*",
    label: "Profile Change Password",
  },
  {
    name: "profile.logout.*",
    parentFeatureId: "profile.*",
    label: "Profile Logout",
  },
  {
    name: "profile.logouts.*",
    parentFeatureId: "profile.*",
    label: "Profile Logout(of all devices)",
  },
  {
    name: "profile.activityLog.read.*",
    parentFeatureId: "profile.*",
    label: "Profile Activity Log (view activity logs on profile)",
  },
  {
    name: "profile.personalAttendance.*",
    parentFeatureId: "profile.*",
    label: "Profile Personal Attendance (view personal attendance on profile)",
  },
  {
    name: "profile.personalLeaves.*",
    parentFeatureId: "profile.*",
    label: "Profile Personal Leaves (view personal leaves on profile)",
  },
  {
    name: "profile.personalLeaveRequest.view.*",
    parentFeatureId: "profile.*",
    label: "Profile Personal Leave Request View (view own leave requests on personal leaves)",
  },
  {
    name: "profile.personalLeaveRequest.create.*",
    parentFeatureId: "profile.*",
    label: "Profile Personal Leave Request Create (create own leave request)",
  },
  {
    name: "profile.personalAttendanceRequest.view.*",
    parentFeatureId: "profile.*",
    label: "Profile Personal Attendance Request View (view own attendance requests on personal attendance)",
  },
  {
    name: "profile.personalAttendanceRequest.create.*",
    parentFeatureId: "profile.*",
    label: "Profile Personal Attendance Request Create (create own attendance request)",
  },
  {
    name: "profile.personalDocuments.*",
    parentFeatureId: "profile.*",
    label: "Profile Personal Documents (view own employee documents on profile)",
  },
  { name: "setting.*", label: "Setting (Nav)" },
  { name: "setting.read.*", parentFeatureId: "setting.*", label: "Read" },
  { name: "role.*", label: "Role (Nav)" },
  { name: "role.create.*", parentFeatureId: "role.*", label: "Create" },
  { name: "role.read.*", parentFeatureId: "role.*", label: "Read" },
  { name: "role.update.*", parentFeatureId: "role.*", label: "Update" },
  { name: "role.delete.*", parentFeatureId: "role.*", label: "Delete" },
  { name: "group.*", label: "Group (Nav)" },
  { name: "group.create.*", parentFeatureId: "group.*", label: "Create" },
  { name: "group.read.*", parentFeatureId: "group.*", label: "Read" },
  { name: "group.update.*", parentFeatureId: "group.*", label: "Update" },
  { name: "group.delete.*", parentFeatureId: "group.*", label: "Delete" },
  { name: "featurePermission.*", label: "Feature Permissions" },
  {
    name: "featurePermission.update.*",
    parentFeatureId: "featurePermission.*",
    label: "Update",
  },
  // # { name: "company.*", label: "company (Nav)" },
  // # { name: "company.create.*", parentFeatureId: "company.*", label: "Create" },
  // # { name: "company.read.*", parentFeatureId: "company.*", label: "Read" },
  // # { name: "company.update.*", parentFeatureId: "company.*", label: "Update" },
  // # { name: "company.delete.*", parentFeatureId: "company.*", label: "Delete" },
  // {
  //   name: "profile.changeCompany.*",
  //   parentFeatureId: "profile.*",
  //   label: "Change Company",
  // },
  // # { name: "ledger.*", label: "Ledger (Nav)" },
  // # { name: "ledger.report.*", parentFeatureId: "ledger.*", label: "Report" },
  // # {
  // #   name: "ledger.report.view.*",
  // #   parentFeatureId: "ledger.report.*",
  // #   label: "Report View",
  // # },
  // # {
  // #   name: "ledger.report.pdf.*",
  // #   parentFeatureId: "ledger.report.*",
  // #   label: "Report Print",
  // # },


  //App modules
  { name: "appModules.*", label: "App Modules" },
  { name: "appModules.quickPass.*", parentFeatureId: "appModules.*", label: "Quick Pass" },
  { name: "appModules.quickMark.*", parentFeatureId: "appModules.*", label: "Quick Mark" },
  { name: "appModules.accessControl.*", parentFeatureId: "appModules.*", label: "Access Control" },
  { name: "appModules.frontdesk.*", parentFeatureId: "appModules.*", label: "Frontdesk" },
  
  

  //employee
  { name: "employee.*", label: "Employee (Nav)" },
  { name: "employee.create.*", parentFeatureId: "employee.*", label: "Create" },
  { name: "employee.read.*", parentFeatureId: "employee.*", label: "Read" },
  { name: "employee.user.read.*", parentFeatureId: "employee.read.*", label: "View Employee Linked User" },
  { name: "employee.update.*", parentFeatureId: "employee.*", label: "Update" },
  { name: "employee.restore.*", parentFeatureId: "employee.*", label: "Restore" },
  {
    name: "employee.attendance.*",
    parentFeatureId: "employee.*",
    label: "Employee Attendance",
  },
  {
    name: "employee.leaves.*",
    parentFeatureId: "employee.*",
    label: "Employee Leaves",
  },
  {
    name: "employee.files.*",
    parentFeatureId: "employee.*",
    label: "Employee Files",
  },
  {
    name: "employee.timetable.*",
    parentFeatureId: "employee.*",
    label: "Employee Time Table",
  },
  { name: "employee.delete.*", parentFeatureId: "employee.*", label: "Delete" },
  { name: "employee.pdf.*", parentFeatureId: "employee.*", label: "Print" },
  { name: "employee.excel.*", parentFeatureId: "employee.*", label: "Excel" },
  { name: "employee.viewPreviousUpdate.*", parentFeatureId: "employee.*", label: "View Previous Update" },


  //shift
  { name: "shift.*", label: "Shift (Nav)" },
  { name: "shift.create.*", parentFeatureId: "shift.*", label: "Create" },
  { name: "shift.read.*", parentFeatureId: "shift.*", label: "Read" },
  { name: "shift.update.*", parentFeatureId: "shift.*", label: "Update" },
  { name: "shift.delete.*", parentFeatureId: "shift.*", label: "Delete" },
  { name: "shift.restore.*", parentFeatureId: "shift.*", label: "Restore" },
  { name: "shift.viewPreviousUpdate.*", parentFeatureId: "shift.*", label: "View Previous Update" },
  {
    name: "shift.assignments.*",
    parentFeatureId: "shift.*",
    label: "Shift Assignments",
  },
  {
    name: "shift.assignments.assignToEmployee.*",
    parentFeatureId: "shift.assignments.*",
    label: "Assign To Employee",
  },
  {
    name: "shift.assignments.removeAssignment.*",
    parentFeatureId: "shift.assignments.*",
    label: "Remove Assignment",
  },
  {
    name: "shift.assignments.assignedEmployees.*",
    parentFeatureId: "shift.assignments.*",
    label: "Assigned Employees",
  },
  {
    name: "shift.assignments.assignToUnit.*",
    parentFeatureId: "shift.assignments.*",
    label: "Assign To Unit (Bulk)",
  },
  {
    name: "shift.timetable.*",
    parentFeatureId: "shift.*",
    label: "Shift Time Table",
  },
  {
    name: "shift.timetable.read.*",
    parentFeatureId: "shift.timetable.*",
    label: "Read",
  },
  {
    name: "shift.timetable.upsert.*",
    parentFeatureId: "shift.timetable.*",
    label: "Create/Update",
  },
  {
    name: "shift.timetable.delete.*",
    parentFeatureId: "shift.timetable.*",
    label: "Delete",
  },


  //attendance
  { name: "attendance.*", label: "Attendance (Nav)" },
{ name: "attendance.markAttendance.*", parentFeatureId: "attendance.*", label: "Attendance Marking" },
{ name: "attendance.faceScanning.*", parentFeatureId: "attendance.*", label: "Face Attendance" },
{ name: "attendance.physicalScanner.*", parentFeatureId: "attendance.*", label: "Physical Scanner Attendance" },
{ name: "attendance.qrScanner.*", parentFeatureId: "attendance.*", label: "QR Scanner Attendance" },
{ name: "attendance.manualAttendance.*", parentFeatureId: "attendance.*", label: "Manual Attendance" },
{ name: "attendance.filter.*", parentFeatureId: "attendance.*", label: "Filter Attendance" },
{ name: "attendance.update.*", parentFeatureId: "attendance.*", label: "Update Attendance" },
{ name: "attendance.update.direct.*", parentFeatureId: "attendance.update.*", label: "Update Attendance Directly (No Approval Required)" },
{ name: "attendance.read.*", parentFeatureId: "attendance.*", label: "Read Attendance" },
{ name: "attendance.export.*", parentFeatureId: "attendance.*", label: "Export Attendance" },
{ name: "attendance.excelImport.*", parentFeatureId: "attendance.*", label: "Excel Import" },
{ name: "attendance.viewPreviousUpdate.*", parentFeatureId: "attendance.*", label: "View Previous Update" },
// attedanceReq - Not shown in navbar, accessible from Attendance page
{ name: "attendanceReq.*", label: "Attendance Request" },
{ name: "attendanceReq.create.*", parentFeatureId: "attendanceReq.*", label: "Create" },
{ name: "attendanceReq.read.*", parentFeatureId: "attendanceReq.*", label: "Read" },
{ name: "attendanceReq.update.*", parentFeatureId: "attendanceReq.*", label: "Update" },
{ name: "attendanceReq.delete.*", parentFeatureId: "attendanceReq.*", label: "Delete" },
{ name: "attendanceReq.restore.*", parentFeatureId: "attendanceReq.*", label: "Restore" },
{ name: "attendance.request.approve.*", parentFeatureId: "attendanceReq.*", label: "Approve/Reject Attendance Requests" },

//leave
{ name: "leave.*", label: "Leave (Nav)" },
{ name: "leave.req.*", parentFeatureId: "leave.*", label: "Leave Request Tab" },
{ name: "leave.alloc.*", parentFeatureId: "leave.*", label: "Leave Allocation Tab" },
{ name: "leave.config.*", parentFeatureId: "leave.*", label: "Leave Config Tab" },

//leaveReq
{ name: "leaveReq.*", label: "Leave Req " },
{ name: "leaveReq.create.*", parentFeatureId: "leaveReq.*", label: "Create" },
{ name: "leaveReq.read.*", parentFeatureId: "leaveReq.*", label: "Read" },
{ name: "leaveReq.update.*", parentFeatureId: "leaveReq.*", label: "Update" },
{ name: "leaveReq.restore.*", parentFeatureId: "leaveReq.*", label: "Restore" },

//leave Alloc
{ name: "leaveAlloc.*", label: "Leave Allocation" },
{ name: "leaveAlloc.create.*", parentFeatureId: "leaveAlloc.*", label: "Create" },
{ name: "leaveAlloc.read.*", parentFeatureId: "leaveAlloc.*", label: "Read" },
{ name: "leaveAlloc.update.*", parentFeatureId: "leaveAlloc.*", label: "Update" },
{ name: "leaveAlloc.delete.*", parentFeatureId: "leaveAlloc.*", label: "Delete" },
{ name: "leaveAlloc.restore.*", parentFeatureId: "leaveAlloc.*", label: "Restore" },

//leave Config
{ name: "leaveConfig.*", label: "Leave Configuration" },
{ name: "leaveConfig.create.*", parentFeatureId: "leaveConfig.*", label: "Create" },
{ name: "leaveConfig.read.*", parentFeatureId: "leaveConfig.*", label: "Read" },
{ name: "leaveConfig.update.*", parentFeatureId: "leaveConfig.*", label: "Update" },
{ name: "leaveConfig.delete.*", parentFeatureId: "leaveConfig.*", label: "Delete" },
{ name: "leaveConfig.restore.*", parentFeatureId: "leaveConfig.*", label: "Restore" },

//holiday
{ name: "holiday.*", label: "Holiday (Nav)" },
{ name: "holiday.create.*", parentFeatureId: "holiday.*", label: "Create" },
{ name: "holiday.read.*", parentFeatureId: "holiday.*", label: "Read" },
{ name: "holiday.update.*", parentFeatureId: "holiday.*", label: "Update" },
{ name: "holiday.delete.*", parentFeatureId: "holiday.*", label: "Delete" },
{ name: "holiday.restore.*", parentFeatureId: "holiday.*", label: "Restore" },
{ name: "holiday.markSundays.*", parentFeatureId: "holiday.*", label: "Mark Sundays" },
{ name: "holiday.viewPreviousUpdate.*", parentFeatureId: "holiday.*", label: "View Previous Update" },

//visitor (Frontdesk / Reception)
{ name: "visitor.*", label: "Visitor (Nav)" },
{ name: "visitor.create.*", parentFeatureId: "visitor.*", label: "Create" },
{ name: "visitor.read.*", parentFeatureId: "visitor.*", label: "Read" },
{ name: "visitor.update.*", parentFeatureId: "visitor.*", label: "Update" },
{ name: "visitor.delete.*", parentFeatureId: "visitor.*", label: "Delete" },
{ name: "visitor.restore.*", parentFeatureId: "visitor.*", label: "Restore" },
{ name: "visitor.checkout.*", parentFeatureId: "visitor.*", label: "Check Out" },
{ name: "visitor.import.*", parentFeatureId: "visitor.*", label: "Import" },
{ name: "visitor.export.*", parentFeatureId: "visitor.*", label: "Export" },
{ name: "visitor.viewPreviousUpdate.*", parentFeatureId: "visitor.*", label: "View Previous Update" },

//unit
{ name: "unit.*", label: "Unit (Nav)" },
{ name: "unit.create.*", parentFeatureId: "unit.*", label: "Create" },
{ name: "unit.read.*", parentFeatureId: "unit.*", label: "Read" },
{ name: "unit.update.*", parentFeatureId: "unit.*", label: "Update" },
{ name: "unit.delete.*", parentFeatureId: "unit.*", label: "Delete" },
{ name: "unit.restore.*", parentFeatureId: "unit.*", label: "Restore" },
{ name: "unit.viewPreviousUpdate.*", parentFeatureId: "unit.*", label: "View Previous Update" },
{ name: "unitEmployee.*", parentFeatureId: "unit.*", label: "Unit Employee Management" },
{ name: "unitEmployee.assign.*", parentFeatureId: "unitEmployee.*", label: "Assign Employees" },
{ name: "unitEmployee.read.*", parentFeatureId: "unitEmployee.*", label: "View Unit Employees" },
{ name: "employee.read.all.*", parentFeatureId: "employee.read.*", label: "Access All Employees (Supervisor)" },
{ name: "attendance.read.all.*", parentFeatureId: "attendance.read.*", label: "Access All Attendances (Supervisor)" },

//systemConfig
{ name: "systemConfig.*", label: "System Config (Nav)" },
{ name: "systemConfig.read.*", parentFeatureId: "systemConfig.*", label: "Read" },
{ name: "systemConfig.update.*", parentFeatureId: "systemConfig.*", label: "Update" },
{ name: "systemConfig.schedulerLogs.read.*", parentFeatureId: "systemConfig.*", label: "View Scheduler Logs" },

//activityLog
{ name: "activityLog.*", label: "Activity Log (Nav)" },
{ name: "activityLog.read.*", parentFeatureId: "activityLog.*", label: "Read Activity Logs" },
{ name: "activityLog.read.own.*", parentFeatureId: "activityLog.read.*", label: "Read Own Activity Logs" },

// faceRegistration - Hidden for now
// { name: "faceRegistration.*", label: "Face Registration (Nav)" },
// { name: "faceRegistration.extract.*", parentFeatureId: "faceRegistration.*", label: "Extract Face Descripter" },








];
