# QuickPass / QuickMark backend endpoints and required features

Feature each endpoint needs under RBAC_ENFORCE=on (from the route map). open=no auth; token=any logged-in user; self=own employee else the feature; feature=needs it; dynamic/god as noted. Endpoints marked NOT-IN-MAP are not registered routes (likely client-side-only or legacy).

## QuickPass (platform: Mobile)

| Method+Path | Access | Feature |
|---|---|---|
| POST /auth/login | open | `-` |
| GET /auth/logout | open | `-` |
| GET /auth/logoutOfAllDevices | open | `-` |
| POST /gatePass/get | feature | `voucher.read.*` |
| POST /gatePass/getDeleted | feature | `voucher.read.*` |
| POST /gatePass/date | feature | `voucher.read.*` |
| POST /gatePass/status | feature | `voucher.read.*` |
| POST /gatePass/create | feature | `voucher.create.*` |
| POST /gatePass/restore | feature | `voucher.restore.*` |
| POST /gatePass/approve | feature | `voucher.post.*` |
| POST /gatePass/pdf | feature | `voucher.pdf.*` |
| POST /gatePass/delete | feature | `voucher.delete.*` |
| POST /gatePass/getById | feature | `voucher.read.*` |
| POST /gatePass/customerId | feature | `voucher.read.*` |
| POST /gatePass/itemId | feature | `voucher.read.*` |
| GET /gatePass/total | feature | `voucher.read.*` |
| GET /gatePass/get | feature | `voucher.read.*` |
| GET /gatePass/report | feature | `voucher.read.*` |
| PUT /gatePass/update | feature | `voucher.update.*` |
| POST /customer/get | feature | `customer.read.*` |
| POST /customer/getDeleted | feature | `customer.read.*` |
| POST /customer/create | feature | `customer.create.*` |
| POST /customer/restore | feature | `customer.restore.*` |
| POST /customer/delete | feature | `customer.delete.*` |
| POST /customer/getById | feature | `customer.read.*` |
| POST /customer/search | feature | `customer.read.*` |
| GET /customer/get | feature | `customer.read.*` |
| GET /customer/getFrequent | feature | `customer.read.*` |
| GET /customer/total | feature | `customer.read.*` |
| PUT /customer/update | feature | `customer.update.*` |
| POST /item/get | feature | `item.read.*` |
| POST /item/getDeleted | feature | `item.read.*` |
| POST /item/create | feature | `item.create.*` |
| POST /item/restore | feature | `item.restore.*` |
| POST /item/delete | feature | `item.delete.*` |
| POST /item/getById | feature | `item.read.*` |
| POST /item/search | feature | `item.read.*` |
| POST /item/getBySerialNo | feature | `item.read.*` |
| GET /item/total | feature | `item.read.*` |
| GET /item/get | feature | `item.read.*` |
| GET /item/getOutOfStock | feature | `item.read.*` |
| PUT /item/update | feature | `item.update.*` |
| GET /user/get | feature | `user.read.*` |
| GET /user/total | feature | `user.read.*` |
| POST /user/getById | feature | `user.read.*` |
| POST /user/checkPassword | self | `(own account)` |
| POST /user/changePassword | self | `(own account)` |
| POST /user/create | feature | `user.create.*` |
| POST /user/delete | feature | `user.delete.*` |
| POST /user/restore | feature | `user.delete.*` |
| POST /user/search | feature | `user.read.*` |
| PUT /user/update | feature | `user.update.*` |
| GET /stats/dashboard | feature | `voucher.read.*` |
| GET /stats/gatePass | feature | `voucher.read.*` |
| GET /stats/customer | feature | `voucher.read.*` |
| GET /stats/item | feature | `voucher.read.*` |
| GET /stats/widgets | feature | `voucher.read.*` |
| POST /stats/dateRange | feature | `voucher.read.*` |
| GET /access/getUserGroup | token | `-` |
| GET /access/getUserRole | token | `-` |
| POST /access/getPermission | token | `-` |
| POST /access/checkPermission | token | `-` |
| GET /webhook/permissions | open | `-` |

**Features this app needs granted (feature-gated routes): ** `customer.create.*`, `customer.delete.*`, `customer.read.*`, `customer.restore.*`, `customer.update.*`, `item.create.*`, `item.delete.*`, `item.read.*`, `item.restore.*`, `item.update.*`, `user.create.*`, `user.delete.*`, `user.read.*`, `user.update.*`, `voucher.create.*`, `voucher.delete.*`, `voucher.pdf.*`, `voucher.post.*`, `voucher.read.*`, `voucher.restore.*`, `voucher.update.*`

## QuickMark (platform: Attendance App)

| Method+Path | Access | Feature |
|---|---|---|
| POST /auth/login | open | `-` |
| GET /auth/logout | open | `-` |
| GET /auth/logoutOfAllDevices | open | `-` |
| POST /auth/logoutUserOfAllDevices | open | `-` |
| POST /attendance/getEmployeeAttendance | self | `attendance.read.*` |
| POST /attendance/markAttendance | self | `attendance.markAttendance.*` |
| POST /attendanceReq/getEmployee | self | `attendanceReq.read.*` |
| POST /attendanceReq/create | self | `attendanceReq.create.*` |
| POST /leave/leave-allocations/getByEmployeeId | self | `leaveAlloc.read.*` |
| POST /leave/leave-requests/getEmployee | self | `leaveReq.read.*` |
| POST /leave/leave-requests/create | self | `leaveReq.create.*` |
| POST /user/checkPassword | self | `(own account)` |
| POST /user/changePassword | self | `(own account)` |
| POST /access/checkPermission | token | `-` |
| POST /access/checkPermissions | token | `-` |

**Features this app needs granted (feature-gated routes): ** (none; all open/token/self)

