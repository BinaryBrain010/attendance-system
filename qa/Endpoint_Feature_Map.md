# Phase 3 mapping v2 (from runtime Express routers)

321 routes walked from the live routers. Real DB users counted: 175.

**Access kinds:** open (no auth) · token (any logged-in user) · self (caller's own employee, else the read feature) · feature (requires the listed feature) · dynamic (feature depends on request body, e.g. parentType) · god (god only) · unmapped (DENY under RBAC_ENFORCE=on).

**Parent rule:** holding a parent feature grants all descendants. A user with `voucher.*` passes any `voucher.read.*`/`voucher.post.*` check; a user with `shift.*` passes `shift.assignments.assignToEmployee.*`. The "held by" column already applies this rule (a user counts for a feature if they hold it or any ancestor).
Verified on real data: receptionuser@phw holds `attendance.*` (not the leaf), and is correctly counted as holding `attendance.markAttendance.*` and `attendance.request.approve.*` via the ancestor rule. The middleware will use the same rule.

**Middleware rules (to implement after this review):** unmapped route -> DENY under RBAC_ENFORCE=on (log "unmapped" otherwise); `self` -> allow when the caller's linked employee == the employee in the body (field `employeeId`, or own account for user routes), else require the listed feature; `dynamic` -> the required feature is chosen from the request body (featurePermission uses body.parentType -> user/role/group.update.*); `token` -> any logged-in user; `god` -> god only; `open` -> no auth.

**IMPORTANT caveat on "held by":** this local DB is a partial/old restore. Only 1 of the 10 users (receptionuser@phw, 30 features) has any grants; the other 9 (incl. azeem_ijaz, muhammad_shahid1 and 7 qawf_test*) have ZERO. So almost every feature shows held=0 here. These numbers are NOT the rollout impact — the DB-impact script (Phase 3, to build) must be run against a current prod copy for real counts.

Proposed features not yet registered: 0 (all mapped features exist in the DB). Dynamic routes (feature chosen from body): 7. Self routes: 13. God-only: 4. Token-only: 11. Open: 6.

| Method | Path | Kind | Access | Feature | Registered | Held by (of 175) | Note |
|---|---|---|---|---|---|---|---|
| POST | /access/checkPermission | read | token | `-` | - | - | internal permission check |
| POST | /access/checkPermissions | read | token | `-` | - | - | internal permission check |
| POST | /access/getPermission | read | token | `-` | - | - | internal permission check |
| GET | /access/getUserGroup | read | token | `-` | - | - | internal permission check |
| GET | /access/getUserRole | read | token | `-` | - | - | internal permission check |
| GET | /activityLog/count | read | feature | `activityLog.read.*` | yes | 1 |  |
| GET | /activityLog/get | read | feature | `activityLog.read.*` | yes | 1 |  |
| POST | /activityLog/get | read | feature | `activityLog.read.*` | yes | 1 |  |
| POST | /activityLog/getByEntity | read | feature | `activityLog.read.*` | yes | 1 |  |
| POST | /activityLog/getById | read | feature | `activityLog.read.*` | yes | 1 |  |
| POST | /activityLog/getByUnit | read | feature | `activityLog.read.*` | yes | 1 |  |
| POST | /activityLog/getByUser | read | feature | `activityLog.read.*` | yes | 1 |  |
| GET | /activityLog/me | self | self | `activityLog.read.own.*` | - | 1 | caller's own employee -> allow; otherwise needs this feature (match on body.employeeId) |
| POST | /activityLog/me | read | feature | `activityLog.read.*` | yes | 1 |  |
| GET | /analytics/personalAttendance | self | self | `analytics.read.*` | - | 38 | caller's own employee -> allow; otherwise needs this feature (match on body.employeeId) |
| POST | /analytics/personalAttendance | read | feature | `analytics.read.*` | yes | 38 |  |
| GET | /analytics/topAttendance | read | feature | `analytics.read.*` | yes | 38 |  |
| POST | /appFeature/create | create | god | `-` | - | - | feature tree edits are god-only |
| POST | /appFeature/delete | delete | god | `-` | - | - | feature tree edits are god-only |
| GET | /appFeature/get | read | token | `-` | - | - | permission UI needs feature tree |
| POST | /appFeature/get | read | token | `-` | - | - | permission UI needs feature tree |
| POST | /appFeature/getByParent | read | token | `-` | - | - | permission UI needs feature tree |
| GET | /appFeature/hierarchy | read | token | `-` | - | - | permission UI needs feature tree |
| POST | /appFeature/restore | restore | god | `-` | - | - | feature tree edits are god-only |
| GET | /appFeature/total | read | token | `-` | - | - | permission UI needs feature tree |
| PUT | /appFeature/update | update | god | `-` | - | - | feature tree edits are god-only |
| POST | /attendance/bulkMarkAttendance | create | feature | `attendance.markAttendance.*` | yes | 22 |  |
| POST | /attendance/bulkMarkAttendanceByEmployee | create | feature | `attendance.markAttendance.*` | yes | 22 |  |
| POST | /attendance/bulkMarkLeave | create | feature | `attendance.markAttendance.*` | yes | 22 |  |
| POST | /attendance/checkAttendance | read | feature | `attendance.read.*` | yes | 22 |  |
| POST | /attendance/create | create | feature | `attendance.create.*` | yes | 22 |  |
| POST | /attendance/delete | delete | feature | `attendance.delete.*` | yes | 22 |  |
| POST | /attendance/excel | export | feature | `attendance.export.*` | yes | 22 |  |
| POST | /attendance/face-attendance | create | feature | `attendance.markAttendance.*` | yes | 22 | marks attendance via face recognition |
| GET | /attendance/get | read | feature | `attendance.read.*` | yes | 22 |  |
| POST | /attendance/get | read | feature | `attendance.read.*` | yes | 22 |  |
| POST | /attendance/getById | read | feature | `attendance.read.*` | yes | 22 |  |
| POST | /attendance/getDate | read | feature | `attendance.read.*` | yes | 22 |  |
| POST | /attendance/getEmployeeAttendance | self | self | `attendance.read.*` | - | 22 | caller's own employee -> allow; otherwise needs this feature (match on body.employeeId) |
| POST | /attendance/history | read | feature | `attendance.read.*` | yes | 22 |  |
| POST | /attendance/import | import | feature | `attendance.excelImport.*` | yes | 22 |  |
| POST | /attendance/markAttendance | self | self | `attendance.markAttendance.*` | - | 22 | caller's own employee -> allow; otherwise needs this feature (match on body.employeeId) |
| POST | /attendance/pdf | export | feature | `attendance.export.*` | yes | 22 |  |
| GET | /attendance/requestSummary | read | feature | `attendance.read.*` | yes | 22 |  |
| POST | /attendance/restore | restore | feature | `attendance.restore.*` | yes | 22 |  |
| POST | /attendance/search | read | feature | `attendance.read.*` | yes | 22 |  |
| POST | /attendance/specific | read | feature | `attendance.read.*` | yes | 22 |  |
| POST | /attendance/summary | read | feature | `attendance.read.*` | yes | 22 |  |
| GET | /attendance/total | read | feature | `attendance.read.*` | yes | 22 |  |
| PUT | /attendance/update | update | feature | `attendance.update.*` | yes | 22 |  |
| POST | /attendanceReq/bulkUpdateStatus | approve | feature | `attendance.request.approve.*` | yes | 22 | covers approve and reject |
| POST | /attendanceReq/create | self | self | `attendanceReq.create.*` | - | 4 | caller's own employee -> allow; otherwise needs this feature (match on body.employeeId) |
| POST | /attendanceReq/delete | delete | feature | `attendanceReq.delete.*` | yes | 4 |  |
| GET | /attendanceReq/deleted | read | feature | `attendanceReq.read.*` | yes | 4 |  |
| GET | /attendanceReq/get | read | feature | `attendanceReq.read.*` | yes | 4 |  |
| POST | /attendanceReq/get | read | feature | `attendanceReq.read.*` | yes | 4 |  |
| POST | /attendanceReq/getById | read | feature | `attendanceReq.read.*` | yes | 4 |  |
| POST | /attendanceReq/getEmployee | self | self | `attendanceReq.read.*` | - | 4 | caller's own employee -> allow; otherwise needs this feature (match on body.employeeId) |
| POST | /attendanceReq/restore | restore | feature | `attendanceReq.restore.*` | yes | 4 |  |
| POST | /attendanceReq/search | read | feature | `attendanceReq.read.*` | yes | 4 |  |
| GET | /attendanceReq/total | read | feature | `attendanceReq.read.*` | yes | 4 |  |
| PUT | /attendanceReq/update | update | feature | `attendanceReq.update.*` | yes | 4 |  |
| POST | /attendanceReq/updateStatus | approve | feature | `attendance.request.approve.*` | yes | 22 | covers approve and reject |
| POST | /auth/login | open | open | `-` | - | - |  |
| GET | /auth/logout | open | open | `-` | - | - |  |
| GET | /auth/logoutOfAllDevices | open | open | `-` | - | - |  |
| POST | /auth/logoutUserOfAllDevices | open | open | `-` | - | - |  |
| POST | /customer/create | create | feature | `customer.create.*` | yes | 3 |  |
| POST | /customer/delete | delete | feature | `customer.delete.*` | yes | 3 |  |
| GET | /customer/get | read | feature | `customer.read.*` | yes | 3 |  |
| POST | /customer/get | read | feature | `customer.read.*` | yes | 3 |  |
| POST | /customer/getById | read | feature | `customer.read.*` | yes | 3 |  |
| POST | /customer/getDeleted | read | feature | `customer.read.*` | yes | 3 |  |
| GET | /customer/getFrequent | read | feature | `customer.read.*` | yes | 3 |  |
| POST | /customer/restore | restore | feature | `customer.restore.*` | yes | 3 |  |
| POST | /customer/search | read | feature | `customer.read.*` | yes | 3 |  |
| GET | /customer/total | read | feature | `customer.read.*` | yes | 3 |  |
| PUT | /customer/update | update | feature | `customer.update.*` | yes | 3 |  |
| POST | /employee/create | create | feature | `employee.create.*` | yes | 22 |  |
| POST | /employee/delete | delete | feature | `employee.delete.*` | yes | 22 |  |
| POST | /employee/files | read | feature | `employee.read.*` | yes | 22 |  |
| POST | /employee/filesDel | update | feature | `employee.update.*` | yes | 22 |  |
| GET | /employee/get | read | feature | `employee.read.*` | yes | 22 |  |
| POST | /employee/get | read | feature | `employee.read.*` | yes | 22 |  |
| POST | /employee/getByCode | read | feature | `employee.read.*` | yes | 22 |  |
| POST | /employee/getById | read | feature | `employee.read.*` | yes | 22 |  |
| POST | /employee/getByUserId | read | self | `employee.read.*` | - | 22 | own user (body.userId) else employee.read.* |
| POST | /employee/getCard | export | feature | `employee.excel.*` | yes | 22 |  |
| POST | /employee/getDeleted | read | feature | `employee.read.*` | yes | 22 |  |
| GET | /employee/getExcel | export | feature | `employee.excel.*` | yes | 22 |  |
| GET | /employee/getFaceRecognitionData | read | feature | `employee.read.*` | yes | 22 |  |
| POST | /employee/getHistoryById | history | feature | `employee.viewPreviousUpdate.*` | yes | 22 |  |
| POST | /employee/getLinkedUser | read | self | `employee.read.*` | - | 22 | own user (body.userId) else employee.read.* |
| POST | /employee/restore | restore | feature | `employee.restore.*` | yes | 22 |  |
| POST | /employee/search | read | feature | `employee.read.*` | yes | 22 |  |
| POST | /employee/stats | read | feature | `employee.read.*` | yes | 22 |  |
| GET | /employee/total | read | feature | `employee.read.*` | yes | 22 |  |
| PUT | /employee/update | update | feature | `employee.update.*` | yes | 22 |  |
| POST | /employee/updateFile | update | feature | `employee.update.*` | yes | 22 |  |
| POST | /featurePermission/allowedFeatures | read | dynamic | `(dynamic) {parentType}.read.*` | - | - | parentType in body: user/role/group.read.* |
| POST | /featurePermission/create | update | dynamic | `(dynamic) {parentType}.update.*` | - | - | parentType in body: user/role/group.update.* |
| POST | /featurePermission/delete | update | dynamic | `(dynamic) {parentType}.update.*` | - | - | parentType in body: user/role/group.update.* |
| GET | /featurePermission/get | read | dynamic | `(dynamic) {parentType}.read.*` | - | - | parentType in body: user/role/group.read.* |
| POST | /featurePermission/get | read | dynamic | `(dynamic) {parentType}.read.*` | - | - | parentType in body: user/role/group.read.* |
| POST | /featurePermission/restore | update | dynamic | `(dynamic) {parentType}.update.*` | - | - | parentType in body: user/role/group.update.* |
| PUT | /featurePermission/update | update | dynamic | `(dynamic) {parentType}.update.*` | - | - | parentType in body: user/role/group.update.* |
| POST | /gatePass/approve | approve | feature | `voucher.post.*` | yes | 3 | feature QuickPass checks before approve |
| POST | /gatePass/create | create | feature | `voucher.create.*` | yes | 3 |  |
| POST | /gatePass/customerId | read | feature | `voucher.read.*` | yes | 3 |  |
| POST | /gatePass/date | read | feature | `voucher.read.*` | yes | 3 |  |
| POST | /gatePass/delete | delete | feature | `voucher.delete.*` | yes | 3 |  |
| GET | /gatePass/get | read | feature | `voucher.read.*` | yes | 3 |  |
| POST | /gatePass/get | read | feature | `voucher.read.*` | yes | 3 |  |
| POST | /gatePass/getById | read | feature | `voucher.read.*` | yes | 3 |  |
| POST | /gatePass/getDeleted | read | feature | `voucher.read.*` | yes | 3 |  |
| POST | /gatePass/itemId | read | feature | `voucher.read.*` | yes | 3 |  |
| POST | /gatePass/pdf | export | feature | `voucher.pdf.*` | yes | 3 |  |
| GET | /gatePass/report | read | feature | `voucher.read.*` | yes | 3 |  |
| POST | /gatePass/restore | restore | feature | `voucher.restore.*` | yes | 3 |  |
| POST | /gatePass/status | read | feature | `voucher.read.*` | yes | 3 |  |
| GET | /gatePass/total | read | feature | `voucher.read.*` | yes | 3 |  |
| PUT | /gatePass/update | update | feature | `voucher.update.*` | yes | 3 |  |
| POST | /gatePassItem/create | create | feature | `voucher.create.*` | yes | 3 |  |
| POST | /gatePassItem/delete | delete | feature | `voucher.delete.*` | yes | 3 |  |
| GET | /gatePassItem/get | read | feature | `voucher.read.*` | yes | 3 |  |
| POST | /gatePassItem/get | read | feature | `voucher.read.*` | yes | 3 |  |
| POST | /gatePassItem/getById | read | feature | `voucher.read.*` | yes | 3 |  |
| POST | /gatePassItem/restore | restore | feature | `voucher.restore.*` | yes | 3 |  |
| GET | /gatePassItem/total | read | feature | `voucher.read.*` | yes | 3 |  |
| PUT | /gatePassItem/update | update | feature | `voucher.update.*` | yes | 3 |  |
| POST | /group/create | create | feature | `group.create.*` | yes | 2 |  |
| POST | /group/delete | delete | feature | `group.delete.*` | yes | 2 |  |
| GET | /group/get | read | feature | `group.read.*` | yes | 2 |  |
| POST | /group/get | read | feature | `group.read.*` | yes | 2 |  |
| POST | /group/getById | read | feature | `group.read.*` | yes | 2 |  |
| POST | /group/getByName | read | feature | `group.read.*` | yes | 2 |  |
| POST | /group/getGroupById | read | feature | `group.read.*` | yes | 2 |  |
| POST | /group/restore | restore | feature | `group.delete.*` | yes | 2 | restore mapped to delete feature |
| POST | /group/search | read | feature | `group.read.*` | yes | 2 |  |
| GET | /group/total | read | feature | `group.read.*` | yes | 2 |  |
| PUT | /group/update | update | feature | `group.update.*` | yes | 2 |  |
| POST | /groupRole/create | update | feature | `group.update.*` | yes | 2 | assigning roles to a group |
| POST | /groupRole/delete | update | feature | `group.update.*` | yes | 2 | assigning roles to a group |
| GET | /groupRole/get | read | feature | `group.read.*` | yes | 2 |  |
| POST | /groupRole/get | read | feature | `group.read.*` | yes | 2 |  |
| POST | /groupRole/restore | update | feature | `group.update.*` | yes | 2 | assigning roles to a group |
| PUT | /groupRole/update | update | feature | `group.update.*` | yes | 2 | assigning roles to a group |
| POST | /holiday/create | create | feature | `holiday.create.*` | yes | 1 |  |
| POST | /holiday/delete | delete | feature | `holiday.delete.*` | yes | 1 |  |
| GET | /holiday/deleted | read | feature | `holiday.read.*` | yes | 1 |  |
| GET | /holiday/get | read | feature | `holiday.read.*` | yes | 1 |  |
| GET | /holiday/getAll | read | feature | `holiday.read.*` | yes | 1 |  |
| GET | /holiday/getById | read | feature | `holiday.read.*` | yes | 1 |  |
| POST | /holiday/getHistoryById | history | feature | `holiday.viewPreviousUpdate.*` | yes | 1 |  |
| POST | /holiday/markSundays | create | feature | `holiday.markSundays.*` | yes | 1 |  |
| POST | /holiday/restore | restore | feature | `holiday.restore.*` | yes | 1 |  |
| POST | /holiday/search | read | feature | `holiday.read.*` | yes | 1 |  |
| GET | /holiday/total | read | feature | `holiday.read.*` | yes | 1 |  |
| PUT | /holiday/update | update | feature | `holiday.update.*` | yes | 1 |  |
| POST | /item/create | create | feature | `item.create.*` | yes | 3 |  |
| POST | /item/delete | delete | feature | `item.delete.*` | yes | 3 |  |
| GET | /item/get | read | feature | `item.read.*` | yes | 3 |  |
| POST | /item/get | read | feature | `item.read.*` | yes | 3 |  |
| POST | /item/getById | read | feature | `item.read.*` | yes | 3 |  |
| POST | /item/getBySerialNo | read | feature | `item.read.*` | yes | 3 |  |
| POST | /item/getDeleted | read | feature | `item.read.*` | yes | 3 |  |
| GET | /item/getOutOfStock | read | feature | `item.read.*` | yes | 3 |  |
| POST | /item/restore | restore | feature | `item.restore.*` | yes | 3 |  |
| POST | /item/search | read | feature | `item.read.*` | yes | 3 |  |
| GET | /item/total | read | feature | `item.read.*` | yes | 3 |  |
| PUT | /item/update | update | feature | `item.update.*` | yes | 3 |  |
| POST | /leave/leave-allocations/assignToAll | create | feature | `leaveAlloc.create.*` | yes | 4 |  |
| POST | /leave/leave-allocations/create | create | feature | `leaveAlloc.create.*` | yes | 4 |  |
| POST | /leave/leave-allocations/delete | delete | feature | `leaveAlloc.delete.*` | yes | 4 |  |
| GET | /leave/leave-allocations/deleted | read | feature | `leaveAlloc.read.*` | yes | 4 |  |
| GET | /leave/leave-allocations/get | read | feature | `leaveAlloc.read.*` | yes | 4 |  |
| POST | /leave/leave-allocations/get | read | feature | `leaveAlloc.read.*` | yes | 4 |  |
| POST | /leave/leave-allocations/getByEmployeeId | self | self | `leaveAlloc.read.*` | - | 4 | caller's own employee -> allow; otherwise needs this feature (match on body.employeeId) |
| GET | /leave/leave-allocations/getById | read | feature | `leaveAlloc.read.*` | yes | 4 |  |
| POST | /leave/leave-allocations/restore | restore | feature | `leaveAlloc.restore.*` | yes | 4 |  |
| POST | /leave/leave-allocations/search | read | feature | `leaveAlloc.read.*` | yes | 4 |  |
| GET | /leave/leave-allocations/total | read | feature | `leaveAlloc.read.*` | yes | 4 |  |
| PUT | /leave/leave-allocations/update | update | feature | `leaveAlloc.update.*` | yes | 4 |  |
| POST | /leave/leave-configurations/create | create | feature | `leaveConfig.create.*` | yes | 4 |  |
| POST | /leave/leave-configurations/delete | delete | feature | `leaveConfig.delete.*` | yes | 4 |  |
| POST | /leave/leave-configurations/get | read | feature | `leaveConfig.read.*` | yes | 4 |  |
| GET | /leave/leave-configurations/getAll | read | feature | `leaveConfig.read.*` | yes | 4 |  |
| POST | /leave/leave-configurations/getById | read | feature | `leaveConfig.read.*` | yes | 4 |  |
| POST | /leave/leave-configurations/getDeleted | read | feature | `leaveConfig.read.*` | yes | 4 |  |
| POST | /leave/leave-configurations/restore | restore | feature | `leaveConfig.restore.*` | yes | 4 |  |
| POST | /leave/leave-configurations/search | read | feature | `leaveConfig.read.*` | yes | 4 |  |
| GET | /leave/leave-configurations/total | read | feature | `leaveConfig.read.*` | yes | 4 |  |
| PUT | /leave/leave-configurations/update | update | feature | `leaveConfig.update.*` | yes | 4 |  |
| POST | /leave/leave-requests/create | self | self | `leaveReq.create.*` | - | 4 | caller's own employee -> allow; otherwise needs this feature (match on body.employeeId) |
| POST | /leave/leave-requests/delete | delete | feature | `leaveReq.delete.*` | yes | 4 |  |
| GET | /leave/leave-requests/deleted | read | feature | `leaveReq.read.*` | yes | 4 |  |
| GET | /leave/leave-requests/get | read | feature | `leaveReq.read.*` | yes | 4 |  |
| POST | /leave/leave-requests/get | read | feature | `leaveReq.read.*` | yes | 4 |  |
| GET | /leave/leave-requests/getById | read | feature | `leaveReq.read.*` | yes | 4 |  |
| POST | /leave/leave-requests/getEmployee | self | self | `leaveReq.read.*` | - | 4 | caller's own employee -> allow; otherwise needs this feature (match on body.employeeId) |
| POST | /leave/leave-requests/overviewByEmployee | read | feature | `leaveReq.read.*` | yes | 4 |  |
| POST | /leave/leave-requests/restore | restore | feature | `leaveReq.restore.*` | yes | 4 |  |
| POST | /leave/leave-requests/search | read | feature | `leaveReq.read.*` | yes | 4 |  |
| GET | /leave/leave-requests/total | read | feature | `leaveReq.read.*` | yes | 4 |  |
| PUT | /leave/leave-requests/update | update | feature | `leaveReq.update.*` | yes | 4 |  |
| POST | /leave/leave-requests/updateStatus | approve | feature | `leaveReq.approve.*` | yes | 4 | covers approve and reject |
| PUT | /role/changeRole | update | feature | `role.update.*` | yes | 2 |  |
| POST | /role/create | create | feature | `role.create.*` | yes | 2 |  |
| POST | /role/delete | delete | feature | `role.delete.*` | yes | 2 |  |
| GET | /role/get | read | feature | `role.read.*` | yes | 2 |  |
| POST | /role/get | read | feature | `role.read.*` | yes | 2 |  |
| POST | /role/getById | read | feature | `role.read.*` | yes | 2 |  |
| POST | /role/getByName | read | feature | `role.read.*` | yes | 2 |  |
| POST | /role/getRoleById | read | feature | `role.read.*` | yes | 2 |  |
| POST | /role/restore | restore | feature | `role.delete.*` | yes | 2 | restore mapped to delete feature |
| POST | /role/search | read | feature | `role.read.*` | yes | 2 |  |
| GET | /role/total | read | feature | `role.read.*` | yes | 2 |  |
| PUT | /role/update | update | feature | `role.update.*` | yes | 2 |  |
| POST | /shift/assignedEmployees | special | feature | `shift.assignments.assignedEmployees.*` | yes | 3 |  |
| POST | /shift/assignmentsByEmployee | read | feature | `shift.read.*` | yes | 3 |  |
| POST | /shift/assignToEmployee | special | feature | `shift.assignments.assignToEmployee.*` | yes | 3 |  |
| POST | /shift/assignToEmployees | special | feature | `shift.assignments.assignToEmployee.*` | yes | 3 |  |
| POST | /shift/assignToUnit | special | feature | `shift.assignments.assignToUnit.*` | yes | 3 |  |
| POST | /shift/checkAssignmentConflicts | read | feature | `shift.read.*` | yes | 3 |  |
| POST | /shift/create | create | feature | `shift.create.*` | yes | 3 |  |
| POST | /shift/delete | delete | feature | `shift.delete.*` | yes | 3 |  |
| GET | /shift/deleted | read | feature | `shift.read.*` | yes | 3 |  |
| GET | /shift/get | read | feature | `shift.read.*` | yes | 3 |  |
| GET | /shift/getAll | read | feature | `shift.read.*` | yes | 3 |  |
| GET | /shift/getById | read | feature | `shift.read.*` | yes | 3 |  |
| POST | /shift/removeAssignment | special | feature | `shift.assignments.removeAssignment.*` | yes | 3 |  |
| POST | /shift/restore | restore | feature | `shift.restore.*` | yes | 3 |  |
| POST | /shift/search | read | feature | `shift.read.*` | yes | 3 |  |
| POST | /shift/timetable/delete | update | feature | `shift.update.*` | yes | 3 |  |
| POST | /shift/timetable/get | read | feature | `shift.read.*` | yes | 3 |  |
| POST | /shift/timetable/upsert | update | feature | `shift.update.*` | yes | 3 |  |
| POST | /shift/timetableBlock/create | create | feature | `shift.timetableBlock.create.*` | yes | 3 |  |
| POST | /shift/timetableBlock/delete | delete | feature | `shift.timetableBlock.delete.*` | yes | 3 |  |
| POST | /shift/timetableBlock/get | read | feature | `shift.timetableBlock.read.*` | yes | 3 |  |
| POST | /shift/timetableBlock/update | update | feature | `shift.timetableBlock.update.*` | yes | 3 |  |
| GET | /shift/total | read | feature | `shift.read.*` | yes | 3 |  |
| PUT | /shift/update | update | feature | `shift.update.*` | yes | 3 |  |
| GET | /stats/customer | read | feature | `voucher.read.*` | yes | 3 |  |
| GET | /stats/dashboard | read | feature | `voucher.read.*` | yes | 3 |  |
| POST | /stats/dateRange | read | feature | `voucher.read.*` | yes | 3 |  |
| GET | /stats/gatePass | read | feature | `voucher.read.*` | yes | 3 |  |
| GET | /stats/item | read | feature | `voucher.read.*` | yes | 3 |  |
| GET | /stats/widgets | read | feature | `voucher.read.*` | yes | 3 |  |
| GET | /systemConfig/get | read | feature | `systemConfig.read.*` | yes | 1 |  |
| GET | /systemConfig/schedulerLogs | read | feature | `systemConfig.read.*` | yes | 1 |  |
| PUT | /systemConfig/update | update | feature | `systemConfig.update.*` | yes | 1 |  |
| POST | /unit/create | create | feature | `unit.create.*` | yes | 3 |  |
| POST | /unit/delete | delete | feature | `unit.delete.*` | yes | 3 |  |
| GET | /unit/deleted | read | feature | `unit.read.*` | yes | 3 |  |
| GET | /unit/get | read | feature | `unit.read.*` | yes | 3 |  |
| GET | /unit/getAll | read | feature | `unit.read.*` | yes | 3 |  |
| POST | /unit/getAttendanceAndStats | read | feature | `unit.read.*` | yes | 3 |  |
| GET | /unit/getById | read | feature | `unit.read.*` | yes | 3 |  |
| POST | /unit/getHistoryById | history | feature | `unit.viewPreviousUpdate.*` | yes | 3 |  |
| POST | /unit/restore | restore | feature | `unit.restore.*` | yes | 3 |  |
| POST | /unit/search | read | feature | `unit.read.*` | yes | 3 |  |
| GET | /unit/total | read | feature | `unit.read.*` | yes | 3 |  |
| PUT | /unit/update | update | feature | `unit.update.*` | yes | 3 |  |
| POST | /unitEmployee/addEmployeesToUnit | update | feature | `unit.update.*` | yes | 3 |  |
| POST | /unitEmployee/assignEmployeesToUnit | update | feature | `unit.update.*` | yes | 3 |  |
| POST | /unitEmployee/getEmployeesByUnitId | read | feature | `unit.read.*` | yes | 3 |  |
| POST | /unitEmployee/getUnitsByEmployeeId | read | feature | `unit.read.*` | yes | 3 |  |
| POST | /unitEmployee/removeEmployeeFromUnit | update | feature | `unit.update.*` | yes | 3 |  |
| POST | /unitEmployee/removeEmployeesFromUnit | update | feature | `unit.update.*` | yes | 3 |  |
| POST | /user/changePassword | self | self | `(own account)` | - | - | caller's own employee -> allow; otherwise needs this feature (match on body.employeeId) |
| POST | /user/changeUserPassword | update | feature | `user.update.*` | yes | 2 |  |
| POST | /user/checkPassword | self | self | `(own account)` | - | - | caller's own employee -> allow; otherwise needs this feature (match on body.employeeId) |
| POST | /user/create | create | feature | `user.create.*` | yes | 2 |  |
| POST | /user/delete | delete | feature | `user.delete.*` | yes | 2 |  |
| GET | /user/get | read | feature | `user.read.*` | yes | 2 |  |
| POST | /user/get | read | feature | `user.read.*` | yes | 2 |  |
| POST | /user/getById | read | feature | `user.read.*` | yes | 2 |  |
| POST | /user/getDetaileUserById | read | feature | `user.read.*` | yes | 2 |  |
| GET | /user/getLoggedInUser | read | token | `-` | - | - | every logged-in user needs their own profile |
| GET | /user/getNonAssociatedUsers | read | feature | `user.read.*` | yes | 2 |  |
| POST | /user/restore | restore | feature | `user.delete.*` | yes | 2 | restore mapped to delete feature |
| POST | /user/search | read | feature | `user.read.*` | yes | 2 |  |
| GET | /user/total | read | feature | `user.read.*` | yes | 2 |  |
| PUT | /user/update | update | feature | `user.update.*` | yes | 2 |  |
| POST | /userGroup/create | update | feature | `user.update.*` | yes | 2 | assigning roles/groups to a user |
| POST | /userGroup/delete | update | feature | `user.update.*` | yes | 2 | assigning roles/groups to a user |
| GET | /userGroup/get | read | feature | `user.read.*` | yes | 2 |  |
| POST | /userGroup/getById | read | feature | `user.read.*` | yes | 2 |  |
| POST | /userGroup/getByUserId | read | feature | `user.read.*` | yes | 2 |  |
| POST | /userGroup/restore | update | feature | `user.update.*` | yes | 2 | assigning roles/groups to a user |
| PUT | /userGroup/update | update | feature | `user.update.*` | yes | 2 | assigning roles/groups to a user |
| POST | /userRole/create | update | feature | `user.update.*` | yes | 2 | assigning roles/groups to a user |
| POST | /userRole/delete | update | feature | `user.update.*` | yes | 2 | assigning roles/groups to a user |
| GET | /userRole/get | read | feature | `user.read.*` | yes | 2 |  |
| POST | /userRole/getById | read | feature | `user.read.*` | yes | 2 |  |
| POST | /userRole/getByUserId | read | feature | `user.read.*` | yes | 2 |  |
| POST | /userRole/restore | update | feature | `user.update.*` | yes | 2 | assigning roles/groups to a user |
| PUT | /userRole/update | update | feature | `user.update.*` | yes | 2 | assigning roles/groups to a user |
| POST | /visitor/checkout | update | feature | `visitor.checkout.*` | yes | 1 |  |
| POST | /visitor/create | create | feature | `visitor.create.*` | yes | 1 |  |
| POST | /visitor/delete | delete | feature | `visitor.delete.*` | yes | 1 |  |
| GET | /visitor/deleted | read | feature | `visitor.read.*` | yes | 1 |  |
| POST | /visitor/excel | export | feature | `visitor.export.*` | yes | 1 |  |
| POST | /visitor/filtered | read | feature | `visitor.read.*` | yes | 1 |  |
| GET | /visitor/get | read | feature | `visitor.read.*` | yes | 1 |  |
| GET | /visitor/getAll | read | feature | `visitor.read.*` | yes | 1 |  |
| GET | /visitor/getById | read | feature | `visitor.read.*` | yes | 1 |  |
| POST | /visitor/getHistoryById | history | feature | `visitor.viewPreviousUpdate.*` | yes | 1 |  |
| POST | /visitor/import | import | feature | `visitor.import.*` | yes | 1 |  |
| POST | /visitor/lookup | read | feature | `visitor.read.*` | yes | 1 |  |
| POST | /visitor/personHistory | read | feature | `visitor.read.*` | yes | 1 |  |
| GET | /visitor/present | read | feature | `visitor.read.*` | yes | 1 |  |
| POST | /visitor/restore | restore | feature | `visitor.restore.*` | yes | 1 |  |
| POST | /visitor/search | read | feature | `visitor.read.*` | yes | 1 |  |
| POST | /visitor/stats | read | feature | `visitor.read.*` | yes | 1 |  |
| POST | /visitor/suggest | read | feature | `visitor.read.*` | yes | 1 |  |
| GET | /visitor/template | export | feature | `visitor.export.*` | yes | 1 |  |
| GET | /visitor/total | read | feature | `visitor.read.*` | yes | 1 |  |
| PUT | /visitor/update | update | feature | `visitor.update.*` | yes | 1 |  |
| GET | /webhook/permissions | open | open | `-` | - | - |  |
| POST | /webhook/permissions | open | open | `-` | - | - |  |
