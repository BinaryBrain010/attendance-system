# Audit Inventory (Run 11 Part 1)

Date: 2026-10-16. Read-only survey. No code changed in this part.

Purpose: record, before any audit work is built, exactly what every Prisma model already
carries for audit (who/when created, updated, deleted) and every place in the codebase that
writes data outside the normal per-request service path (raw SQL, bulk operations, crons,
import and seed scripts). Parts 2 and 3 build on this.

## Conventions found in the current schema

The codebase does NOT use the field names the Run 11 brief uses. The existing convention is:

- `isDeleted DateTime?` is the soft-delete marker. A non-null value is the delete timestamp.
  There is no separate `deletedAt` and no `deletedById` anywhere.
- `createdBy` / `updatedBy` are plain `String?` columns holding a User id. They are NOT
  relations to User, and the newer models use `@db.VarChar(36)` while the CRM models use a
  bare `String?`. There is no `createdById` / `updatedById` except `Task.createdById`
  (which sits next to `Task.createdBy`, so Task currently has both).
- `previousUpdates Json?` holds a history of past values. Only five models have it:
  Employee, Attendance, Holiday, Unit, Visitor.
- `createdAt` / `updatedAt` exist on almost everything, but inconsistently: some use
  `@default(now())` / `@updatedAt`, many are plain nullable `DateTime?` that services set by
  hand (via the `gpCreate` / `gpUpdate` helpers in `src/core/models/base.model.ts`).

Writing of `createdBy` / `updatedBy` is done ad hoc, per controller or per service, not
centrally. It is set in roughly a dozen places and skipped in most others, which is the core
problem Run 11 Part 2 fixes with a request context plus a Prisma client extension.

## How writes reach the database today

- Every model import resolves to `src/core/models/base.model.ts`, a single
  `prisma.$extends({ model: { $allModels: {...} } })` wrapper (helpers `gpCreate`, `gpUpdate`,
  `gpSoftDelete`, `gpRestore`, paginators). The underlying client is the singleton in
  `src/core/database/prisma.client.ts`. This single extend point is where Part 2/3 hook in a
  `query` extension for stamping and audit-log writes.
- Auth: `src/middleware/authentication.ts` verifies the JWT and sets `req.userId`. The token
  payload is `{ userId, unitIds, jti }`. Platform (Admin / Attendance App / Mobile) is known
  only at login time (`user.controller.ts loginUser`), not stored in the token. IP and user
  agent are not captured anywhere today.
- `src/helper/routes.helper.ts` mounts every authenticated router behind
  `authenticateToken, requirePermission`. This is the natural place to seed the request
  context (AsyncLocalStorage) once `req.userId` is set.

## Per-model audit-field table

Legend: y = present. `isDeleted` is the soft-delete timestamp. `by` columns are the ad-hoc
String user-id columns. "writes by" = does any service/controller currently set createdBy or
updatedBy for this model.

| Model | createdAt | updatedAt | createdBy | updatedBy | isDeleted | prevUpdates | writes by? | class |
|---|---|---|---|---|---|---|---|---|
| Customer | y | y | - | - | y | - | no | business |
| Item | y | y | - | - | y | - | no | business |
| GatePass | y | y | - | - | y | - | no | business |
| GatePassItem | y | y | - | - | y | - | no | line item (of GatePass) |
| User | y | y | - | - | y | - | no | business (security) |
| Group | y | y | - | - | y | - | no | business (security) |
| UserGroup | y | y | - | - | y | - | no | pure join |
| Role | y | y | - | - | y | - | no | business (security) |
| UserRole | y | y | - | - | y | - | no | pure join |
| GroupRole | y | y | - | - | y | - | no | pure join |
| AppFeature | y | y | - | - | y | - | no | reference/config |
| FeaturePermission | y | y | - | - | y | - | no | business (security, grants) |
| BlacklistToken | y | - | - | - | - | - | no | session/token (exclude) |
| LoggedInUsers | y | - | - | - | - | - | no | session/token (exclude) |
| Employee | y | y | y | y | y | y | yes | business |
| Attendance | y | y | y | y | y | y | yes | business |
| LeaveRequest | y | y | - | - | y | - | no | business |
| AttendanceRequest | y | y | requestedBy/approvedBy | - | y | - | partial | business |
| LeaveConfiguration | y | y | - | - | y | - | no | business |
| LeaveAllocation | y | y | - | - | y | - | no | business |
| AttendanceScheduler | y | y | - | - | y | - | no | cron run-log (exclude) |
| Shift | y | y | - | - | y | - | no | business |
| ShiftTimetable | y | y | - | - | y | - | no | child (of Shift), raw-SQL written |
| ShiftTimetableBlock | y | y | - | - | y | - | no | child (of Shift), raw-SQL written |
| ShiftAssignment | y | y | - | - | y | - | no | business |
| Team | y | y | y | y | y | - | yes | business |
| TeamMember | y | - | - | - | y | - | no | pure join (+requiresDailyReport) |
| Task | y | y | y (+createdById) | y | y | - | yes | business |
| TaskAssignee | - | - | - | - | - | - | no | pure join |
| TaskChecklistItem | - | - | - | - | y | - | no | line item (of Task) |
| TaskComment | y | - | userId | - | y | - | author set | append-only feed |
| TaskWatcher | - | - | - | - | - | - | no | pure join |
| DailyReport | y | y | - | - | y | - | no | business (author = employeeId) |
| DailyReportComment | y | - | userId | - | y | - | author set | append-only feed |
| Notification | y | - | - | - | - | - | no | noise (exclude) |
| Holiday | y | y | y | y | y | y | yes | business |
| SystemConfig | - | y | - | - | - | - | no | singleton config (security) |
| Unit | y | y | y | y | y | y | yes | business |
| UnitEmployee | y | y | - | - | y | - | no | pure join |
| ActivityLog | y | - | userId | - | - | - | self | existing log (exclude) |
| Visitor | y | y | y | y | y | y | yes | business |
| Category | y | y | y | y | y | - | yes | business |
| Brand | y | y | y | y | y | - | yes | business |
| Product | y | y | y | y | y | - | yes | business |
| ProductVariant | - | - | - | - | y | - | no | line item (of Product) |
| ProductImage | - | - | - | - | y | - | no | line item (of Product) |
| PriceList | y | y | y | y | y | - | yes | business (cost-sensitive) |
| Bundle | y | y | y | y | y | - | yes | business |
| BundleItem | - | - | - | - | y | - | no | line item (of Bundle) |
| SalesAgent | y | y | y | y | y | - | yes | business |
| Lead | y | y | y | y | y | - | yes | business |
| LeadActivity | y | - | createdBy | - | y | - | author set | append-only feed |
| Quotation | y | y | y | y | y | - | yes | business |
| QuotationItem | - | - | - | - | y | - | no | line item (of Quotation) |
| SalesOrder | y | y | y | y | y | - | yes | business |
| SalesOrderItem | - | - | - | - | y | - | no | line item (of SalesOrder) |
| SalesReturn | y | y | y | y | y | - | yes | business |
| ReturnItem | - | - | - | - | y | - | no | line item (of SalesReturn) |

### Classification summary

- Pure join tables (no audit actor columns to add; audited via their parent):
  UserGroup, UserRole, GroupRole, TeamMember, TaskAssignee, TaskWatcher, UnitEmployee.
- Line-item children (owned by one parent; changes audited under the parent entity, not
  stamped separately): GatePassItem, TaskChecklistItem, ProductVariant, ProductImage,
  BundleItem, QuotationItem, SalesOrderItem, ReturnItem.
- Append-only feeds (immutable, already carry an author; no update/delete stamping needed):
  TaskComment, DailyReportComment, LeadActivity.
- Session / token / log / noise tables (excluded from audit entirely, see Part 3):
  BlacklistToken, LoggedInUsers, AttendanceScheduler, Notification, ActivityLog.
- Singleton config: SystemConfig (no isDeleted; audited explicitly as a config change).
- Everything else is a top-level business model that Part 2 gives the full
  createdById / updatedById / deletedById / deletedAt set to.

## Raw SQL writes

All raw SQL lives in model/service files via `$queryRaw` / `$executeRaw(Unsafe)`. Most raw
usage is reads (reporting, search). The raw WRITES are:

- `src/helper/reset.helper.ts:9` — `DELETE FROM "<table>"` for every table. Dev reset only
  (`reset.ts`). Destructive, no audit. Must stay excluded; it is a maintenance wipe.
- `src/modules/AMS/Shift/services/shift.service.ts` — raw INSERT into `ShiftTimetable`
  (line ~55), raw INSERT into `ShiftTimetableBlock` (line ~463), raw UPDATE of
  `ShiftTimetableBlock` (lines ~496, ~526). These bypass the Prisma client extension, so the
  stamping/audit extension will NOT see them. Part 2/3 note: either route these through the
  client or add explicit audit calls; documented as a known gap for the Shift timetable child
  rows (low business-audit value, children of an audited Shift).

Other files containing raw SQL are reads only: activityLog, attendance models,
attendnace.service, unit.service, gatePass.model, item.model, stats.service, visitor.model,
featurePermission.model, user.model.

## Bulk operations (createMany / updateMany / deleteMany)

These bypass per-row create/update hooks, so the extension must handle them as one audit
entry with filter + count (Part 3), or they are intentionally excluded.

Business-relevant bulk writes:
- `Employee/models/employee.model.ts:605` createMany Attendance (seed attendance for a new
  employee).
- `Holiday/models/holiday.model.ts:337,351` updateMany + createMany Attendance (mark a
  holiday across employees).
- `Shift/services/shift.service.ts` updateMany ShiftAssignment/ShiftTimetable/
  ShiftTimetableBlock (soft-delete on shift update) and createMany ShiftTimetable.
- `Unit/services/unitEmployee.service.ts:20,89,105` updateMany UnitEmployee (membership).
- `PriceList/services/pricelist.service.ts:19,54` + `shopifyImport.service.ts:129`
  updateMany PriceList (close out old price rows).
- `Quotation/services/quotation.service.ts:122,164` deleteMany QuotationItem, updateMany
  Quotation (version supersede).
- `SalesOrder/services/salesOrder.service.ts:139` deleteMany SalesOrderItem (re-save items).
- `Visitor/models/visitor.model.ts:321` createMany Visitor (bulk import).
- Work: `Task/services/task.service.ts:122,123,170,171` set assignees/watchers;
  `Team/services/team.service.ts:60,61` set members; `workHelpers.ts:19` createMany
  Notification (excluded table).

Join / cascade cleanup bulk deletes (pure-join or token tables, excluded from audit):
- `rbac/group/models/group.model.ts` groupRole/userGroup deleteMany.
- `rbac/role/models/role.model.ts` userRole/groupRole deleteMany.
- `rbac/user/models/user.model.ts` userRole/userGroup deleteMany.
- `rbac/Token/models/token.model.ts` blacklistToken deleteMany.
- `Notification/services/notification.service.ts` notification updateMany (mark read).

## Crons / schedulers

- `src/helper/schedule.helper.ts` — TokenCleanHelper. Cleans expired tokens
  (BlacklistToken/LoggedInUsers). Session tables, excluded.
- `src/modules/AMS/Attendance/helper/schedule.helper.ts` — AttendanceSchedulerHelper. Marks
  absentees / on-leave / auto checkout. Writes Attendance and AttendanceScheduler. Business
  writes here must run as the System user (Part 2) so createdBy is never blank.
- `src/modules/Work/helper/workSchedule.helper.ts` — WorkSchedulerHelper. Spawns recurring
  tasks, sends due-soon / report-missing notifications. Writes Task and Notification. Task
  writes must run as System.

All three are started from `src/core/server/server.ts` (TokenCleanHelper,
AttendanceSchedulerHelper, WorkSchedulerHelper references in the constructor).

## Import / seed scripts (run outside the request cycle, must run as System)

Root scripts: `crmSeed.ts`, `workSeed.ts`, `seedRoles.ts`, `seeder.ts`,
`seedOnlineOrdersAgent.ts`, `setupOfficeEmployees.ts`, `updateEmployeeCodes.ts`,
`deleteOrphanedUsers.ts`, `importReceptionVisitors.ts`, `reset.ts`, `leadImportDryRun.ts`,
`returnImportDryRun.ts`.

Service-level importers: `CRM/Lead/services/leadImport.service.ts`,
`CRM/Return/services/returnImport.service.ts`,
`CRM/Catalogue/Product/services/shopifyImport.service.ts`,
`src/helper/seeder.helper.ts`.

For Part 2 these must set the request context to the System user (or pass createdById
explicitly) so imported rows carry "System" rather than null. Existing imported rows stay
null and render as "System (legacy)" per the brief; where `previousUpdates` holds the
original actor, backfill reads from that JSON only.

## Decisions carried into Part 2 / Part 3

1. Keep the existing `isDeleted DateTime?` as the delete marker. Add `deletedById String?`
   next to it, and treat `isDeleted` as the `deletedAt` value (no duplicate column), to avoid
   a disruptive rename of a column used in ~40 models and hundreds of `isDeleted: null`
   filters.
2. Standardise on `createdById` / `updatedById` / `deletedById` (VarChar(36), nullable, FK to
   User) as the new actor columns. Keep the legacy `createdBy` / `updatedBy` strings in place
   for one transition (backfill `createdById` from them where present); do not break existing
   writers. `Task.createdById` already matches the target name.
3. Central stamping + audit via a `query` extension layered onto `base.model.ts`, fed by an
   AsyncLocalStorage request context populated in `routes.helper.ts` after `req.userId` is
   set. Crons, imports and seeders wrap their work in the context as the System user.
4. Raw-SQL Shift-timetable writes and all bulk ops are listed above so Part 3 can decide, per
   call site, between one summary audit entry and explicit exclusion.
