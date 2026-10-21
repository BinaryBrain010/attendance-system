/**
 * Safe Prisma `select` fragments for LIST queries. Blob / large-text / sensitive columns must never
 * be returned in bulk — a single base64 employee photo or signature can blow past Node's napi string
 * limit ("Failed to convert rust String into napi string") and crash the whole list. List/findMany
 * queries use these; detail (getById) and the dedicated photo endpoint opt back in to the heavy columns.
 *
 * Excluded blobs: Employee.image / faceDescriptor / previousUpdates / filePaths, User.password,
 * GatePass.signature, LeaveRequest.image, AttendanceRequest.image, and *.previousUpdates JSON.
 */

/** Employee fields safe to embed in a list row (name/code/designation/etc.) — NO image/face/previousUpdates. */
export const employeeCardSelect = {
  id: true,
  name: true,
  surname: true,
  code: true,
  designation: true,
  department: true,
  status: true,
  contactNo: true,
  company: true,
  createdAt: true,
  isDeleted: true,
} as const;

/** User fields safe to embed — NO password. */
export const userCardSelect = {
  id: true,
  username: true,
  employeeId: true,
  createdAt: true,
  updatedAt: true,
  isDeleted: true,
} as const;

/** LeaveRequest row fields — everything except the base64 `image` attachment. */
export const leaveRequestListSelect = {
  id: true,
  employeeId: true,
  leaveAllocationId: true,
  reason: true,
  startDate: true,
  endDate: true,
  status: true,
  leaveType: true,
  location: true,
  createdAt: true,
  updatedAt: true,
  isDeleted: true,
  createdById: true,
  updatedById: true,
  deletedById: true,
} as const;

/** AttendanceRequest row fields — everything except the base64 `image`. */
export const attendanceRequestListSelect = {
  id: true,
  employeeId: true,
  attendanceId: true,
  reason: true,
  status: true,
  location: true,
  proposedStatus: true,
  proposedCheckIn: true,
  proposedCheckOut: true,
  proposedComment: true,
  proposedLocation: true,
  proposedDate: true,
  requestedBy: true,
  approvedBy: true,
  createdAt: true,
  updatedAt: true,
  isDeleted: true,
  createdById: true,
  updatedById: true,
  deletedById: true,
} as const;
