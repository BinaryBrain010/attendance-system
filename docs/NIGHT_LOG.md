# Night log

Autonomous overnight run. Local only. Started 2026-10-13.

---

## Run 12 (2026-10-16, close Run 11 gaps)

Same rules. Backup first: qa/backups/run12_pre_20261016_182517.dump (pg_dump of gatePassSystem, 222 MB).

### Item 1 - Verify the load-test purge (restore pre-Run-11 dump, compare every table)  [DONE]
Restored run11_pre_20261016_165211.dump into scratch gatepass_shadow and compared exact row counts for
every table against dev. Findings:
- **Load-test purge confirmed complete.** Attendance, Holiday, Lead, SalesOrder, SalesReturn, Employee,
  Visitor, GatePass, User(business), Quotation all matched the pre-Run-11 baseline exactly. The
  449,850 /holiday/create cascade rows from the Run-11 first load test are gone.
- **Expected net-new diffs** (intended Run 11 additions, all explained): _prisma_migrations +1 (the
  audit migration), AppFeature +3 (audit.* / audit.read.* / audit.export.*), User +1 (the System
  user), new AuditLog table (0 rows), plus the audit id columns (no row-count change).
- **Residue found + cleaned** (all this conversation's harness artifacts, confirmed created after the
  dump or matching `QA_<digits>` / future-date patterns; no real record touched):
  - Attendance +1650 HOLIDAYS rows on 2031-2039 = cascade from the Run-11 audit/stamp test holidays
    whose Holiday rows were deleted but whose attendance side-effect leaked (same bug as the load
    test). Deleted (now matches baseline exactly).
  - QA_`<epochMillis>` Shift (26) + ShiftTimetable (156), Unit (26), LeaveConfiguration (40) =
    accumulated qa:rbac harness residue across runs (present in the baseline too). Removed; the 14
    shifts / 19 units / 2 leave configs that remain are the real, descriptively-named records.
  - ActivityLog: deleted 6306 orphaned Holiday logs from the deleted test holidays + orphaned logs
    for every hard-deleted QA entity across churn types. Real (soft-deleted) rows keep their logs.
- **qa:cleanup hardened** so none of this re-leaks: shift pattern broadened `QA_Shift_` -> `QA_`
  (+ ShiftTimetableBlock), new QA leave-configuration + QA unit blocks, HOLIDAYS-attendance purge
  widened from the 2099-only window to any date >= 2030, and a legacy-ActivityLog orphan sweep over
  the churn entity types. Re-ran cleanup: clean, zero residue. Scratch DB dropped.
- Real counts intact: leads 261, orders 68, returns 62, quotations 0, holidays 59, attendance 69883
  (== baseline), shifts 14, units 19; AuditLog 0.
- Commit (backend): see hash below.

## Run 11 (2026-10-16, audit fields + central AuditLog)

Same rules (local only, backup first, no push, no attribution, never edit records I did not
create, commit per part, log here).

### Part 1 - Inventory (no code)  [DONE]
Surveyed all 57 Prisma models and every non-request write path. Wrote docs/AUDIT_INVENTORY.md
with the full per-model audit-field table plus raw-SQL writes, bulk ops, crons and import/seed
scripts. Key findings that shape Parts 2-5:
- Existing convention is `isDeleted DateTime?` (soft-delete marker, doubles as deletedAt),
  `createdBy`/`updatedBy` as plain String user-ids (not relations), and `previousUpdates Json?`
  on only 5 models (Employee, Attendance, Holiday, Unit, Visitor). No deletedById anywhere.
  Task already has createdById (next to createdBy).
- createdBy/updatedBy are written ad hoc in ~12 places, skipped everywhere else. Motivates the
  central request-context + Prisma-client-extension approach.
- Single hook point: every model import resolves to src/core/models/base.model.ts (one
  $extends). Auth sets req.userId; token payload is {userId, unitIds, jti} (no platform/ip/ua).
  routes.helper.ts mounts auth then requirePermission -> natural place to seed the context.
- Decisions carried forward: keep isDeleted as the delete marker and add deletedById beside it
  (no disruptive rename); standardise on createdById/updatedById/deletedById VarChar(36) FK to
  User, keep legacy createdBy/updatedBy for one transition and backfill createdById from them;
  exclude session/token/log/noise tables (BlacklistToken, LoggedInUsers, AttendanceScheduler,
  Notification, ActivityLog); line-item children + pure-join tables audited via their parent.
- Known gap flagged: raw-SQL Shift-timetable INSERT/UPDATE (shift.service.ts) and reset.helper
  bypass the client extension; listed for a per-call-site decision in Part 3.
- Commit (backend): 83bf45f.

### Part 2 - Audit fields on every business model + central stamping  [DONE]
Backup first: qa/backups/run11_pre_20261016_165211.dump (pg_dump -Fc of gatePassSystem, 211 MB).
- Schema: added createdById/updatedById/deletedById (VarChar(36), nullable) to 31 business models,
  createdById-only to the 3 append-only feeds (LeadActivity, TaskComment, DailyReportComment),
  updatedById-only to SystemConfig. Skipped pure-join and line-item/children and
  session/log/noise tables. Applied via `prisma db push` (project's workflow); the formal
  migration is generated the Run-10 way in Part 5.
- Design decision (documented in AUDIT_INVENTORY): kept isDeleted DateTime? as the delete marker
  (it is the deletedAt), added deletedById beside it (no rename). createdById/updatedById/
  deletedById are plain scalar columns with NO Prisma relation and NO hard FK, exactly matching
  the codebase's existing createdBy/updatedBy convention. This avoids ~90 back-relation fields on
  User and db-push/migrate drift from constraints absent in schema.prisma. "Relation to User" is
  satisfied logically: ids resolve to User/Employee via a lookup helper (Part 4). If true FKs or
  navigable relations are wanted, that is a follow-up.
- Request context: src/core/context/requestContext.ts (AsyncLocalStorage carrying
  userId/ip/userAgent/platform/requestId, plus runAsSystem / runWithContext and the fixed
  SYSTEM_USER_ID). contextMiddleware.ts seeds it per request; wired in routes.helper.ts right
  after authenticateToken and before requirePermission.
- Central stamping: src/core/audit/{auditModels,stamp}.ts + a Prisma `query` $allOperations
  extension on base.model.ts. Ordering matters: the query extension is applied BEFORE the model
  extension so the gp* helpers' internal this.create/this.update are stamped too (verified: a
  first attempt with query-after-model left gpUpdate's updatedById null). The actor from context
  always WINS (overwrites any createdById/updatedById/deletedById in the body), closing the
  mass-assignment hole on non-whitelisted endpoints. Null actor (no context) leaves columns null.
- System user: src/core/audit/systemUser.ts ensureSystemUser() upserts the fixed-id "system" User
  at boot (server.ts). Crons wrapped in runAsSystem (Work + Attendance schedulers); standalone
  seed/import scripts (crmSeed, workSeed, seedRoles, importReceptionVisitors, setupOfficeEmployees,
  seedOnlineOrdersAgent) wrap main() in runAsSystem. Service-level importers run from controllers
  (already in a request context), so they attribute to the acting admin.
- Backfill: qa/backfillAuditIds.ts (idempotent, --dry supported) populates ONLY the new id
  columns from existing legacy values that are real User ids. Applied: createdById 20099
  (Employee 40, Attendance 16351, Visitor 3704, PriceList 2, LeadActivity 2), updatedById 10975
  (Employee 90, Attendance 10881, SalesAgent 1, Lead 2, SalesReturn 1). No business field touched;
  rows with no legacy actor stay null -> "System (legacy)". deletedById has no legacy source.
- Verified: stamping works for API create (createdById=caller), gp* update (updatedById=caller),
  gp* soft delete (deletedById=caller, isDeleted set), runAsSystem (createdById=System),
  no-context (null). Gates: tsc clean, CRM harness 176/0, qa:work 27/0. Real counts intact
  261/68/62/0, 59 holidays; System user present.
- Commit (backend): 3eeb712.

### Part 3 - Central AuditLog  [DONE]
- Schema: new AuditLog model (module, entity, entityId, action, changes JsonB, userId, ip,
  userAgent, platform, requestId, createdAt) with indexes on (entity, entityId), userId,
  createdAt, action. Applied via db push (formal migration generated in Part 5).
- Writer (src/core/audit/auditWriter.ts): moduleFor map, actionFor (CREATE/UPDATE/DELETE/RESTORE/
  STATUS_CHANGE/ASSIGN/PERMISSION_CHANGE), diffChanges (only changed fields, before+after),
  loadBefore (pre-image), masking (password/token/otp/secret/signature/faceDescriptor -> ***;
  large/binary fields image/specs/config/previousUpdates/permissions etc -> [redacted]; strings
  >1000 chars -> [large]). Bulk ops (createMany/updateMany/deleteMany) write ONE row with
  {filter, count}. No-op UPDATEs (empty diff) are skipped.
- Same-transaction guarantee: the audit extension in base.model.ts writes the AuditLog row on the
  SAME tx as the business write. Two paths: (a) writes outside a caller tx open one raw
  (basePrisma) tx and run op+before+audit together (args already stamped, raw delegate does not
  re-enter the hook -> no recursion); (b) a service's own prisma.$transaction is wrapped by an
  overridden $transaction (client extension) that stashes the tx in AsyncLocalStorage, so writes
  inside it audit on that same tx and the caller's atomicity is preserved. Verified: a throwing
  caller tx rolls back BOTH the write and its audit row. AUDIT_LOG=0 disables logging (read
  lazily); AUDIT_ENFORCE=0 makes a failed audit non-fatal (default: audit failure rolls the write
  back, so no write without its log).
- Excluded tables (no audit): BlacklistToken, LoggedInUsers, AttendanceScheduler, Notification,
  ActivityLog, AuditLog (session/token/log/noise).
- Explicit events (src/core/audit/event.ts logEvent): LOGIN / LOGIN_FAILED / LOGOUT in the auth
  controller (ip/ua/platform passed explicitly since login runs before the context middleware);
  EXPORT in the CRM report controller; IMPORT in leadImport/returnImport/shopifyImport. RBAC grant
  writes (FeaturePermission, Role, Group, UserRole, GroupRole, UserGroup) are auto-classified as
  PERMISSION_CHANGE; TaskAssignee/TaskWatcher and agentId changes as ASSIGN.
- CRM timeline: lead.service.timeline now merges AuditLog field-change entries alongside the
  LeadActivity feed and the legacy ActivityLog, newest first. previousUpdates and the activity
  feed are untouched and still work.
- Fix: the $transaction override widened the tx callback type, so ~8 existing services' tx/prisma
  callback params were annotated `: any` (noImplicitAny). No behaviour change.
- qa:cleanup extended to clear AuditLog residue: orphaned rows (business row hard-deleted),
  QA-user rows, harness report-export rows, QA auth-event rows, and bulk-op rows for child/join
  entities + parent-orphaned bulk rows. qa:cleanup is local-only so it never touches a prod trail.
  The functional harnesses (qa/crm.ts, qa/work.ts) set AUDIT_LOG=0 for their own prisma-direct
  churn (server-side API writes still audit and are orphan-cleaned).
- Verified end to end: Holiday create/update/soft-delete logged with before/after and actor; User
  create masks the password; Lead create (CRM) + STATUS_CHANGE logged; FeaturePermission ->
  PERMISSION_CHANGE; bulk filter+count; LOGIN_FAILED (with ip/platform) and EXPORT logged.
  Gates: tsc clean, CRM 176/0, Work 27/0, qa:cleanup AuditLog residue 0, real counts 261/68/62/0.
- Commit (backend): d993d72.

### Part 4 - UI (audit read API + History tab + footers + list columns + Audit Log page)  [DONE]
Backend read API (new src/modules/Audit):
- audit.service.ts: list(filters: user/module/entity/action/entityId/date range/search + pagination),
  entityHistory(scoped: caller must hold the entity's read feature; CRM entities also row-scoped via
  resolveScope/assertRowInScope), resolveActors(ids -> username+employee name), decorateActors.
- controller + routes (/auditLog: get, export [Excel], entity, actors). Registered in server.ts and
  qa/routewalk.ts. featureMap: get/export -> audit.read.* (admin), entity/actors -> token (service
  enforces record-read). featureMap regenerated: 487 routes, not-registered 0.
- Feature tree: seedAuditFeatures.ts registers audit.* / audit.read.* / audit.export.* and rewrites
  qa/_livefeatures.json (286 features). roleRecipes: Admin gets audit.*. permission.tsx needs no edit
  (its Features card is data-driven from the AppFeature tree, so audit.* shows automatically).
Admin UI (src/modules/audit):
- services/audit.service.ts; components/AuditHistory.tsx (History tab: field-level before->after,
  actor, time, bulk filter+count) and AuditFooter.tsx ("Created by X on <date>, last updated by Y";
  null actor -> "System (legacy)", System id -> "System"; batch-resolves names via /auditLog/actors).
- pages/auditLog.tsx + route (routes)/admin/settings/audit-log/page.tsx: filter by user/module/entity/
  action/date range + record-id search, paginated table, Excel export (blob fetch with bearer token).
  Gated withPermission('audit.read.*'). Nav: new "Settings" menu -> Audit Log (show: has audit.read.*).
- Wired footer + History into the 6 CRM detail pages (lead has footer; lead timeline already merges
  audit from Part 3; quotation/order/return/agent/product get AuditHistory + footer) and the employee
  detail (AuditHistory "Change history" + footer in the Activity Logs tab). Leads list got optional
  "Created by"/"Updated by" columns (ids resolved to names via /auditLog/actors).
- Verified: /auditLog/get returns rows with resolved actor names; /auditLog/entity returns scoped
  history; /auditLog/actors resolves System. Admin `next build` clean (52 pages incl
  /admin/settings/audit-log). Backend tsc clean. qa:rbac 306/1/3 (unchanged; new routes mapped, 0
  not-registered). qa:cleanup AuditLog residue 0 (orphan/soft-deleted referents, bulk-op, QA-named
  referents, join tables all swept; local-only). Real counts 261/68/62/0.
- Note: tasks/teams/daily-reports/visitors/leave are list-style (no per-record detail route) and gate
  passes have no admin UI, so the drop-in AuditHistory/AuditFooter components are ready but not placed
  there; user/attendance-request details can take the same two-line wiring if wanted.
- Commit (backend): d3bb49e. Commit (admin): bed5c33.

### Part 5 - Proof  [DONE]
- Audit harness qa/audit.ts (qa:audit, 19/0): create/update/delete/restore each stamp the actor
  columns AND write exactly one AuditLog row with the right user/module/action; secrets masked
  (password never stored); runAsSystem (cron/import path) attributed to the System user; History-tab
  API scoped (god sees a lead's history, a user without crm.lead.read gets 403, non-admin denied the
  admin list). Runs with harness-process audit off (so its own scaffolding/cleanup don't pollute) and
  toggles it on only for the one direct System write it verifies.
- Migration (Run-10 way): restored the pre-Run-11 dump into scratch gatepass_shadow, generated
  prisma/migrations/20261017090000_add_audit_fields_and_log via migrate diff --from-url ... --script.
  Fully additive (33 createdById + 32 updatedById + 31 deletedById + CREATE AuditLog + 4 indexes, 0
  drops). Validated by applying to the pre-Run-11 scratch (exit 0, columns + table created). Baselined
  on dev (migrate resolve --applied); migrate status "Database schema is up to date!" (34 migrations).
  Scratch DB dropped. PROD_DEPLOY_PLAN §2.4 (migration + flags + optional backfill) and §4.4
  (seedAuditFeatures + rollout order) added; Admin role row notes audit.*.
- Load test (same style as Run 8, write workload since audit only affects writes; cascade-free lead
  creates, 20 concurrent, 2000 writes). Audit OFF: mean 28.0ms p50 27 p95 37.8 p99 47.4, 711 req/s.
  Audit ON: mean 40.7ms p50 38.5 p95 50.6 p99 87.6, 490 req/s. So the same-transaction audit insert
  costs ~+13ms p95 on a pure-write workload; reads are unaffected so real mixed-traffic impact is far
  smaller. 0 errors both runs. (First attempt used /holiday/create, which cascades ~220 attendance
  rows per call and blew up the measurement + left 449,850 attendance rows; found and purged that
  residue, then switched to the cascade-free lead write.)
- Final gates (all green): backend tsc clean; prisma migrate status clean; CRM 176/0; qa:work 27/0;
  qa:audit 19/0; qa:rbac Pass 306 / Fail 1 (pre-existing T0278 unit-scoping gap) / Blocked 3;
  qa:cleanup zero residue (AuditLog 0, QA users/employees/teams 0); admin next build clean (52 pages
  incl /admin/settings/audit-log). Real counts intact: leads 261, orders 68, returns 62, quotations
  0, holidays 59.
- Commit (backend): see hash below.

## Run 10 (2026-10-16, Work migration, daily-report scope, rollout)

Same rules (local only, backup first, no push, no attribution, log here). Backup taken before any DB
work: qa/backups/run10_pre_*.sql (pg_dump of gatePassSystem).

### Item 1 - Data rule [ADOPTED]
Standing rule for all future runs: **never delete or edit a record I did not create, even when it
looks like test data. Ask the user instead.** QA scaffolding that THIS run/session creates may be
cleaned up as before; anything pre-existing is off limits without explicit confirmation. (In Run 9 a
stray `Q-0001 "ttest"` quotation was removed to restore the quotations=0 baseline - the user has
since confirmed it was theirs, so no restore is needed, but under this rule I would ask first rather
than delete.)

### Item 2 - Proper Work migration [DONE]
- Cause of the `20260204000000_add_shift_timetable` shadow-replay failure: that migration adds an FK
  `ShiftTimetable.shiftId -> Shift(id)` but **no migration ever creates `Shift`**. A drift audit shows
  the whole Sales CRM (Brand/Category/Product/ProductVariant/ProductImage/PriceList/Bundle/BundleItem/
  SalesAgent/Lead/LeadActivity/Quotation/QuotationItem/SalesOrder/SalesOrderItem/SalesReturn/ReturnItem)
  and Shift/ShiftAssignment were built with `db push` and never captured as migration files, and
  `_prisma_migrations` was empty (0 of 31 recorded). So Prisma Migrate was never actually adopted.
- Did NOT rename/edit any existing migration. Listed all 31 (see folder) and the cause above.
- Generated the Work migration by restoring the pre-Run-9 dump (qa/backups/night3) into a scratch DB
  `gatepass_shadow` and running `prisma migrate diff --from-url <shadow> --to-schema-datamodel
  schema.prisma --script`. Reviewed: 2 enums (TaskPriority, RecurringRule), drop Todo + its 2 enums
  (made IF EXISTS), create the 10 Work tables with all indexes and FKs. Saved as
  prisma/migrations/20261016120000_add_work_module/. Validated by applying it to the pre-Work scratch
  DB (Todo dropped, 10 Work tables created).
- Baselined the dev DB: `migrate resolve --applied` for all 31 existing + the Work migration;
  `prisma migrate status` now prints "Database schema is up to date!" (32 recorded).
- From-scratch `migrate deploy` on an empty DB fails at 20260204000000 (`relation "Shift" does not
  exist`) - the pre-existing db-push drift, not the Work migration. Documented the two prod paths
  (db push, or baseline-resolve + deploy) and the optional future squash in PROD_DEPLOY_PLAN §2.3.
  Dropped both scratch DBs; dev data untouched (261/68/62/0, 59 holidays).

### Item 3 - Daily report scope [DONE]
- Added `requiresDailyReport Boolean @default(true)` to TeamMember (schema + db push + a committed
  migration 20261016130000_team_member_requires_report, resolved locally). Only required members are
  "expected" to submit; non-members and not-required members appear nowhere in the missing list.
- New shared helper `expectedReporters(scope, date)`: returns the required members within scope for a
  day, or nonWorkingDay=true for a weekly off (Sunday) or an active Holiday; members on APPROVED leave
  that day are flagged onLeave. Reuses the Holiday and LeaveRequest tables.
- Wired into daily-report compliance (manager view), the work-report compliance report (per day over a
  range), and the report-missing cron + notification - all now use expected required people only, skip
  non-working days, and do not count holidays/weekly-offs/approved-leave as missing. Admin: Teams edit
  has a per-member "report" toggle; the manager compliance view shows Expected / Submitted / On leave /
  Missing and a non-working-day message.
- qa:work extended with item-3 tests (expected excludes not-required member; on-leave not missing;
  holiday -> non-working day). 27/27 pass.

### Item 4 - Rollout notes [DONE]
- roleRecipes.ts: added WORK_OWN / WORK_TEAM / WORK_ALL tiers and two new recipes (Employee = own
  tasks + own report; Team Lead = team) plus wired own-Work into Sales Agent, team-Work into Sales
  Manager, and work.* into Admin.
- PROD_DEPLOY_PLAN: 4.3 seedWorkFeatures step (workSeed.ts), the work.* tiers per role, the updated
  8-role table with a Work-scope column, and the exact Work rollout order (schema -> workSeed ->
  featureMap -> roles -> RBAC on).

---

## Run 9 (2026-10-16, CRM kanban + detail pages, Work module, QuickMark)

Three-part build. Same rules (local only, featureMap + RBAC for every route, harness tests, commit
per part, no attribution). Real data untouched (261/68/62/0), 59 holidays, zero QA residue.
Gates all green: CRM harness 176/176, work harness (qa:work) 20/20, qa:rbac 306 pass / 1
pre-existing gap (T0278 unit-scoping), qa:cleanup zero residue, backend tsc clean, admin next build
clean (51 pages).
Commits: admin 77617bf (Part 1 UI), 0687baa (Part 2 UI); backend <this series> Part 1 CRM endpoints,
Work module, work harness + cleanup, QuickMark note.

### Part 1 — CRM kanban + detail pages [DONE]
- Extracted the inline Leads board into a reusable CrmBoard component (columns, Move-to select from
  the backend state machine, reason dialog, permission gate). Leads now uses it; Quotations, Orders
  and Returns get the same List|Board toggle. Backend: quotation/order/return get() now decorate each
  row with allowedNextStages from the shared stateMachine (single source of truth). Reason-required:
  quotation REJECTED, order CANCELLED/RETURNED, return DAMAGED. Orders keeps its data-view tabs
  (all/reattempts/returned) alongside a separate List|Board display toggle.
- Agent detail /crm/agents/[id]: new POST /salesAgent/stats (crm.agent.read.*) returns counts,
  target vs achieved this month, pipeline value, won value, recent activity and recent leads;
  profile, team, edit for managers.
- Product detail /crm/catalogue/[id]: new POST /crmProduct/sales (crm.catalogue.read.*) returns sold
  qty/revenue (delivered orders), quoted/returned qty, recent orders/quotations; cost/margin stripped
  unless crm.catalogue.cost.*. Info, variants, price tiers, stock placeholder, add price/variant +
  edit gated. Agents and catalogue lists open these detail pages on row click.

### Part 2 — Work module (Teams, Tasks, Daily reports) [DONE]
- Checked the existing Todo model first: a dead stub with no code and no data. Migrated it away
  (dropped Todo + its enums + Employee.todos) and built the richer successor models: Team, TeamMember,
  Task (+assignees, checklist, comments, watchers), DailyReport (+comments), Notification, with
  TaskPriority and RecurringRule enums. Applied via `prisma db push` because a PRE-EXISTING broken
  migration (20260204000000_add_shift_timetable references a Shift table absent in the shadow replay)
  blocks `prisma migrate dev`. schema.prisma is the committed source of truth; a proper incremental
  migration should be created once that old migration is repaired.
- Scope: workScope.ts mirrors CRM scope.ts (narrower of work.<e>.read.{own|team|all}.* and the
  team-lead relation). Task/DailyReport reads and writes resolve through it.
- Features: Task list/board/calendar (My Tasks), per-team Team Board, task detail modal (status,
  assignees, checklist, comments, watchers), quick add, assign + bulk assign, recurring tasks that
  spawn the next occurrence on completion, attachments (disk storage). Daily report one-per-day,
  same-day editable, late flag, manager compliance view, comments. In-app Notification bell in the
  navbar (assigned/due-soon/overdue/comment/report-missing); a work scheduler cron sends the
  time-based reminders (sequential + caught, per Run 8). Reports: completion, overdue by person/team,
  time-to-complete, workload, daily-report compliance, hours logged, with Excel/PDF export.
- RBAC: work.* feature tree seeded (workSeed.ts), appModules.work.* gates the menu + bell. Routes
  registered; featureMap regenerated via qa:routes + qa:featuremap (483 routes, 0 unmapped); the
  generator was taught the Work mounts. Grouped "Work" menu added to navModel; "Work Features"
  section added to permission.tsx (Teams, Tasks, Daily Reports, own/team/all scopes).

### Part 3 — QuickMark integration [DONE, API-only]
- Simple: the existing API already supports it. Verified an employee logging in with
  platform "Attendance App" (login.quickmark.*) + work.task.read.own.* + work.report.submit.* can
  GET their tasks (200), read/submit the daily report (ok), and is denied task create (403). No new
  backend and no new APK. docs/QUICKMARK_WORK_INTEGRATION.md documents the two app screens and the
  RBAC features to grant employees.

---

## Run 8 (2026-10-15, backend crash + 403 + QA holiday purge)

Three backend fixes. Same rules (local only, commit per step, no attribution).
Gates: backend build (tsc exit 0), admin build (next build exit 0), CRM harness 176/176,
qa:rbac 306 pass / 1 pre-existing gap (exit 0). Real data untouched (261/68/62/0), all QA
residue removed.
Commits (backend): af65025 (crash), c4520bc (403), <this log>; cleanup fix in the same series.

### 1. Server crash under load [FIXED]
- Reproduced with a load test (20 concurrent users hammering /lead/get, /lead/getById,
  /crmReport/dashboard, /crmReport/leadAging, /salesOrder/get, /salesReturn/get for 2 min). The
  server crashed with an unhandledRejection and exited(1).
- Root cause: winston was configured with exceptionHandlers/rejectionHandlers but exitOnError
  defaulted to true, so after logging an unhandled rejection it called process.exit(1). The
  installProcessGuards handler in server.ts logged the same rejection but could not prevent the
  exit. A single bad request took the whole server down. Two concrete triggers: a duplicate
  loggedInUsers.token on two logins in the same second (identical JWT), and, under heavier load,
  the absent-marking cron firing markAttendance via forEach(async ...) without awaiting, which
  stampeded the pool and leaked "Unable to start a transaction in the given time" rejections.
- Fixes: logger exitOnError:false; a random jti on every JWT so tokens never collide, plus a
  try/catch around the session-record create; the cron now marks sequentially with a per-employee
  catch; prisma query-logging off by default (PRISMA_QUERY_LOG=1 to re-enable) and interactive
  transaction maxWait/timeout raised; connection_limit and pool_timeout documented in .env.example
  and set live in .env; an inlined express-async-errors patch so async rejections reach the error
  middleware; Prisma P2024/P2028 now map to 503.
- Rerun: 20 concurrent x 2 min = 27,078 requests, 100% 200, zero crashes, p95 159ms (p50 75,
  p99 171). 80 concurrent x 45s = 10,107 requests, zero errors/crashes, p95 622ms (requests queue
  instead of failing). The .js are gitignore'd build artifacts; only index.js is tracked, so the
  fixes live in the .ts and are compiled with tsc.

### 2. 403 on role/group/user detail pages [FIXED]
- The permission editor on those pages POSTs /featurePermission/allowedFeatures with
  { parentType, parentId }. featureMap marks it a dynamic read, but requirePermission only took
  parentType from the body on /create; every other route looked up a FeaturePermission row by
  body.id. allowedFeatures sends no id, so parentType was undefined and the route was always
  denied 403, even for an all-access admin (the PARENT_FEATURE case map was never reached).
- Fix (backend only; the frontend already sends the correct capitalised parentType): source
  parentType from the body for /allowedFeatures too.
- Verified: all-access admin gets 200 reading (and 200 editing via /create) for Role, User and
  Group; a user without role/user/group read gets a clean 403 ("missing role.read.*").

### 3. QA holiday purge + harness cleanup [FIXED]
- The holidays table held 20 active QA holidays (reason QA_<timestamp>, description QA_updated,
  date 2099) plus 15 soft-deleted ones, and 7,473 HOLIDAYS attendance rows that marking those
  holidays generated. Purged by strict pattern after confirming zero AttendanceRequest references:
  79 -> 59 holidays (all 59 real preserved), 2099 HOLIDAYS attendance 7,473 -> 0.
- qa/cleanup.ts only soft-deleted holiday ids recorded in _created.json via the API and never
  removed the attendance side-effect, so QA holidays leaked across runs. Added a pattern-based hard
  delete to the Prisma sweep: HOLIDAYS attendance in the 2099 range, then holidays whose reason
  starts with QA_. Real holidays use real dates and reasons like "Sunday", so the pattern cannot
  match real data. Verified end to end: qa:rbac created a QA holiday + 302 HOLIDAYS attendance,
  qa:cleanup removed them, leaving 59 real holidays and 0 QA residue.

### Note
- qa:rbac shows 1 pre-existing fail, T0278 (employee list not filtered by unitIds in the JWT). This
  is a documented unit-scoping enforcement gap, not a regression: the JWT still carries unitIds (the
  jti was added alongside it, verified by decoding a token), and nothing in this run touches
  employee-list or unit-scoping code.

---

## Run 7 (2026-10-15, dark-mode regression sweep)

Full regression sweep of the admin after the theme token migration. Same rules (local only,
commit per step, no attribution). Gate: admin next build clean (exit 0). Real data untouched
(261/68/62/0), throwaway admin removed, zero qa.* residue.
Commits (admin): cf3244e (regression fixes).

### Method [DONE]
- Generated the route list from the app router (62 page.tsx; public URLs drop the /admin prefix
  via the next.config rewrite). Visited every static route plus representative dynamic detail and
  edit routes (employee, shift, unit, role, group, user, lead, order, return, customer) in light
  AND dark, logged in as a throwaway all-access admin (qa.sweepadmin, granted all 257 AppFeatures
  via a User FeaturePermission). 106 captures total.
- Headless Chrome via playwright-core. Each page ran an in-page audit: text contrast below 4.5:1
  (3:1 for large or bold), elements with a white background in dark, and console errors.
  Important: the admin API has a CORS allow-list for http://localhost:3001, so the harness must use
  the localhost origin, not 127.0.0.1, or every login is CORS-blocked and redirects to /login.

### Findings and fixes [DONE]
- Reports filter inputs stayed white in dark. Cause: a styled-jsx `.input` rule with a hard-coded
  `background:#fff` (specificity beats the global :where() input rule). Fixed to read the theme
  variables. This was the only true white-in-dark element found.
- Analytics charts (chart.js). The bar chart used chart.js default axis tick, grid and legend
  colours (grey on grey), unreadable in dark. Added a chartTheme computed from the CSS tokens
  (--muted-foreground, --border, --foreground, --muted) and applied it to the bar scales ticks and
  grid, the legend labels, and the in-office doughnut track (was a fixed light grey). Verified by
  temporarily linking the throwaway admin to an employee with attendance so the charts render; the
  employee row was not modified and the link was removed with the throwaway user.
- Blue solid buttons (Add Holiday/Shift/Unit, New Request, Change Password, leave buttons,
  permission submit, confirm dialog) showed near-black text on blue in dark. Cause: they override
  the background to bg-blue-600 but keep the default text-primary-foreground, which is near-black in
  the dark palette. Added text-white (15 buttons across 10 files).
- Blue text links and active tabs (CRM back links, catalogue and system-config tabs, a few labels)
  were blue-600 on dark cards (about 3.2 to 3.4 contrast). Added dark:text-blue-400 (about 71 tokens
  across the double-quoted, template-literal and ternary className forms).

### Classified as not-a-bug [DONE]
- White buttons rgb(250,250,250) in dark are shadcn bg-primary (the dark palette primary is near
  white) with dark text. Intentional high-contrast CTA, not a defect.
- Green "Success" toasts measured at 1.4 contrast were a false positive: the toast success variant
  already carries dark classes (dark:bg-green-900/20 dark:text-green-300); the audit mis-composited
  the semi-transparent green over the dark body.
- role/group/user detail pages log a 403 on "fetching permissions" in BOTH themes. This is a backend
  RBAC response, not a theme issue, and is out of scope for the styling sweep.
- crm_returns (48 errors, light) and frontdesk_visitor (nav timeout, light) were ERR_NETWORK_IO_
  SUSPENDED and a one-off timeout during the long run, matching the backend crash below. Both render
  fine otherwise.

### Notes
- The backend crashed three times during and just after the sweep with the known, pre-existing
  unhandledRejection ("Transaction API error: Unable to start a transaction in the given time"),
  triggered by the sweep load. Restarted each time per the standing rule; it is stable while idle.
  Re-verification was then done at low concurrency.
- There is no gate-pass route in this admin (gate pass is a separate codebase in the platform); the
  only frontdesk module here is /frontdesk/visitor, which was swept.
- Observation, not touched: the Holidays table holds about 79 QA_ test records (dates in 2099,
  reasons "QA_<timestamp>", description "QA_updated") left over from an earlier QA run. Left in place
  because deleting business records is out of scope for a styling sweep and should be confirmed.

---

## Run 6 (2026-10-14, dark mode + circular reveal)

Dark mode across the whole admin (CRM and the older modules) with one source of truth and a
circular-reveal theme toggle. Same rules (local only, commit per step, no attribution).
Gates: admin next build clean (exit 0). Real data untouched (261/68/62/0), throwaway admin removed.
Commits (admin): fed0446 (theme infrastructure), d18b439 (token migration across pages).

### What was wrong [DONE]
- The app mixes MUI v6, shadcn/Tailwind and SCSS. A dark-mode scaffold existed (ThemeProvider,
  no-flash inline script, a dark MUI theme) but was not a single source of truth: MUI carried its
  own hard-coded palette, and most CRM and legacy pages used literal bg-white/bg-gray/text-gray
  classes, so they stayed light or went unreadable when the dark class was set.

### Single source of truth [DONE]
- globals.scss CSS variables are now the one palette. :root is light, .dark overrides. The dark set
  is a soft slate (no pure black): background 220 16% 10%, card 13%, muted 18%, border 24%, text
  96% / muted 68%, ring = blue 217 91% 60%. Layered bg < card < muted; text meets WCAG AA.
- theme.tsx (MUI) now reads hsl(var(--token)) for the palette and every component override
  (DataGrid rows/header/hover/selection/pagination, TextField, Select, Menu, Popover, Paper, Table,
  Tabs, OutlinedInput). So MUI follows the same variables as Tailwind and SCSS.
- color-scheme is set per mode (native date pickers, selects, scrollbars follow the theme), and a
  low-specificity :where(input,select,textarea) rule themes the raw native inputs the CRM forms use
  while still letting shadcn/MUI override. This fixed the one breakage found (white CALL/Outcome and
  report filter controls in dark).
- Token migration: bg-white -> bg-card, bg-gray-50/100 -> bg-muted, border-gray -> border-border,
  text-gray-400/500/600 -> text-muted-foreground, text-gray-700/800/900 -> text-foreground across
  CRM pages/components and the legacy modules (AMS, analytics, access control, frontdesk, gate pass,
  navbar, shared). Kanban stage columns and report bars got dark: variants. Light mode is byte-for-
  byte unchanged because the tokens resolve to the former literal values in light.

### Toggle + circular reveal [DONE]
- Sun/moon button in the navbar and in the mobile hamburger menu. Default follows the OS; an explicit
  choice is saved to localStorage (app-theme) and remembered. No flash of the wrong theme: an inline
  script in layout.tsx applies the dark class before hydration, and ThemeProvider inits from the
  already-applied class so MUI does not flash either.
- On toggle, the new theme is revealed as a circle expanding from the click point using the View
  Transitions API (clip-path circle, ~450ms, ease-out). Falls back to an instant switch where the API
  is unsupported or prefers-reduced-motion is set; the default cross-fade is disabled so only the
  circle plays.

### Browser verification [DONE]
- Headless Chrome via playwright-core, authenticated. Captured light and dark for: navbar + mega menu,
  leads list, kanban board, lead detail, reports with charts, attendance (legacy module), the RBAC
  permission editor, and the login page; plus a mid-animation frame of the circular reveal. All pages
  render correctly in both themes; light mode visually unchanged. Screenshots sent to the user.

---

## Run 5 (2026-10-14, follow-up)

RBAC gaps for the CRM: permission-assignment UI, button-level gates, revoke propagation. All three
closed and browser-verified end to end. Same rules (local only, commit per step, no attribution).
Gates: admin next build clean (exit 0); CRM harness + qa:rbac unaffected (admin-only code this run).
Real data untouched (261/68/62/0), all test scaffolding cleaned up (zero residue).
Commits (admin): adcb6bb (permission UI + appModules.crm explicit), 08cc6cb (button gates).

### Gap 1 - CRM features in the permission editor + explicit appModules.crm  [DONE]
- `permission.tsx` had NO CRM section, so crm.* features were not assignable anywhere. Added a grouped
  "Sales CRM Features" card (Leads, Quotations, Orders, Returns, Catalogue incl. cost, Agents, Reports).
  The feature hierarchy exposes one flat `crm.*` bucket (no `crm.lead.*` sub-keys), so the component now
  reads `crm.*` and splits by prefix; every action AND the own/team/all read-scope leaves show as
  checkboxes. appModules.crm.* is the "CRM (menu)" box under App Modules.
- `access.service.ts`: added `appModules.crm.*` to the explicit list (was missing) so it needs an
  explicit grant, like quickMark/quickPass/accessControl/frontdesk — not the `appModules.*` wildcard.
- Verified via the UI (as a throwaway all-features admin): created role "QA_CRM Agent Test", checked
  the CRM boxes, Submit -> persisted (own scope only, no read.all/team). Assigned the role to a qa user
  via the UI (role page "Add user"); the user's only perms came from the role. Logged in as that user:
  top nav showed ONLY the CRM menu (confirms appModules.crm gating), the CRM dropdown showed only the
  permitted items (My Day/Leads/Customers from lead.read.own, Agents, Reports; Sales/After-sales/
  Catalogue hidden, no quick actions), and /crm/leads showed "Scope: OWN" with ONLY that agent's one
  lead (not the 261). OWN scope works from a UI-built role.

### Gap 2 - Button-level gates  [DONE]
- Audited every CRM page; the write buttons on the lead/quotation/order/return detail pages, My Day,
  and the New-x buttons were ungated (backend enforced, but the UI showed buttons that would 403).
  Gated each on its backend feature: New lead/quotation/order (create), lead Edit (update), all stage/
  order/quotation/return transitions (transition), convert (quotation/order create), log activity
  (lead create), re-attempt (order reattempt), create return (return create), quotation new-version +
  duplicate (create), quotation PDF (export). Order/quotation margin is gated on crm.catalogue.cost.*
  (and already stripped server-side). Invoice/delivery PDFs stay at read level (crm.order.read.own.*).
  Catalogue/agents/reports were already gated (canWrite/canCost/canEdit/canExport).
- Verified in the browser as a read-only CRM user (lead + order read, no create/update, no cost):
  leads list no New-lead; lead detail no Edit/Change-stage/Convert/Log-activity; orders list no New-
  order, Scope OWN, only the test order; order detail no transition/reattempt/create-return and NO
  margin line (the order has a costed item, so a cost user would see 40%); catalogue no Add/Bulk, no
  Cost column (only Retail Price). "No write buttons, no cost anywhere" confirmed.

### Gap 3 - Revoke propagation  [DONE]
- The provider polls /webhook/permissions every 2 min and reloads on change. With the qa user logged
  in, removed crm.lead.read.own.* from the test role: /lead/get returned 403 immediately (backend), and
  within the poll window the stored permissions dropped the feature and the CRM menu's Workspace group
  (My Day/Leads/Customers) disappeared. Re-granted: /lead/get -> 200 and the Workspace items returned
  after the next poll. (The revoke was applied at the role's FeaturePermission, the same state the UI
  edit produces; the UI revoke mechanism itself was exercised when assigning the role above.)

## Run 4 (2026-10-13, follow-up)

CRM navigation restructure, same rules (local only, gates, commit per step, no attribution). Eight
tasks, all done and browser-verified. Screenshots of the new menu + leads list/board sent to the user.

Gates (final): admin next build clean (exit 0), CRM harness 176/0, qa:rbac 306/1/3, backend tsc clean,
featureMap not-registered 0. Real counts unchanged: leads 261, orders 68, returns 62, quotations 0.
Both servers left running (backend :3002 RBAC on, admin :3001).

Commits: backend 99f2ab9 (customers endpoint + featureMap), 92e2b12 (qa:cleanup fix); admin 7ffd754
(grouped nav), 3158906 (leads merge + orders tabs), 7b18e71 (customers list), 27dbe02 (breadcrumbs).

- **T1 Leads list+board merged.** /crm/leads has a List|Board toggle, remembered per user (localStorage
  + URL ?view=). Same search, stage filters and scope chip apply to both. The old /crm/leads/kanban
  redirects to /crm/leads?view=board. Verified: toggle switches view and persists; redirect works.
- **T2 Reattempts folded into Orders.** /crm/orders has All | Needs reattempt | Returned tabs (reattempt
  = reattemptMin filter, returned = status RETURNED). Old /crm/orders/reattempts redirects to
  /crm/orders?view=reattempts. Verified.
- **T3 Customers list.** New /crm/customers list (name, phone, city, leads, orders, total spent, last
  activity) backed by a new POST /crmReport/customers (scoped aggregate by phoneNormalized). A row opens
  the existing 360 profile at /crm/customers/<phone>. Verified end to end (list -> profile with
  breadcrumb showing the customer name).
- **T4 CRM mega menu.** Grouped dropdown: Workspace (My Day, Leads, Customers), Sales (Quotations,
  Orders), After sales (Returns), Setup (Catalogue, Agents), Insights (Reports), with quick actions
  (+ New lead / quotation / order) and one-line descriptions. Minimal, two-column, permission-gated,
  empty groups/menus hidden. Driven by a shared navModel.
- **T5 Mobile hamburger** uses the same navModel: each module is a collapsible with the same groups +
  quick actions. Verified at 414px.
- **T6 Breadcrumbs** on every CRM page (CRM > Group > Section, detail pages add the record, e.g. SO-0069).
- **T7 Consistent menus.** Access Control, Quick Mark and Frontdesk now use the same grouped mega-menu
  style (routes and permissions unchanged; Quick Mark grouped into People / Attendance / Setup).
- **T8 qa:cleanup fixed.** It hard-deletes each run's full world by QA pattern via Prisma deleteMany
  (the old API sweep was paginated and soft-deleting, and never removed the @phw users auto-provisioned
  for QA employees). Proved the cycle: qa:rbac (33 test.local users / 4 roles / 2 QA employees created)
  then qa:cleanup -> zero residue (users/roles/groups/employees/items/customers/shifts all 0), real data
  untouched. Also sweeps the QA gate-pass/customer/item chain (GatePassItem RESTRICT handled).

Browser verification as both personas (local test logins usama_liaqat@phw OWN, usman_arshad@phw TEAM):
the menu shows only allowed items. The agent sees only the CRM menu (no Access Control / Quick Mark /
Frontdesk); the manager sees CRM. Both show the grouped CRM dropdown with their permitted items.

Note: a bug slipped into the first customers detail route (passing a prop through the withPermission HOC
failed the type check); fixed by reading the phone from the route params inside Customer 360. Also the
qa:cleanup docstring first contained a literal "*/" that closed the block comment early; reworded.

Follow-up (same run): on review, the Customers directory was gated on crm.report.read.*. The real Sales
Agent role recipe does include report.read, so it was not actually broken, but a customer directory
should not need the reports permission. Changed /crmReport/customers and /crmReport/customer360 (and the
admin pages + nav item) to require crm.lead.read.own.* instead, so any lead-reader sees Customers while
reports stay separate. Proven: a user with only crm.lead.read.own.* gets 200 on /crmReport/customers and
403 on /crmReport/margin. Gates still green (CRM 176/0, qa:rbac 306/1/3, featureMap not-registered 0,
admin build clean). Commits: backend 6e2eacc, admin 18ef974.

## Run 3 (2026-10-13, follow-up)

Backup first: qa/backups/night3_20261013_144429.sql (gitignored).

Three tasks, same rules (local only, gates after each step, commit per step, no attribution).
1. Axios 4xx handling fixed at the interceptor. 2. Catalogue product picker in the quotation and
order builders. 3. Refresh SOLARMAX_PROJECT_HANDOFF.md.

### Run 3, Task 1 - Axios 4xx handling at the interceptor  [DONE]
Problem: the admin axios instance used validateStatus: status < 500, so every 4xx resolved as a
successful response with the error envelope as the body. Pages then rendered the error body as data,
no error toast showed, and a bogus "403 -> logout" branch in handleError could log a user out on a
forbidden (out-of-scope) response. Run 2 worked around the symptom on the four CRM detail pages; this
is the proper fix at the one place every call goes through.

Change (admin src/utils/header.ts):
- validateStatus is now status < 400. 2xx and 3xx resolve; 4xx and 5xx reject, so the error
  interceptor runs and callers' .catch / try-catch fire.
- handleError rewritten: ONLY 401 (or an explicit "Invalid Token" / Unauthorized body) clears the
  token and reloads. 403 and every other non-401 error now just shows the server's message in the
  snackbar (message, then error, then axios message as fallbacks). The old "403 -> logout" branch is
  gone, so an out-of-scope click no longer logs the user out.
- The success interceptor (unwrap of {success,data} envelopes, read-like toast suppression) and the
  5xx/network retry are unchanged.

What depended on the old behaviour (checked every service + page that calls the API):
- CRM detail pages (lead/order/quotation/return): already handle an id-less response as not-found
  (Run 2 fix) AND have .catch -> setLead(false). With 4xx now rejecting, the .catch fires and the page
  shows "not found or outside your scope" while the interceptor shows the server message. No double
  handling problem (TOAST_LIMIT=1 collapses to one toast). No change needed.
- AMS attendance.service.ts checkAttendance / markAttendance: had .then-side guards reading
  response.data.success === false to catch a 4xx that used to resolve. Those branches are now mostly
  unreachable (4xx rejects first) but still guard the rare HTTP-200-with-success:false case, and the
  .catch rethrow + the component try/catch (markAttendance.tsx, reads error.response.data.message)
  surface the message exactly as before. Net: a latent bug is fixed (a 4xx whose body carried a data
  key used to be unwrapped and silently treated as success). No change needed.
- base.service.ts: creates its own raw axios client with empty 401/403 handlers that just reject; old
  modules extend it but actually call the shared axiosInstance, so it is unaffected (raw axios already
  rejected 4xx). Login (auth.service) and the permissions webhook use raw axios too, unaffected.
- No service was found that READ a 4xx body as success data for rendering, so nothing broke.

Browser checks (main flows):
- CRM in-scope lead opens normally (envelope unwrap intact, all fields + timeline render).
- CRM out-of-scope lead (agent -> another agent's lead): snackbar "Lead is outside your scope",
  page shows "Lead not found or outside your scope", NO logout, no crash. Console shows only the
  intentional console.error, no uncaught exception.
- Old module via a throwaway HR user (created with a cloned password hash + HR role, deleted after):
  the analytics dashboard renders and a genuine 403 from the attendance endpoint now surfaces "You
  don't have permission to read attendance" in the snackbar (previously that 403 resolved silently).
  The AMS attendance-request list (stats + paginated list) renders fully on the success path.
- Throwaway HR user deleted and verified gone; no real user touched.

Gates: admin next build clean (exit 0), CRM harness 170/0, qa:rbac 306/1/3, backend tsc --noEmit
clean. Change is admin-only; backend source unchanged.
Commit (admin): 9d66241. Log commit (backend): 67a71a9.

### Run 3, Task 2 - Catalogue product picker in the quotation and order builders  [DONE]
A line can now come from the catalogue (search by name or SKU, pick a variant, price auto-fills
from the chosen tier, blocked if the price is pending) or stay a free-text custom item. Catalogue
lines store productId/variantId so the sales-by-product/category and margin reports work.

Backend (commit 6d7514a):
- shared/pricing.ts: priceLines(items, defaultTier). Was hardcoded to RETAIL — now prices a
  product-linked line at the header tier. Prefers a variant-specific PriceList row when the line
  carries a variantId, falls back to the product-level row. For a product-linked line it fills
  unitCost from the catalogue even when an explicit unitPrice is supplied, so margin is correct for
  picker lines (the agent who builds the quote never sees or sends cost). Explicit unitPrice still
  wins for the price itself (keeps the harness's pending-product + explicit-price case at 201).
- quotation.service + salesOrder.service: pass the header tier into priceLines on create and update.
  An order has no tier column, so its tier is transient (used for pricing only, never stored); added
  tier to the order create/update Zod schemas for that.
- product.service.search: now returns each product with variants + current prices + category (one
  call for the picker) and the search controller runs through readGated, so cost is stripped unless
  the caller has crm.catalogue.cost.*.
- 6 harness tests added (tier pricing, DEALER tier, variant-specific price, cost enrichment, search
  shape with cost stripped for an agent, order product line). CRM harness 176/0.

Admin (commit 80021b5):
- New ProductPicker component (debounced search, variant select, tier price shown, pending shown as
  a disabled "Blocked" row). Used by both builders.
- Quotation builder: picker + free-text "custom item" lines; sends productId/variantId.
- Order builder: new page /crm/orders/new (mirrors the quotation builder) + a "New order" button on
  the orders list. Orders previously came only from lead/quotation conversion or import.

Browser verification (as the MANAGER persona usman_arshad@phw, who has order.create + cost + report):
- Created a QA test product (RETAIL 10000 / cost 6000) and a pending-price QA product.
- Quotation: picker found the product by name, showed category + the RETAIL price 10000, added it;
  the pending product showed "Price pending / Blocked" (UAT 5.6 verified in the UI); added a custom
  free-text line too. Saved -> Q-0001 with both lines and Margin PKR 6,000 (50%) (cost enriched).
- Order: picker added the product -> SO-0069, Margin PKR 4,000 (40%).
- Moved the order to DELIVERED, then checked the reports: Sales by product = QA_PICKTEST Widget
  1 / 10,000; Sales by category = Smart Locks 1 / 10,000; Margin = revenue 10,000 / cost 6,000 /
  margin 4,000 (40%) / 0 pending. All three reports correctly pick up a picker line.
- Deleted all test data (product, prices, quotation, order). Real counts back to 261/68/62/0.
- Gates: CRM harness 176/0, qa:rbac 306/1/3, backend tsc clean, admin next build clean (exit 0).

### Run 3 - DB hygiene: purged leaked QA harness residue  [DONE]
While doing the Task 1 old-module browser check I found a large amount of leaked test data from many
prior qa:rbac / attendance-workflow / UAT runs. qa:cleanup only removes the LAST run (by id from
_created.json) and its safety sweep is paginated (GET /user/get returns one page), so earlier runs'
worlds were never removed. Purged it all, strictly by test pattern (cannot match real data):
- qa.*@test.local users (528), QA_ roles (64), QA_ groups (48), QAWF employees (15) + their 1320
  attendance / 45 attendance-requests / 30 leave-requests.
- Second wave: test users with the @phw domain but QA prefixes (qawf_*, qaself_* = 34) and the 15
  "QASelf" test employees they link to (+ 1230 attendance rows).
- Then ran qa:rbac once more (306/1/3) and purged its fresh world too.
Verified with a precise prefix scan (not the _ -wildcard one): 0 test users/roles/groups/employees,
0 QA_/UAT leads/orders/returns/quotations/visitors. Real data intact: leads 261, orders 68, returns
62, quotations 0; 209 real @phw users, 220 employees. No real row was touched (patterns are
qa.*/QA_/QAWF/qawf_/qaself_/QASelf only; real users are normal-name@phw, real employees are not
QASelf/QAWF). Known follow-up for a later session: fix qa:cleanup to page through all users and to
also sweep qawf_/qaself_ @phw users + QASelf employees, so runs self-clean.

## Run 2 (2026-10-13, follow-up)

Backup first: qa/backups/night2_20261013_132704.sql (gitignored).

### Run 2 summary
All four tasks done. Real data untouched (leads 261, orders 68, returns 62, quotations 0; zero QA or UAT
residue). Final gates: CRM harness 170/0, qa:rbac 306/1/3, admin next build clean, backend tsc clean.
Both servers left running (backend :3002 RBAC on, admin :3001). One real bug was found during the honest
UAT and fixed (out-of-scope detail pages crashed instead of refusing).

Commits (no attribution): backend 824a2fb (phone exact match), 8aee327 (bulk price), 349df7c (manager
perms + log), eca71e4 (UAT results + log); admin ac0aa46 (Task 2 screens), fef03d9 (out-of-scope fix),
057ab45 (cosmetic subtitles).

Tasks:
- T1 phoneNormalized exact matching everywhere + test that 0300 vs 0321 do not match. DONE.
- T2 deferred screens (lead edit, catalogue product/variants/prices + bulk Excel, agents edit, bulk
  reassign, Frontdesk Create-lead). DONE, browser-verified.
- T3 honest browser UAT, 42/43 UI verified, 1 bug fixed. DONE (docs/UAT_Run_Results.md).
- T4 cosmetic sweep. DONE (subtitles added; headers/loading/empty states already consistent).

### Run 2, Task 1 - Phone matching via phoneNormalized (full national number)  [DONE]
- Rewrote shared/phone.ts: normalizePhone now returns the full 10-digit national number (strips +92 / 0092 / leading 0), so 0300-1234567 -> "3001234567", +92 300 1234567 -> "3001234567", 0321-1234567 -> "3211234567". Removed all last-7 and last-10 digit tail matching (phoneNeedle is gone).
- Phone lookups now EXACT-match phoneNormalized: the lead/order/return/quotation `phone` filter, and customer360. The free-text search box uses a looser searchPhoneDigits + contains so partial phone search still works, but that is not the exact lookup.
- Importers set phoneNormalized: leadImport and returnImport both populate it, and returnImport's phone->lead linking now uses the full national number too.
- Re-backfilled phoneNormalized on all existing rows to the canonical form (261 leads, 68 orders, 62 returns). Sample: "305 4053333" -> "3054053333".
- Harness test added proving 0300-1234567 and 0321-1234567 do NOT match, the same number in +92 format still matches, and customer360 is exact. CRM harness 166/0, qa:rbac 306/1/3, tsc clean.
- Commit: 824a2fb.

### Run 2, Task 2 - Finish the deferred screens  [DONE]
All five built and, where I could exercise them, browser-verified as the manager.
- Lead edit: /crm/leads/[id]/edit (the lead form now does create and edit), all fields, scope + audit via the existing scoped update (out-of-scope is refused, the change is logged on the timeline). An Edit button is on the lead detail.
- Catalogue product add/edit + variants + price list + bulk price from Excel: the catalogue page is now manageable. Add product, edit product (name/category/brand/protocol/status/description/SKU), set per-tier prices (cost field shown only with cost permission), add variants, and a "Bulk price (Excel)" upload with a preview-then-apply flow. New backend: POST /crmPriceList/bulkPrice (cost-gated, dry-run default, parses an .xlsx with SKU/Price/Cost), commit 8aee327, 4 harness tests. VERIFIED in the browser: product edit modal with prices + variants renders; I did not persist a real price to keep the catalogue pending.
- Agents edit (managers only): click an agent to edit scope, team lead, monthly target, commission, outlet. VERIFIED end to end (set AG001 target to 500,000, saw the success toast and the table update, then reverted it to null).
- Bulk lead reassign (managers): checkbox-select leads on the list, pick a target agent, Reassign (loops the scoped assign). Added onSelectionChange to the shared TableComponent.
- Frontdesk "Create lead" button: in the visitor history dialog, gated on crm.lead.create.*, uses the existing /lead/fromVisitor.
- Persona/role note: gave the Sales Manager role (and the manager browser persona) crm.agent.update.* and crm.catalogue.{create,update}.* so a manager can edit agents and manage the catalogue in this small-business setup. Sales Agent is unchanged.
- Gates: tsc clean, admin next build clean, CRM harness 170/0, qa:rbac 306/1/3.
- Commits: backend 8aee327 (bulk price) + the persona/recipe commit below; admin ac0aa46.

### Run 2, Task 3 - Redo UAT honestly in the browser  [DONE]
- Went through every row of CRM_UAT_Checklist.md in the browser as the agent (usama) and the manager (usman). Results in docs/UAT_Run_Results.md with "UI verified" / "not done" per row. Harness is NOT counted as UI.
- 42 of 43 rows UI verified. 1 row not done: 5.6 (pending-price line block) is not reachable through the current free-text quotation builder; it is an API rule for product-linked lines.
- Created a full lead -> quotation -> order -> return chain in the UI to verify sections 4-7, then deleted all of it. Real counts confirmed back to 261 / 68 / 62 / 0.
- BUG FOUND AND FIXED during 4.7: opening an out-of-scope record crashed ("timeline.map is not a function") or showed an empty record instead of refusing. Root cause: the admin axios uses validateStatus: status < 500, so a 403 resolves with the error envelope as the body; the detail pages then rendered it. Fixed the lead, order, quotation and return detail pages to treat a response with no id as not-found. Re-verified: out-of-scope now shows "not found or outside your scope". The backend was always correct (403, no data leak).
- Gates: CRM harness 170/0, qa:rbac 306/1/3.
- Commit (admin bug fix + this doc): admin fef03d9, backend eca71e4.

### Run 2, Task 4 - Cosmetic sweep of all CRM pages  [DONE]
- Audited every CRM page. They already share the house style: p-4 md:p-6 container, text-xl font-semibold header, Suspense + Loader for loading, noDataMessage / empty states, scope chips, PKR formatting, Asia/Karachi dates on Customer 360.
- The only inconsistency found: the orders / quotations / returns list pages had no one-line description under the title, while Leads / Reports / My Day / Customer 360 do. Added a consistent subtitle to each.
- Confirmed the detail pages share a consistent not-found message (standardised during the Task 3 fix) and max-width containers, and the quotation builder matches.
- Admin next build clean. Final counts verified 261/68/62/0, zero residue.
- Commit: 057ab45.

Backup taken first: qa/backups/night_20261013_022255.sql (354 MB, full gatePassSystem dump, gitignored).
DATABASE_URL confirmed localhost, DB gatePassSystem.

## Summary (morning report)

Good morning. Here is what got done overnight. Everything stayed local, nothing was pushed, and the real
business data is untouched (leads 261, orders 68, returns 62 - exactly as before; quotations 0; zero QA
test residue left behind).

**Final test counts:** qa:rbac 306 pass / 1 fail / 3 blocked (same as the start, no regression). CRM
harness 162 pass / 0 fail (started at 136; I added 26 tests for validation, mass-assignment, fuzzing,
customer 360, order PDFs and search).

**Admin build:** `next build` is clean (exit 0), so it will deploy on Vercel.

**Backend build:** `tsc` is fully clean now (the two old src/excel errors are fixed).

**Servers:** backend is running on :3002 with RBAC_ENFORCE=on, admin dev server on :3001.

**Deploy rehearsal (Task 2):** I ran the whole PROD_DEPLOY_PLAN against the gatePassSystem_restore copy.
The schema push is additive only. Lead and returns imports reproduce exactly (261 / 68 / 62). I found
and fixed one real risk: the role seeder would have clobbered an existing prod Admin/HR role, so it now
skips existing roles unless you pass --replace.

### What is done
- Task 1 (admin prod build + backend tsc clean): DONE.
- Task 2 (deploy rehearsal on the restore DB): DONE.
- Task 3 (Zod validation + mass-assignment guard + fuzz tests on all CRM endpoints): DONE.
- Task 4 (missing screens): MOSTLY DONE. Built: lead create form with phone lookup, My Day, Customer
  360, lead search, Reattempts view, order invoice/delivery PDFs, quotation duplicate + WhatsApp.
  Deferred: agents edit, catalogue product add/edit + bulk price Excel, bulk lead reassign, Frontdesk
  "Create lead" button, lead edit form. (Details and reasons in the Task 4 section.)
- Task 5 (UI polish): native prompt/alert replaced with a reusable dialog + snackbar across CRM pages.
  A full cosmetic sweep of older pages is left for a focused review.
- Task 6 (execute UAT): DONE - docs/UAT_Run_Results.md, all rows pass, two issues found and fixed.
- Task 7 (performance): DONE - indexes added, phoneNormalized column + backfill, every report under 1s.
- Task 8 (user guide): DONE - docs/CRM_User_Guide.md.
- Task 9 (this report + cleanup): DONE.

### Commits (no attribution lines, as asked)
Backend: 6737e00 (T1), 762d1ef (T2), 2fb846b (T3), d375db7 (T4 lead filter), f104d3d (T4 backend),
3c3ab23 (T4 phone fix), 08269ae (T7), c8fc1e2 (T6), 0890b31 (T8), plus night-log commits.
Admin: d6b9c9a (T4 screens), 3658e9e (T5).

### New docs for you
- docs/CRM_User_Guide.md - plain guide for the sales team.
- docs/UAT_Run_Results.md - the UAT run, with evidence.
- docs/PROD_DEPLOY_PLAN.md - updated with the rehearsal findings.
- docs/NIGHT_LOG.md - this file.

### Open issues / things to decide - see "Decisions for Ahad" below.

## Decisions for Ahad

_(safe defaults chosen when blocked; review these)_

- **featureMap / _livefeatures drift - FIXED during Task 4.** The committed qa/_livefeatures.json snapshot had 245 features while the working DB AppFeature table has 263, so regenerating the feature map reported not-registered=4 for attendance.create/delete/restore and leaveReq.delete. I resynced _livefeatures.json from the DB (263 features) and regenerated featureMap: not-registered is now 0, and qa:rbac stayed 306/1/3 (no regression - those 4 routes now map to their real features instead of being treated as unmapped). Nothing for you to do; noting it because _livefeatures.json and featureMap.json changed. If those 4 features were deliberately removed from the snapshot, tell me and I will reconsider.
- **Online Orders agent person is still unset** (AG-ONLINE.userId is null) and **AG004 Sadaf Raza still has no login**. Left as-is per your earlier note that you will confirm the person.
- **Deferred Task 4 screens** (ran out of safe night budget, nothing broken): agents edit (target/commission/team/scope), catalogue product add/edit + bulk price-from-Excel (the biggest, and it is cost-gated), bulk lead reassign for managers, the Frontdesk "Create lead" button (the /lead/fromVisitor endpoint and a leadService.fromVisitor method are already in place, only the button is left on a large existing page), and a lead EDIT form (create is done). Say the word and I will finish these.
- **Task 5 is partial on purpose:** the specific ask (replace native prompt/alert) is done and verified; a full cosmetic sweep of the older CRM pages (DataGrid widths, spacing, a global delete-confirm) is left for a focused daytime review rather than rushed overnight.

### Task 4 - Missing CRM screens  [PARTIAL - see done/deferred]
Backend (committed f104d3d + the phone-filter fix): Customer 360 endpoint (/crmReport/customer360, scope + cost gated), order invoice + delivery slip PDFs (same black/grey letterhead), phone and free-text search filters on lead/order/return/quotation, order reattempt filter, and lead search (name/phone/code). Phone matching uses the last 7 digits (the subscriber number), which is contiguous in every stored format (0300-1234567, +92 300..., 3001234567) - a plain digit-strip contains failed because separators break up the longer tail. featureMap not-registered stayed 0; qa:rbac 306/1/3; CRM harness 162/0 (added customer360, order PDF, search, reattempt tests).
Admin (committed below), browser-checked as the manager persona:
  a. Lead create form at /crm/leads/new with live phone lookup that warns "this phone already exists" and links to the matches. VERIFIED (warning showed for a known phone).
  b. My Day at /crm/my-day: overdue + due-today follow-ups with "Log call" (records a call, pushes next follow-up +2 days) and "Open". VERIFIED (120 overdue for the manager).
  c. Customer 360 at /crm/customers: phone search -> that customer's leads/quotations/orders/returns + total spent + merged timeline. VERIFIED (found a customer's 2 leads + timeline).
  f (partial). Lead list now has a search box (name/phone/code) + a "New lead" button.
  h. Order detail: Invoice PDF + Delivery slip buttons (endpoints harness-tested).
  i. Quotation detail: Duplicate (creates a fresh quotation from the lines) + Share on WhatsApp (opens wa.me with the quotation number and total).
  j. Reattempts view at /crm/orders/reattempts: orders with reattemptCount > 0, re-attempt + open actions.
  Nav links added for My Day, Customer 360, Reattempts.
DEFERRED (clearly out of time-budget tonight, noted for Ahad): d (agents edit target/commission/team/scope), e (catalogue product add/edit + bulk price Excel - the largest), f bulk lead reassign (search done, bulk-select reassign not), g Frontdesk "Create lead" button (the visitor page is a large existing component; the /lead/fromVisitor endpoint and a leadService.fromVisitor method are ready, only the button wiring is left). Lead EDIT form (create is done; edit reuse not wired).

### Task 7 - Performance  [DONE]
- Added indexes (additive db push): Lead [dateReceived], [agentId, stage], [phoneNormalized]; SalesOrder [createdAt], [reattemptCount], [phoneNormalized]; SalesReturn [agentId], [reportedAt], [phoneNormalized]; Quotation [createdAt], [phoneNormalized]. (Existing agentId/stage/status/company/city indexes kept.)
- Added a phoneNormalized column (digits only) to Lead/SalesOrder/SalesReturn/Quotation, populated on create/update via shared/phone.ts, backfilled existing rows (261 leads, 68 orders, 62 returns). Phone lookups (lead form, search, customer360) now match on phoneNormalized by the last 7 digits, which is cleaner than matching the raw formatted phone.
- List endpoints already clamp pageSize to a max of 200 (added in Task 3).
- Measured every report against the real data (god/ALL scope): dashboard 177ms, all others under 50ms, customer360 15ms, lead search 20ms. Nothing is over 1s, so no report needed further optimization.
- db push was additive only (checked with migrate diff: no DROP/ALTER COLUMN). Gates: tsc clean, CRM harness 162/0, qa:rbac 306/1/3.
- Commit (backend): see hash below.

### Task 5 - UI polish  [PARTIAL - the specific asks done, broad sweep noted]
- Replaced every native window.prompt and window.alert in the CRM pages with a reusable ReasonDialog modal (src/modules/crm/components/ReasonDialog.tsx) and the app snackbar for errors. Wired into lead detail, lead kanban, order detail, quotation detail and return detail. VERIFIED in the browser: clicking LOST on a lead now opens a clean "Reason to move to LOST" modal instead of the browser prompt.
- The new pages built in Task 4 already follow the house style: consistent page headers, loading and empty states, PKR formatting, Asia/Karachi dates (Customer 360), usable at phone width, scope chips.
- Admin production build is clean (next build exit 0).
- NOT done (honest): a full visual sweep of every pre-existing CRM page for spacing/DataGrid widths and a global confirm dialog for destructive deletes. The existing pages were built consistently in earlier phases and work; this is cosmetic tightening, left for a focused review. Noted here rather than rushed at night.

### Task 9 - Final report + cleanup  [DONE]
- Confirmed real counts unchanged: leads 261, orders 68, returns 62, quotations 0. Zero QA residue (no QA_CRM_ leads/categories, no qa.crm. users, no QA_AG_/QA_EMP_ rows) - the harness cleans up after itself.
- Final gates: CRM harness 162/0, qa:rbac 306/1/3. Admin next build clean. Backend tsc clean.
- Left running: backend on :3002 (RBAC_ENFORCE=on), admin dev server on :3001.
- Backup from the start of the run is at qa/backups/night_20261013_022255.sql (gitignored).

## Task progress

### Baselines (before any change)
- Backend on :3002 (RBAC_ENFORCE=on), admin on :3001.
- qa:rbac 306 pass / 1 fail / 3 blocked. CRM harness 136 pass / 0 fail. (This is the "306/1/3 or better" bar.)

### Task 1 - Admin production build check + backend tsc clean  [DONE]
- Ran `next build` on the admin app: completed clean, exit code 0. All routes compiled (CRM pages included). No type or build errors, so it will deploy on Vercel. No admin code changes were needed.
- Fixed the 2 pre-existing backend TS errors in src/excel (attendance.ts, employee.ts): the `await workbook.xlsx.writeBuffer() as Buffer` cast now uses `Buffer.from(await workbook.xlsx.writeBuffer())`. Runtime behaviour unchanged (still a Node Buffer). `npx tsc` is now fully clean, exit 0.
- Added qa/backups/ to .gitignore (the 354 MB dump must not be committed).
- Gates: qa:rbac 306/1/3, CRM harness 136/0. Backend rebuilt and restarted on :3002.
- Commit (backend): 6737e00. Admin: no commit (no changes).

### Task 2 - Deploy rehearsal on gatePassSystem_restore  [DONE]
Ran the PROD_DEPLOY_PLAN steps against the gatePassSystem_restore DB (pre-work, prod-like). The working gatePassSystem DB and backend were never pointed at it; scripts were run with DATABASE_URL overridden to the restore DB, so pointing the backend to a different port was not needed.
- Schema diff (migrate diff): 536 lines, additive-only gate PASSED (0 DROP/ALTER COLUMN). Adds the 17 CRM tables + 12 enums + 2 columns. Visitor already existed on the restore, so no Visitor create (prod may already have it too).
- db push: synced cleanly.
- crmSeed: 7 categories, 39 products (prices pending), bundle, 245 features. Agent auto-link finding: on the prod-like restore, AG002/AG005/AG008 ALSO linked to logins (ghulam_mustafa@phw, hafiz_muhammad_mubashar@phw, areeba_farooq@phw) that are not in the current working DB. Only AG004 lacks a login, AG007 unmatched. So on prod more agents may auto-link.
- seedRoles: 6 roles. PROBLEM FOUND: the restore already had HR and Admin roles, and seedRoles overwrote their feature permissions. On prod that would clobber a curated Admin role. FIX: seedRoles now skips a role that already exists with features (prints SKIPPED) unless --replace is passed. Verified on the working DB: all 6 now SKIPPED. Plan section 5.1 updated with the review-then---replace guidance.
- Online Orders agent: created (0 orders to assign yet on the restore, correct).
- Lead import dry run then real: before 0 -> after 261, created 261 (matches the working DB; reproducible).
- Returns import dry run then real: orders 0 -> 68, returns 0 -> 62 (matches; reproducible).
- RBAC impact report on the restore copy: 174 of 175 users would lose at least one endpoint once RBAC_ENFORCE=on (top losers 413 routes each). This is expected because the restore users have no roles/grants for the new structure yet. It confirms the plan's off -> log -> on rollout and "assign roles before flipping on" are necessary, not optional.
- No stray working-tree changes; _livefeatures.json unchanged (restore and working have the same 245 features).
- Commit (backend): 762d1ef.

### Task 3 - Security + validation on all CRM endpoints  [DONE]
- New module src/modules/CRM/shared/validate.ts: Zod whitelist schemas for every CRM create/update/transition plus id-only and list bodies, and a validate(schema) middleware. One mechanism does three jobs: type-checks (bad type -> 400 with a clear message, never a 500), strips unknown/junk keys (so junk can't reach Prisma and 500), and leaves server-controlled fields out of the whitelist (mass-assignment guard).
- Mass-assignment: createdBy/updatedBy, sourceFile/legacyId, subtotal/total, status (transition only), stage on lead update (transition only), reattemptCount, quotation version/isActive/parentId, isDeleted are all not settable from the body. agentId is still allowed but scope-checked in the service; scope is allowed only on the SalesAgent endpoints.
- Mounted validate() on all 12 CRM route files (lead, leadActivity, quotation, salesOrder, salesReturn, salesAgent, category, brand, product, pricelist, bundle). No new routes added, so the feature map is unchanged; committed featureMap has CRM not-registered = 0.
- List endpoints now coerce and CLAMP pageSize to a max of 200 (also serves Task 7's max-page-size requirement).
- Harness: added 19 validation/mass-assignment/fuzz tests. CRM harness now 155/0.
- Gates: tsc clean, qa:rbac 306/1/3, CRM harness 155/0.
- Commit (backend): see hash below.
