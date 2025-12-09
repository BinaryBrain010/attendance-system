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
  
  

  //employee
  { name: "employee.*", label: "Employee (Nav)" },
  { name: "employee.create.*", parentFeatureId: "employee.*", label: "Create" },
  { name: "employee.read.*", parentFeatureId: "employee.*", label: "Read" },
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


  //attendance
  { name: "attendance.*", label: "Attendance (Nav)" },
{ name: "attendance.markAttendance.*", parentFeatureId: "attendance.*", label: "Attendance Marking" },
{ name: "attendance.faceScanning.*", parentFeatureId: "attendance.*", label: "Face Attendance" },
{ name: "attendance.physicalScanner.*", parentFeatureId: "attendance.*", label: "Physical Scanner Attendance" },
{ name: "attendance.qrScanner.*", parentFeatureId: "attendance.*", label: "QR Scanner Attendance" },
{ name: "attendance.manualAttendance.*", parentFeatureId: "attendance.*", label: "Manual Attendance" },
{ name: "attendance.filter.*", parentFeatureId: "attendance.*", label: "Filter Attendance" },
{ name: "attendance.update.*", parentFeatureId: "attendance.*", label: "Update Attendance" },
{ name: "attendance.excelImport.*", parentFeatureId: "attendance.*", label: "Excel Import" },
// attedanceReq
{ name: "attendanceReq.*", label: "Attendance Req (Nav)" },
{ name: "attendanceReq.create.*", parentFeatureId: "attendanceReq.*", label: "Create" },
{ name: "attendanceReq.read.*", parentFeatureId: "attendanceReq.*", label: "Read" },
{ name: "attendanceReq.update.*", parentFeatureId: "attendanceReq.*", label: "Update" },
{ name: "attendanceReq.restore.*", parentFeatureId: "attendanceReq.*", label: "Restore" },

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
{ name: "leaveAlloc.restore.*", parentFeatureId: "leaveAlloc.*", label: "Restore" },

//leave Config
{ name: "leaveConfig.*", label: "Leave Configuration" },
{ name: "leaveConfig.create.*", parentFeatureId: "leaveConfig.*", label: "Create" },
{ name: "leaveConfig.read.*", parentFeatureId: "leaveConfig.*", label: "Read" },
{ name: "leaveConfig.update.*", parentFeatureId: "leaveConfig.*", label: "Update" },
{ name: "leaveConfig.restore.*", parentFeatureId: "leaveConfig.*", label: "Restore" },

// faceRegistration - Hidden for now
// { name: "faceRegistration.*", label: "Face Registration (Nav)" },
// { name: "faceRegistration.extract.*", parentFeatureId: "faceRegistration.*", label: "Extract Face Descripter" },








];
