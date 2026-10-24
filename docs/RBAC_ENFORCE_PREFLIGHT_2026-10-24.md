# RBAC_ENFORCE flip preflight — 2026-10-24

Source: **local DB** role/group grants (may differ from prod — run with --grants=<prod export> for the real picture).
Routes in featureMap: **529** (feature-gated: 480, god-only: 4).
Each section lists the **in-module** feature routes that would start returning 403 when prod flips RBAC_ENFORCE log→on — routes inside apps the role actually uses. Cross-module 403s (modules the role has no access to, so never calls) are counted but excluded. Grant the listed features, or confirm the role never calls that route, before flipping.

## Admin  —  role "Admin" + group "Admins"
Module roots this role operates in: `activityLog`, `analytics`, `appModules`, `attendance`, `attendanceReq`, `audit`, `crm`, `customer`, `employee`, `featurePermission`, `gatePass`, `group`, `holiday`, `item`, `leave`, `leaveAlloc`, `leaveConfig`, `leaveReq`, `login`, `profile`, `role`, `setting`, `shift`, `systemConfig`, `unit`, `user`, `visitor`, `voucher`, `work`.
**0** in-module feature routes would 403. 0 other feature routes would also 403 but belong to modules this role has no access to — ignore those.
> ✅ Nothing to grant — every route inside this role's own modules is already covered.

## HR  —  role "HR"
Module roots this role operates in: `activityLog`, `analytics`, `appModules`, `attendance`, `attendanceReq`, `employee`, `holiday`, `leave`, `leaveAlloc`, `leaveConfig`, `leaveReq`, `login`, `profile`, `shift`, `unit`.
**0** in-module feature routes would 403. 310 other feature routes would also 403 but belong to modules this role has no access to — ignore those.
> ✅ Nothing to grant — every route inside this role's own modules is already covered.

## Attendance Manager  —  role "Attendance Manager" + group "Attendance Managers"
Module roots this role operates in: `analytics`, `appModules`, `attendance`, `employee`, `login`, `profile`.
**0** in-module feature routes would 403. 416 other feature routes would also 403 but belong to modules this role has no access to — ignore those.
> ✅ Nothing to grant — every route inside this role's own modules is already covered.

## Sales Agent  —  role "Sales Agent"
Module roots this role operates in: `appModules`, `crm`, `login`, `profile`.
**39** in-module feature routes would 403. 348 other feature routes would also 403 but belong to modules this role has no access to — ignore those.

| Grant this feature | clears # routes | example routes |
|---|---|---|
| `crm.catalogue.create.*` | 8 | POST /crmBrand/create<br>POST /crmBundle/addItem<br>POST /crmBundle/create<br>POST /crmCategory/create<br>…+4 more |
| `crm.catalogue.delete.*` | 5 | POST /crmBrand/delete<br>POST /crmBundle/delete<br>POST /crmCategory/delete<br>POST /crmPriceList/delete<br>…+1 more |
| `crm.catalogue.update.*` | 5 | PUT /crmBrand/update<br>PUT /crmBundle/update<br>PUT /crmCategory/update<br>PUT /crmPriceList/update<br>…+1 more |
| `crm.catalogue.restore.*` | 4 | POST /crmBrand/restore<br>POST /crmBundle/restore<br>POST /crmCategory/restore<br>POST /crmProduct/restore |
| `crm.catalogue.cost.*` | 2 | POST /crmPriceList/bulkPrice<br>POST /crmPriceList/withCost |
| `crm.lead.delete.*` | 2 | POST /lead/delete<br>POST /leadActivity/delete |
| `crm.catalogue.import.*` | 1 | POST /crmProduct/import |
| `crm.lead.import.*` | 1 | POST /lead/import |
| `crm.lead.restore.*` | 1 | POST /lead/restore |
| `crm.lead.transfer.*` | 1 | POST /lead/transfer |
| `crm.quotation.delete.*` | 1 | POST /quotation/delete |
| `crm.quotation.restore.*` | 1 | POST /quotation/restore |
| `crm.agent.create.*` | 1 | POST /salesAgent/create |
| `crm.agent.delete.*` | 1 | POST /salesAgent/delete |
| `crm.agent.restore.*` | 1 | POST /salesAgent/restore |
| `crm.agent.update.*` | 1 | PUT /salesAgent/update |
| `crm.order.delete.*` | 1 | POST /salesOrder/delete |
| `crm.order.restore.*` | 1 | POST /salesOrder/restore |
| `crm.return.delete.*` | 1 | POST /salesReturn/delete |

## Sales Manager  —  role "Sales Manager"
Module roots this role operates in: `appModules`, `crm`, `login`, `profile`.
**37** in-module feature routes would 403. 348 other feature routes would also 403 but belong to modules this role has no access to — ignore those.

| Grant this feature | clears # routes | example routes |
|---|---|---|
| `crm.catalogue.create.*` | 8 | POST /crmBrand/create<br>POST /crmBundle/addItem<br>POST /crmBundle/create<br>POST /crmCategory/create<br>…+4 more |
| `crm.catalogue.delete.*` | 5 | POST /crmBrand/delete<br>POST /crmBundle/delete<br>POST /crmCategory/delete<br>POST /crmPriceList/delete<br>…+1 more |
| `crm.catalogue.update.*` | 5 | PUT /crmBrand/update<br>PUT /crmBundle/update<br>PUT /crmCategory/update<br>PUT /crmPriceList/update<br>…+1 more |
| `crm.catalogue.restore.*` | 4 | POST /crmBrand/restore<br>POST /crmBundle/restore<br>POST /crmCategory/restore<br>POST /crmProduct/restore |
| `crm.lead.delete.*` | 2 | POST /lead/delete<br>POST /leadActivity/delete |
| `crm.catalogue.import.*` | 1 | POST /crmProduct/import |
| `crm.lead.import.*` | 1 | POST /lead/import |
| `crm.lead.restore.*` | 1 | POST /lead/restore |
| `crm.lead.transfer.*` | 1 | POST /lead/transfer |
| `crm.quotation.delete.*` | 1 | POST /quotation/delete |
| `crm.quotation.restore.*` | 1 | POST /quotation/restore |
| `crm.agent.create.*` | 1 | POST /salesAgent/create |
| `crm.agent.delete.*` | 1 | POST /salesAgent/delete |
| `crm.agent.restore.*` | 1 | POST /salesAgent/restore |
| `crm.agent.update.*` | 1 | PUT /salesAgent/update |
| `crm.order.delete.*` | 1 | POST /salesOrder/delete |
| `crm.order.restore.*` | 1 | POST /salesOrder/restore |
| `crm.return.delete.*` | 1 | POST /salesReturn/delete |

## Frontdesk  —  role "Frontdesk"
Module roots this role operates in: `appModules`, `employee`, `login`, `profile`, `visitor`.
**9** in-module feature routes would 403. 435 other feature routes would also 403 but belong to modules this role has no access to — ignore those.

| Grant this feature | clears # routes | example routes |
|---|---|---|
| `employee.update.*` | 3 | POST /employee/filesDel<br>PUT /employee/update<br>POST /employee/updateFile |
| `employee.excel.*` | 2 | POST /employee/getCard<br>GET /employee/getExcel |
| `employee.create.*` | 1 | POST /employee/create |
| `employee.delete.*` | 1 | POST /employee/delete |
| `employee.viewPreviousUpdate.*` | 1 | POST /employee/getHistoryById |
| `employee.restore.*` | 1 | POST /employee/restore |

## Head Office Reception  —  role "Head Office Reception"
Module roots this role operates in: `analytics`, `appModules`, `attendance`, `attendanceReq`, `employee`, `leave`, `leaveReq`, `login`, `profile`.
**0** in-module feature routes would 403. 395 other feature routes would also 403 but belong to modules this role has no access to — ignore those.
> ✅ Nothing to grant — every route inside this role's own modules is already covered.

## Warehouse  —  role "Warehouse" + group "Warehouse"
Module roots this role operates in: `appModules`, `customer`, `item`, `login`, `profile`, `setting`, `voucher`.
**0** in-module feature routes would 403. 424 other feature routes would also 403 but belong to modules this role has no access to — ignore those.
> ✅ Nothing to grant — every route inside this role's own modules is already covered.

## Executives
> No matching role/group in the grant source (role "Executives" / group "Executives") — confirm the exact name and re-run. (Skipped.)

## God-only routes (would 403 for every role above)
These 4 routes are intentionally god-only and are expected to 403 for normal roles — grant nothing unless a role genuinely needs them:
- `POST /appFeature/create`
- `POST /appFeature/delete`
- `POST /appFeature/restore`
- `PUT /appFeature/update`

_Not listed (never hard-403 at the gate): token (19), self/own-data (13), open (6), dynamic/scope-resolved (7)._
