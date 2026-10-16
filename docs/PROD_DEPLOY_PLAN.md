# Production Deployment Plan — Okasha Smart CRM + Frontdesk + RBAC

**Status: PLAN ONLY. Nothing in here has been run on production.** Every destructive or state-changing
step is first rehearsed end-to-end on a **local restore of a fresh prod backup**, and only promoted to
prod after the rehearsal passes and the owner approves the gated items (role→user mapping, imports,
RBAC flip).

Scope of this release:
- **CRM** module (catalogue, agents, leads, quotations, orders, returns, 11 reports) — new tables.
- **Frontdesk / Visitor** module — new `Visitor` table (if not already on prod).
- **RBAC enforcement** — currently `off` on prod; rolled out to `on` via `log` mode last.

Legend: 🖥️ = runs on the **prod server**, 💻 = runs on your **local rehearsal copy**, ✋ = **owner
approval required** before proceeding.

---

## 0. Prerequisites & principles

- **Never run a step on prod that has not passed on the local restore first.** The restore is a real
  pg_dump of prod, so the rehearsal exercises the real data shape and volume.
- Take a **fresh backup immediately before** each prod-mutating stage (not just once at the start).
- Keep a maintenance window; CRM is new so there are no existing CRM users to disrupt, but the schema
  push and the backend restart touch the whole app.
- Tools used (already in the repo): `qa/impact.ts` (RBAC impact), `crmSeed.ts` (feature + catalogue
  seed), `seedRoles.ts` (role recipes), `seedOnlineOrdersAgent.ts`, `leadImportDryRun.ts` /
  `qa/runLeadImportReal.ts`, `returnImportDryRun.ts` / `qa/runReturnImportReal.ts`.
- Record the prod values you'll need: `DATABASE_URL` (prod), the server host/path, the pm2 app name,
  the Vercel project.

---

## 1. Backup prod, restore locally, rehearse everything first

### 1.1 🖥️ Back up prod
```bash
# on the prod DB host (or anywhere that can reach it)
pg_dump --no-owner --no-privileges -Fc "$PROD_DATABASE_URL" -f prod_$(date +%Y%m%d_%H%M).dump
# verify the file is non-empty and lists the expected tables:
pg_restore -l prod_YYYYMMDD_HHMM.dump | grep -iE "User|Employee|Role|Visitor|SalesOrder|Lead" | head
```
Keep this dump; it is also the **stage-0 rollback artifact**.

### 1.2 💻 Restore into a local rehearsal database
```bash
createdb okasha_prodcopy
pg_restore --no-owner --no-privileges -d okasha_prodcopy prod_YYYYMMDD_HHMM.dump
```
Point a local checkout at it (a throwaway `.env`): `DATABASE_URL=postgresql://localhost/okasha_prodcopy`.
All 💻 steps below run against this copy. The local-only guard in every script keeps them from touching
prod by accident (prod runs use the explicit `--allow-remote` flag, called out where it applies).

### 1.3 💻 Rehearse the entire plan (sections 2–9) on the copy
Run sections 2→9 top to bottom against `okasha_prodcopy`, including the import **dry runs**, the role
seed, and the RBAC impact report. Only once the rehearsal is clean do you repeat the 🖥️ steps on prod.

---

## 2. Schema review on the prod copy — additive only (`prisma db push`)

CRM/Frontdesk were built with `prisma db push` (not new migration files), so prod is migrated with
`db push` too. Before pushing, **compute the exact DDL** and prove it is additive.

### 2.1 💻 List exactly what the push would change
```bash
# authoritative diff: from the prod copy's current state -> the target schema
npx prisma migrate diff \
  --from-url "postgresql://localhost/okasha_prodcopy" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > /tmp/prod_schema_diff.sql
```
### 2.2 ✋ Gate: additive-only, abort on any drop
- Read `/tmp/prod_schema_diff.sql`. It must contain **only** `CREATE TABLE`, `CREATE TYPE` (enums),
  `ALTER TABLE ... ADD COLUMN`, `CREATE INDEX`, and new FKs.
- **Abort if it contains any** `DROP TABLE`, `DROP COLUMN`, `ALTER COLUMN ... TYPE`, `DROP TYPE`, or a
  new `NOT NULL` column on an existing table **without a default** (that would fail on existing rows).
  ```bash
  grep -iE "DROP TABLE|DROP COLUMN|DROP TYPE|ALTER COLUMN|DROP CONSTRAINT|DROP INDEX" /tmp/prod_schema_diff.sql
  # ^ must print NOTHING. If it prints anything, STOP and investigate before touching prod.
  ```
- **Expected additions** (sanity check — the diff should match this, nothing more):
  - New tables: `Category, Brand, Product, ProductVariant, ProductImage, PriceList, Bundle, BundleItem,
    SalesAgent, Lead, LeadActivity, Quotation, QuotationItem, SalesOrder, SalesOrderItem, SalesReturn,
    ReturnItem` and, if not already on prod, `Visitor`.
  - New enums: `CrmProtocol, ProductStatus, PriceTier, AgentScope, LeadStage, ActivityType,
    QuotationStatus, SalesOrderStatus, ReturnStatus, PaymentType, SalesChannel` (+ `VisitorStatus` if
    Visitor is new). `Company` already exists.
  - New **nullable** columns only on existing tables (none expected beyond the CRM/Visitor tables).
- Save `/tmp/prod_schema_diff.sql` as part of the deploy record.

**Rollback (schema):** see §10.2. Additive changes are low-risk, but the stage-0 dump restores the
pre-push state if needed.

### 2.3 Work module (Run 10) — the one non-additive change, and the migration file

The Work module (Teams, Tasks, Daily reports, Notifications) adds 10 tables + 2 enums and **drops the
dead `Todo` stub** (model + `TodoStatus`/`TodoPriority` enums). Todo had no code and **0 rows**, so the
drop is safe — but it means the §2.2 additive-only grep WILL show `DROP TABLE "Todo"` /
`DROP TYPE "Todo*"`. That one drop is the expected exception; abort only on any OTHER drop.

A reviewed migration file is committed at
`prisma/migrations/20261016120000_add_work_module/migration.sql`. It was generated by diffing a
restored pre-Run-9 dump against the schema:
```bash
# restore the pre-Work dump into a scratch DB, then:
npx prisma migrate diff --from-url "postgresql://.../<pre-Work scratch db>" \
  --to-schema-datamodel prisma/schema.prisma --script > work.sql
```
The Todo drops in it are `IF EXISTS`, so it is safe even if Todo was already removed. It was validated
by applying it to the pre-Work scratch DB (Todo dropped, all 10 Work tables created).

**Two ways to apply Work on prod (pick one):**

- **(A) db push — the process this project already uses (§2).** Run the §2.1 diff (it will equal the
  committed migration SQL, including the `Todo` drop), confirm only that one drop, then `prisma db
  push`. Simplest; matches §3.2.
- **(B) Adopt Prisma Migrate (recommended going forward).** Prod's schema was built with `db push`,
  so `_prisma_migrations` is empty and the 31 historical migrations are NOT recorded as applied.
  Baseline first, then deploy only the new migration:
  ```bash
  # baseline every EXISTING migration as already-applied (records them without running them)
  for d in prisma/migrations/*/; do m=$(basename "$d"); [ "$m" = migration_lock.toml ] || npx prisma migrate resolve --applied "$m"; done
  # the Work migration is the only one left pending -> apply it
  npx prisma migrate deploy      # creates the 10 Work tables, drops the empty Todo
  npx prisma migrate status      # must print "Database schema is up to date!"
  ```
  Validated locally: after baselining, `migrate status` is clean and the Work migration applies on a
  pre-Work schema.

**Known limitation — a from-scratch `migrate deploy` on an empty DB does NOT work, and this is
pre-existing, not caused by the Work module.** The entire Sales CRM (Brand, Category, Product,
ProductVariant, ProductImage, PriceList, Bundle, BundleItem, SalesAgent, Lead, LeadActivity,
Quotation, QuotationItem, SalesOrder, SalesOrderItem, SalesReturn, ReturnItem) and the Shift /
ShiftAssignment tables were created with `db push` and were never captured as migration files, and
`20260204000000_add_shift_timetable` adds an FK to `Shift` that no earlier migration creates — so a
clean replay fails at that migration with `relation "Shift" does not exist` (this is also why
`prisma migrate dev` fails its shadow replay). Do **not** rename or edit those migrations. To make
the project truly migrate-deployable from scratch later (optional, separate task): squash the legacy
partial history into one baseline migration generated from the current schema
(`prisma migrate diff --from-empty --to-schema-datamodel schema.prisma --script`), archive the old
folders, and re-baseline. Until then, path (A) or (B) above is how Work reaches prod.

### 2.4 Audit fields + AuditLog (Run 11) — fully additive, no drops

Run 11 adds the audit actor columns (`createdById`/`updatedById`/`deletedById`, VARCHAR(36), nullable)
to 31 business models + `createdById` to the 3 append-only feeds + `updatedById` to `SystemConfig`,
and the new `AuditLog` table (+ 4 indexes). There are **no drops and no column type changes** — the
§2.2 additive-only gate passes cleanly (unlike §2.3). The columns are plain scalars with NO FK and NO
Prisma relation, matching the codebase's existing `createdBy`/`updatedBy` convention (see
docs/AUDIT_INVENTORY.md for why: avoids ~90 back-relations on User and db-push/migrate drift).

A reviewed migration is committed at
`prisma/migrations/20261017090000_add_audit_fields_and_log/migration.sql`. It was generated the Run-10
way — diffing a restored **pre-Run-11** dump against the schema:
```bash
# restore the pre-Run-11 dump into a scratch DB (gatepass_shadow), then:
npx prisma migrate diff --from-url "postgresql://.../gatepass_shadow" \
  --to-schema-datamodel prisma/schema.prisma --script > run11.sql
```
Counts in the file: 33 `createdById`, 32 `updatedById`, 31 `deletedById` additions + `CREATE TABLE
"AuditLog"` + 4 indexes. Validated by applying it to the pre-Run-11 scratch DB (exit 0; Lead gained
the 3 columns, AuditLog + indexes created). Scratch DB dropped afterward.

**Apply on prod:** same two paths as §2.3. Under **(A) db push**, the §2.1 diff equals this migration
(all additive) — just `db push`. Under **(B) Prisma Migrate**, this migration applies on top of the
Run-10 baseline; after baselining the existing migrations it is pending and `migrate deploy` adds it.
Locally: baselined with `migrate resolve --applied 20261017090000_add_audit_fields_and_log` and
`migrate status` prints "Database schema is up to date!" (34 migrations). The §2.3 from-scratch
limitation is unchanged (pre-existing Shift drift); this migration does not add to it.

**No backfill required on prod for correctness** — existing rows keep NULL actor columns and render as
"System (legacy)". Optionally run `qa/backfillAuditIds.ts` (idempotent, `--dry` supported) to populate
the new id columns from the legacy `createdBy`/`updatedBy` strings where those are real User ids; it
only fills the new columns and never changes a business field.

**Audit runtime flags:** `AUDIT_LOG=0` disables audit logging entirely; `AUDIT_ENFORCE=0` makes a
failed audit insert non-fatal (the business write still commits). Default (both on): the AuditLog row
is written in the same transaction as the business write, so a write never commits without its log.

---

## 3. Deploy the backend (RBAC_ENFORCE=off)

RBAC stays **off** through the whole code+data deploy; it is rolled out separately in §9.

### 3.1 🖥️ Backup first
Fresh `pg_dump` per §1.1 (label it `pre_backend_deploy`).

### 3.2 🖥️ Pull, install, generate, push, build, restart
```bash
cd /path/to/Backend
git fetch && git log --oneline origin/main -5     # confirm the commit you expect
git pull

npm ci                                            # clean install from package-lock
npx prisma generate                               # regenerate the client for the new models

# push the reviewed, additive-only schema (same diff you approved in §2)
npx prisma db push

npm run build                                      # tsc (compiles in place; featureMap.json stays put)

# featureMap must be present and current in the build (see §4.2)
ls -l src/middleware/rbac/featureMap.json

# ensure RBAC stays OFF for now, then restart
# (.env) RBAC_ENFORCE=off   NODE_ENV=production   (see §8)
pm2 restart okasha-backend --update-env
pm2 logs okasha-backend --lines 50                # confirm clean boot, DB connected
```
> `npm run build` is `tsc` with no `outDir`, so it compiles `.ts → .js` **in place**; `index.js`
> (`node index.js`, via `src/core/server/server`) is the entry. `prisma generate` must run **before**
> the restart so the client matches the pushed schema. If `npm ci` fails on a native dep (bcrypt),
> fall back to `npm install`.

### 3.3 🖥️ Smoke test
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<prod-api>/access/checkPermission   # expect 401 (up, auth required)
```
Log in as an existing admin in the app; confirm the existing modules (attendance, employees, etc.) work
unchanged — RBAC is off, so nothing should be newly blocked.

**Rollback (backend):** §10.3.

---

## 4. Additive feature seed + featureMap

### 4.1 🖥️ Seed the new features (idempotent, additive)
`crmSeed.ts` registers the `crm.*` + `appModules.crm.*` AppFeature tree, the catalogue, and maps
AG001–AG008 to existing employees by name. It **creates no users** and only **adds** features.
```bash
# crmSeed.ts refuses a non-local DATABASE_URL unless you pass --allow-remote (explicit prod opt-in).
npx ts-node crmSeed.ts --allow-remote    # review its output: X features added, catalogue seeded, agent match report
```
- **Catalogue prices stay pending** (no invented prices) until the Shopify export is loaded.
- Note the **agent-match gaps** it prints (e.g. AG004 has an employee but no login; others may be
  unmatched on prod) — these feed the role-mapping table in §5.

### 4.2 🖥️ featureMap present and current
The RBAC middleware reads `src/middleware/rbac/featureMap.json` from its own directory at runtime. It is
committed, so `git pull` brings the current one. To be safe, regenerate on the server after the push:
```bash
npm run qa:routes && npm run qa:featuremap      # prints "not-registered: 0"
ls -l src/middleware/rbac/featureMap.json
```
**Gate:** `not-registered` must be **0**. A non-zero count means a route would be denied once RBAC is
`on` — fix before §9.

**Rollback (seed):** features and the featureMap are additive; removing them is not required for
rollback (RBAC is off). If you must, delete the added `crm.*` AppFeature rows and restore the prior
`featureMap.json` from git.

### 4.3 🖥️ Work module features (`seedWorkFeatures` = `workSeed.ts`)

The Work module (Run 9/10) adds its own `work.*` feature tree + `appModules.work.*`. Seed it the same
idempotent way as the CRM features:
```bash
npx ts-node workSeed.ts --allow-remote    # upserts 26 work.* AppFeatures (+ appModules.work.*)
```
It `upsert`s every feature (safe to re-run) and, locally, rewrites `qa/_livefeatures.json` so the
featureMap generator sees them. The committed `featureMap.json` already maps all Work routes (`/team`,
`/task`, `/dailyReport`, `/notification`, `/workReport`), so §4.2's `not-registered: 0` gate still
holds after a regenerate.

**Order for the Work module on prod** (fits inside the plan above):
1. §2.3 — apply the Work schema (either `db push`, or baseline-resolve the existing migrations then
   `migrate deploy` the two Work migrations `20261016120000_add_work_module` +
   `20261016130000_team_member_requires_report`). The only destructive change is dropping the empty
   `Todo` stub.
2. §4.3 — `workSeed.ts --allow-remote` to register the `work.*` features.
3. §4.2 — regenerate/verify featureMap (`not-registered: 0`).
4. §5 — seed/refresh roles so the right people get `work.*` (see the table and the work tiers below).
5. §9 — flip `RBAC_ENFORCE=on` as usual.

### 4.4 🖥️ Audit module features (`seedAuditFeatures.ts`) — Run 11

Run 11 adds the `audit.*` feature tree (admin-only read of the central Audit Log). Seed it the same
idempotent way:
```bash
npx ts-node seedAuditFeatures.ts --allow-remote   # upserts audit.* / audit.read.* / audit.export.*
```
It `upsert`s each feature and, locally, rewrites `qa/_livefeatures.json`. The committed
`featureMap.json` maps the `/auditLog` routes: `/auditLog/get` + `/auditLog/export` → `audit.read.*`
(admin only); `/auditLog/entity` + `/auditLog/actors` → token (any logged-in user; the service
enforces that the caller can read the specific record), so §4.2's `not-registered: 0` gate still holds.

**Order for the Audit module on prod** (fits inside the plan above):
1. §2.4 — apply the audit schema (additive; `db push` or `migrate deploy` the
   `20261017090000_add_audit_fields_and_log` migration).
2. §4.4 — `seedAuditFeatures.ts --allow-remote` to register `audit.*`.
3. §4.2 — regenerate/verify featureMap (`not-registered: 0`).
4. §5 — the **Admin** role recipe already includes `audit.*`; re-run `seedRoles.ts` so admins get it.
   No other role gets audit read (it is admin-only). Per-record History tabs and the created/updated-by
   footers need no feature (token-gated + record-read-scoped), so every user already sees history for
   records they can read.
5. §9 — enforcement rollout as usual. Audit logging itself is independent of `RBAC_ENFORCE` and is on
   by default (`AUDIT_LOG`/`AUDIT_ENFORCE` flags in §2.4).

---

## 5. Roles on prod

Roles are defined as code recipes in `roleRecipes.ts` and created by `seedRoles.ts` (idempotent:
upserts the `Role` row and its `FeaturePermission`). Eight roles ship:

| Role | What it grants (summary) | CRM scope | Work scope | SalesAgent link |
|------|--------------------------|-----------|-----------|-----------------|
| **Employee** | own tasks (move/comment) + own daily report | — | OWN | no |
| **Team Lead** | their team's tasks (create/assign/manage) + team daily reports & compliance | — | TEAM | no (lead a Team) |
| **Sales Agent** | own leads/quotes/orders/returns + reports (no cost); own tasks + report | OWN | OWN | yes, scope OWN |
| **Sales Manager** | Sales Agent + team reads + cost/margin; team-scope Work | TEAM | TEAM | yes, scope TEAM |
| **Order Ops** | `crm.order.*` + `crm.return.*`, **no lead access** | ALL | — | not required |
| **Frontdesk** | visitor management (`visitor.*`) + `employee.read.*` | — | — | — |
| **HR** | employee / attendance / leave / shift / holiday / unit | — | — | — |
| **Admin** | all modules incl. `work.*` + `audit.*` (short of the hardcoded god account) | ALL | ALL | — |

Exact feature lists live in `roleRecipes.ts` (single source of truth). The app-module umbrellas
(`appModules.crm.*`, `appModules.work.*`, `appModules.frontdesk.*`, …) are included in each recipe
where that module's nav should appear.

**Work feature tiers** (constants `WORK_OWN` / `WORK_TEAM` / `WORK_ALL` in `roleRecipes.ts`):
- **employee (own):** `appModules.work.*`, `work.task.read.own.*`, `work.task.transition.*`,
  `work.task.comment.*`, `work.report.read.own.*`, `work.report.submit.*`.
- **team lead (team):** the own set **plus** `work.team.read.*`/`create`/`update`,
  `work.task.read.team.*`/`create`/`update`/`assign`/`delete`, `work.report.read.team.*`,
  `work.report.comment.*`. A team-scope reader must actually be the Team's **lead** for TEAM to resolve
  (otherwise it narrows to OWN) — set them as `Team.leadId`.
- **manager / admin (all):** `appModules.work.*` + `work.*`.
Membership note: only members whose `TeamMember.requiresDailyReport` is true are expected to file a
daily report; add staff to a Team to put them on the compliance list.

### 5.1 🖥️ Create/refresh the roles
```bash
npx ts-node seedRoles.ts --allow-remote          # all 6 roles; prints each role id + action
# or one at a time, e.g.: npx ts-node seedRoles.ts "Order Ops" --allow-remote
```
**Safety (verified in rehearsal):** `seedRoles` does NOT overwrite a role that already exists with a
feature permission; it prints `SKIPPED`. The rehearsal showed prod likely already has **Admin** and
**HR** roles. Review their current features first; only if you want to align them to the recipe, re-run
with `--replace` for those roles:
```bash
# review existing role features in the admin UI first, THEN, per role you want to align:
npx ts-node seedRoles.ts "HR" --replace --allow-remote
```
New roles (Sales Agent, Sales Manager, Order Ops) are created regardless.

### 5.2 ✋ Draft role→user mapping (owner approves before applying)
Map **real prod users** to roles via `UserRole` (admin UI → Access Control, or a small script). This
table is a **draft for approval** — fill the blanks and confirm before anyone is assigned:

| Role | Prod user (login) | Person | SalesAgent | Notes |
|------|-------------------|--------|-----------|-------|
| Sales Agent | `usama_liaqat@phw` | Usama Liaqat | AG001 (OWN) | confirmed mapping |
| Sales Agent | `hur_ali@phw` | Hur Ali | AG003 (OWN) | confirmed mapping |
| Sales Agent | _TBD_ | Ghulam Mustafa | AG002 | needs a login on prod |
| Sales Agent | _TBD_ | Sadaf Raza | AG004 | **username pending from owner** |
| Sales Agent | _TBD_ | Hafiz M. Mubashar | AG005 | needs a login |
| Sales Agent | _TBD_ | Areeba Farooq | AG008 | needs a login |
| Sales Manager | `usman_arshad@phw` | Usman Arshad | AG006 (TEAM: AG001, AG003) | confirmed mapping |
| Order Ops | _TBD_ | Online-orders operator | AG-ONLINE (optional) | **person to be confirmed** (see §6.3) |
| Frontdesk | _TBD_ | Reception | — | |
| HR | _TBD_ | HR staff | — | |
| Admin | _TBD_ | existing system admin(s) | — | keep the current admin(s) |

> The team (AG006 over AG001+AG003) and each agent's `scope` must be set on the prod `SalesAgent` rows
> to match this table, since effective scope is the **narrower** of the role's feature leaf and the
> agent's `scope`.

**Rollback (roles):** delete the created `Role` rows (and their `FeaturePermission` + any `UserRole`);
with RBAC off, roles have no effect anyway.

---

## 6. Online-orders agent + data imports

### 6.1 💻 Import dry runs on the prod copy (review before prod)
```bash
npx ts-node leadImportDryRun.ts        # writes qa/LeadImport_DryRun.xlsx
npx ts-node returnImportDryRun.ts      # writes qa/ReturnImport_DryRun.xlsx
```
✋ Owner reviews both workbooks against the prod data (dedup, cities, reason clusters, created-order
counts) before any real import on prod.

### 6.2 🖥️ Real imports on prod (in a transaction, before/after counts)
```bash
npx ts-node qa/runLeadImportReal.ts        # prints before/after lead counts + created total
npx ts-node qa/runReturnImportReal.ts      # prints before/after orders+returns, created totals
```
> On the local build these created **261 leads** and **68 orders / 62 returns**; prod counts will differ
> with prod's current data. Both runners are transactional and print before/after.

### 6.3 🖥️ Online Orders agent + reassignment
```bash
npx ts-node seedOnlineOrdersAgent.ts --allow-remote
# creates the AG-ONLINE virtual agent (placeholder employee, userId null) and assigns every
# RETURNS_IMPORT order + unassigned ONLINE_STORE order (and their returns) to it; prints before/after.
```
✋ When the owner confirms the **person** who operates online orders, link `SalesAgent.userId` (and, if
desired, swap `employeeId` to that real employee and retire the placeholder), and assign them the
**Order Ops** or **Sales Agent** role per §5.

**Rollback (imports):** the stage backup (`pre_import` dump). The lead/return rows created by the import
carry provenance (`sourceFile`/`legacyId`), so a targeted delete by `sourceFile="RETURNS_IMPORT"` /
import `sourceFile` is possible, but a dump restore is the safe path.

---

## 7. Admin portal deploy (Vercel)

The admin is a Next.js app (`codes/admin`, `next build`) deployed on Vercel.
1. 🖥️ Merge/confirm the admin `main` commit is the one you expect.
2. Vercel: push to the production branch (or `vercel --prod`) to trigger the build.
3. Env on Vercel: the API base URL (`environment.apiUrl`) must point at the prod backend; CORS on the
   backend (`ALLOWED_ORIGINS`) must include the Vercel domain.
4. Smoke test: log in, open **CRM → Reports**, confirm the scope chip and that exports download.

**Rollback (admin):** Vercel → **Instant Rollback** to the previous deployment (one click; no DB impact).

---

## 8. Legacy / environment items to settle on prod

- **Visitor table (Frontdesk):** if prod predates Frontdesk, §2's diff will include `CREATE TABLE
  "Visitor"`; the `db push` in §3 creates it. The historical reception list is imported with
  `npm run import-reception-visitors` (preview with `preview-reception-visitors` first).
- **`NODE_ENV=production`:** set it in the prod `.env` / pm2 env so Express, Prisma and logging run in
  production mode. Add `RBAC_ENFORCE=off` now (flipped in §9). Confirm `.env` has `DATABASE_URL`,
  `JWT_SECRET`, `CODE`, `ALLOWED_ORIGINS`, `NODE_ENV`, `RBAC_ENFORCE`.
- **pm2 startup hook:** make the backend survive a server reboot:
  ```bash
  pm2 start index.js --name okasha-backend        # if not already registered
  pm2 save                                         # snapshot the process list
  pm2 startup                                       # prints a sudo command; run it once to install the boot hook
  ```

---

## 9. RBAC enforcement rollout (off → log → on)

RBAC is `off` on prod today. Roll out **after** code, seed, roles and imports are in place.

### 9.1 💻 Impact report on the prod copy
```bash
IMPACT_DB_URL="postgresql://localhost/okasha_prodcopy" npx ts-node qa/impact.ts
# writes qa/RBAC_Impact_Report.md: for every real role/group/user, which mapped endpoints they'd LOSE once 'on'
```
✋ Review the report: any **legitimate** access a real user would lose means a **role gap** — fix the
recipe in `roleRecipes.ts`, re-run `seedRoles.ts`, re-run the impact report until only *intended*
denials remain (e.g. an agent correctly denied cost/margin, or another agent's rows).

### 9.2 🖥️ Switch to `log` mode for a few days
```bash
# .env: RBAC_ENFORCE=log
pm2 restart okasha-backend --update-env
```
In `log` mode nothing is blocked; every would-be denial is appended to `Backend/logs/rbac_denials.log`.
Let real users work normally for a few days.

### 9.3 🖥️ Review the denials log
```bash
tail -n 200 logs/rbac_denials.log
# cluster by feature/route/user; each denial is JSON: {ts, userId, route, feature, ...}
```
✋ Every denial for a **legitimate** action = a missing grant → fix the role recipe + re-seed. Repeat
9.2–9.3 until the log shows only denials you *want* (real out-of-scope / unauthorized attempts).

### 9.4 🖥️ Turn enforcement on
```bash
# .env: RBAC_ENFORCE=on
pm2 restart okasha-backend --update-env
```
Watch `logs/rbac_denials.log` and user reports closely for the first hours. **Unmapped routes are
denied under `on`**, so §4.2's `not-registered: 0` gate must hold.

**Rollback (RBAC):** set `RBAC_ENFORCE=log` (or `off`) and `pm2 restart --update-env`. This is an
**instant, no-data** rollback — the single most important property of this rollout: enforcement can be
turned off in seconds without touching the DB.

---

## 10. Rollback summary (per stage)

| Stage | Rollback |
|-------|----------|
| 0. Pre-anything | Keep the `pg_dump` from §1.1 as the master restore point. |
| 2. Schema diff | No change made yet (diff only). |
| 3. Backend deploy | `git checkout <previous-sha> && npm ci && npx prisma generate && npm run build && pm2 restart`. If the schema push caused issues: restore the `pre_backend_deploy` dump. |
| 4. Feature seed | Additive; with RBAC off it has no effect. Optionally delete added `crm.*` AppFeatures + restore `featureMap.json` from git. |
| 5. Roles | Delete created `Role` + their `FeaturePermission` + `UserRole`; no effect while RBAC off. |
| 6. Imports | Restore the `pre_import` dump (safest), or targeted delete by import provenance (`sourceFile`/`legacyId`). |
| 7. Admin (Vercel) | Vercel Instant Rollback to the previous deployment. |
| 8. Env / pm2 | Revert `.env`; `pm2 restart --update-env`; `pm2 save`. |
| 9. RBAC flip | **`RBAC_ENFORCE=log` (or `off`) + `pm2 restart --update-env`** — instant, no DB change. |

**Golden rules:** (1) a fresh `pg_dump` immediately before every prod-mutating stage; (2) RBAC stays
`off` until §9 and flips to `on` only after a clean impact report and a quiet denials log; (3) every
step passes on the restored prod copy before it runs on prod.
