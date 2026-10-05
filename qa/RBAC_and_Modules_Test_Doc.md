# SolarMax / Power Highway: RBAC and Module Test Document

**Goal.** Prove that every existing module, the RBAC system, and the app feature permission model work end to end before building the ERP on top of this backend.

**Environment.** Local only. Backend at http://localhost:3002, admin UI at http://localhost:3001, database gatePassSystem. The harness refuses to run if DATABASE_URL is not localhost. Production was never touched.

**Date of run.** 2026-10-05.

**Result.** 271 pass and 30 fail across 301 checks, plus a live UI check of 7 personas in the browser. 8 bugs and 34 gaps were logged. Every one of the 30 fails is a real finding, not a test artifact. No business logic was changed. Findings are logged only and wait for your approval before any fix.

---

## 1. How to run

```bash
# 1. Start the backend locally. Keep it alive with an auto-restart loop, because two
#    endpoints can currently crash the process (see BUG004 and BUG005).
while true; do node index.js; sleep 1; done

# 2. Run the full suite (provisions personas, runs every scenario)
npm run qa:rbac          # writes qa/results.json and qa/_created.json

# 3. Build the Excel report (10 sheets)
npm run qa:report        # writes qa/RBAC_Module_Test_Report.xlsx

# 4. Remove every QA artifact (users, roles, groups, records, QA features)
npm run qa:cleanup

# Optional: provision clean personas for a manual UI check, without the mutation tests
npm run qa:rbac -- --provision-only
```

All test data is tagged and removable. Usernames are qa.<persona>.<run>@test.local, roles and groups are prefixed QA_, and feature rows are QA_feat.*. Cleanup deletes by tracked id and by tag pattern, and also does a direct local database sweep for the few records whose API delete is broken or which have dependents (QA features, the QA workflow employee and its attendance, leave, shift and gate pass rows, and the QA customer and item). The real admin account and real users are never modified. No seed, force-seed, or setup script is run.

---

## 2. What was tested

### 2.1 Inventory (read only baseline)
177 live AppFeature rows in the database, 187 feature strings in staticData.ts, 24 permission buckets in the admin permission.tsx, and about 120 feature strings referenced by the admin UI. Around 30 route modules and 200 plus endpoints were catalogued with their method, path, and the feature that should guard them (qa/catalog.ts).

### 2.2 Personas (33 users, 4 roles, 3 groups)
Named personas cover every RBAC composition path: direct features only, role only, group only, role via group, and a mixed user that combines direct plus role plus group own plus role in group. Platform personas cover Mobile only, Admin only, Attendance App only, and no access. Special personas: QA_UnitScoped (unitIds in the token), QA_Revoked (granted then revoked during the run), QA_AttendanceApprover (holds the feature the approve route enforces), and QA_God (the real admin account). There are also 21 single module users, one per module, each granted all live features under its module prefix.

### 2.3 Scenarios and results

| Area | What it proves | Result |
|---|---|---|
| Login gating | Platform gated login (login.app, login.admin, login.quickmark) allows or denies each of Mobile, Admin, Attendance App per persona | 96 of 96 pass |
| Permission union | webhook/permissions returns exactly user plus roles plus groups plus roles in groups; god gets all; checkPermissions agrees | 63 of 63 pass |
| Module CRUD as god | create, read back, update, soft delete, restore on every core module | pass except AppFeature delete and restore (BUG007) |
| Security (auth only) | a valid token without a module feature tries to read and write that module | 21 modules reachable without the feature (BUG001) |
| Permission changes | grant, revoke, remove from group, logout blacklist, unknown feature default | grant, group removal and logout pass; revoke not reflected (BUG002); unknown feature allowed (BUG003) |
| Unit scoping | unitIds in the token filters data | attendance is scoped; employee, attendance-request, leave and analytics are not |
| Workflows (as the right persona) | mark attendance, approve and reject attendance request, approve and reject leave, assign shift and verify status, gate pass create to approve to PDF | all pass |
| Multi user | concurrent checkout, update, approve and edit on the same record | all handled without a 5xx; no optimistic locking (gap) |
| UI visibility (live browser) | log in as 7 personas on localhost:3001 and check the menu and landing | see section 5 |

### 2.4 Workflow detail (the important ones)
- Mark attendance returns PRESENT, LATE, or HALF_DAY correctly based on check in time against the shift start plus the lateGraceMinutes and halfDayLateMinutes config.
- The attendance request approve route is one of the few routes with real server side permission enforcement. A persona that has attendanceReq.* but not attendance.request.approve.* is correctly denied with a 403. A persona that holds attendance.request.approve.* succeeds.
- When an attendance request is approved, the created attendance uses the request submission time, not the approval time. The test delayed the approval by several seconds and confirmed the marked time stayed at the submission time.
- Leave request approve and reject work, and approval syncs attendance to ON_LEAVE for the date range.
- Gate pass create, approve with a signature, and PDF generation all work (the PDF endpoint returns real application/pdf bytes).

---

## 3. Findings: bugs

| ID | Severity | Area | Finding |
|---|---|---|---|
| BUG001 | Critical | RBAC backend | No server side permission enforcement. routes.helper applies only authenticateToken. There is no requirePermission middleware, so any authenticated token can read and change every module (21 modules confirmed) regardless of its RBAC features. RBAC today only shapes the UI. |
| BUG006 | Critical | Platform stability | No global crash guard. There is no process level unhandledRejection or uncaughtException handler, and several controllers read nested request body fields while building the activity log before handleRequest wraps the call. A single malformed request can stop the whole process. BUG004 and BUG005 are two concrete instances. |
| BUG002 | High | RBAC permissions | Revoking a permission is not reflected in the permission list. getAllowedFeaturesForUser calls gpGetAllowedFeatures, whose raw SQL has no isDeleted filter, so soft deleted FeaturePermission rows are still returned to webhook/permissions. The checkPermission path does filter isDeleted, so the menu (built from the list) stays inconsistent with the real check. The query also returns only the first row, ignoring other active rows. |
| BUG003 | High | RBAC permissions | Unknown feature strings are allowed by default. checkUserPermission looks the feature up in appFeature and returns true when it is not found. Combined with the UI only enforcement, any route or control guarded by an unregistered feature string is effectively public, and there are 11 admin referenced strings that are not registered. |
| BUG004 | High | Auth login | POST /auth/login without a rememberMe field stops the whole process. loginUser passes rememberMe (undefined) into loggedInUsers.gpCreate, the column is required with no default, so Prisma throws an unhandled error and the process exits. An unauthenticated request can trigger this. |
| BUG005 | High | Leave config update | PUT /leave/leave-configurations/update without leaveConfigData stops the whole process. The activity log description reads leaveConfigData.name outside the try and catch, so when that object is missing it throws an unhandled error and the process exits. |
| BUG007 | Medium | Feature delete | Deleting or restoring an AppFeature always returns 500. feature.service calls appFeature.gpSoftDelete and gpRestore, which are not implemented on the model. Features can be created but never removed or deactivated through the API. |
| UIB01 | Medium | Admin navigation | The post-login home is hardcoded to /analytics, which shows a 404 for any user without analytics. Confirmed live for four personas. Nav hrefs point at /admin/... while the real routes are bare (/ams/..., /analytics), and middleware strips the /admin prefix, so links and deep links are fragile. |

## 4. Findings: gaps (34 total, highlights)

- Feature name mismatches between layers. The admin UI uses roots such as setting.*, leave.*, leaveConfig.*, leaveReq.*, leaveAlloc.*, voucher.*, profile.*, appModules.*, while the backend and staticData use different roots (systemConfig.*, attendanceReq.*, and so on). 11 admin referenced strings are not registered, 10 staticData features are not seeded, and 4 live roots have no UI bucket.
- Unit scoping is enforced for the attendance list but not for employee, attendance-request, leave, or analytics lists.
- The attendance request approve feature (attendance.request.approve.*) lives under a different root than the rest of the module (attendanceReq.*) and has no UI bucket, so it cannot be granted from the admin UI.
- Admin navigation needs the appModules.* umbrella features in addition to the functional features (see section 5).
- There are no admin UI pages for Customer, Item, or Gate Pass. A voucher only user has nothing to see in the admin.
- No optimistic locking. Concurrent approve and edit of the same gate pass, attendance request, or leave request are all accepted with no row version check, so a record can be approved twice and an edit can overwrite a concurrent approval.
- /stats has no guard feature, and activityLog.* has no UI bucket.

Full detail for every row is in qa/RBAC_Module_Test_Report.xlsx (sheets Gaps, Feature Catalog, Test Matrix, and UI Visibility).

---

## 5. Live UI visibility check (browser, localhost:3001)

Each persona was logged in through the real admin login form, and the menu and landing page were read from the page. Clean personas were used so permissions matched their provisioned state.

| Persona | Login | Actual navigation and access | Result |
|---|---|---|---|
| QA_NoAccess | Denied | Login refused with "You don't have permission to login" | Matches expected (no login feature) |
| QA_AdminLogin_NoModules | OK | No menu groups; lands on a 404 | Matches on nav; the 404 landing is a bug |
| QA_GatePassViewer | OK | No menu groups; 404 landing; there is no gate pass page in the admin | Mismatch, because no gate pass UI exists |
| QA_HR | OK | No menu groups at all, although it holds every HR module feature; landed on the attendance request page with data but no menu | Mismatch, see the umbrella finding below |
| QA_Frontdesk | OK | Frontdesk menu visible; the Visitor page works fully (3706 visitors, add, export, import, check out) | Matches expected |
| QA_Mixed | OK | No menu groups; 404 landing, although it holds employee, holiday and shift read | Mismatch, see the umbrella finding below |
| QA_Revoked | OK | Frontdesk menu visible in the granted state; the Visitor page works | Matches expected in the granted state |

**How the menu is gated.** The top navigation groups are controlled by these features: Analytics by analytics.*, Access Control by appModules.accessControl.*, Quick Mark by appModules.quickMark.*, and Frontdesk by visitor.*. The items inside each group then use the functional features (employee.*, user.*, and so on).

**Main UI finding (the umbrella requirement).** The Access Control and Quick Mark groups need the appModules.accessControl.* and appModules.quickMark.* umbrella features, which are separate from the functional features. A role that has the module features but not the matching umbrella sees no menu for those modules. This was confirmed live for QA_HR and QA_Mixed, which both hold real module features but show an empty top navigation. To be usable, a role must also include the appModules.* umbrella. The Frontdesk group is inconsistent with the others, because it gates directly on visitor.* rather than an appModules.* umbrella.

**Secondary UI finding (the 404 landing).** The post-login home is hardcoded to /analytics, which returns a 404 for any user without analytics. Several personas hit this 404 right after a successful login.

---

## 6. What works

- Login gating is correct for all three platforms and every persona.
- The permission union is correct across every composition path (direct, role, group, role in group, mixed), matches checkPermissions, resolves to all 177 features for god, and recalculates when a user is removed from a group. Logout blacklists the token.
- Core workflows work: attendance marking with correct PRESENT, LATE and HALF_DAY status; attendance request approval that is permission enforced and uses the submission time; leave approve and reject; and the full gate pass create, approve with signature, and PDF flow.
- CRUD works as god on every core module except AppFeature delete and restore.
- Concurrent operations on the same record are handled without a server error (though there is no optimistic locking).

---

## 7. Reading for the ERP

The RBAC model (the feature tree, the union resolution, the god bypass, and platform gating) is sound and is a good base for ERP roles. The gaps are in enforcement and consistency. Today RBAC only shapes the UI, the API trusts any valid token (BUG001), the permission list ignores revocations (BUG002), unknown features are allowed (BUG003), and the server can be stopped by a malformed request (BUG004, BUG005, BUG006). Before adding ERP modules the backend needs a requirePermission middleware wired to the same union resolver, a crash guard with input validation, alignment of the feature strings across staticData, the database, and the admin UI (including the appModules.* umbrella and the attendance.request.approve.* naming), and a safe post-login landing route.

---

## 8. Artifacts

| File | Contents |
|---|---|
| qa/RBAC_Module_Test_Report.xlsx | 10 sheets: Summary, Modules and Endpoints, Feature Catalog, Personas, Test Matrix, Permission Changes, UI Visibility, Multi User, Bugs and Security Findings, Gaps |
| qa/results.json | Raw machine readable results |
| qa/ui_observations.json | The live UI check results and the nav gating map |
| qa/run.ts | The harness (provisioning, RBAC, security, workflows, multi user) |
| qa/catalog.ts | Module and endpoint catalog with intended guards |
| qa/personas.ts | Persona, role, and group definitions |
| qa/lib.ts | Local only guard, token mint, HTTP and login helpers, recorder |
| qa/report.ts | Excel generator |
| qa/cleanup.ts | Teardown that removes all QA artifacts |
| qa/_inventory.json | Baseline inventory of features, buckets, and admin and mobile permissions |
| qa/backups/gatePassSystem_prewqa_*.sql | Pre work database backup (pg_dump) |
