# Night log

Autonomous overnight run. Local only. Started 2026-10-13.

Backup taken first: qa/backups/night_20261013_022255.sql (354 MB, full gatePassSystem dump, gitignored).
DATABASE_URL confirmed localhost, DB gatePassSystem.

## Summary (filled in Task 9)

_pending_

## Decisions for Ahad

_(safe defaults chosen when blocked; review these)_

- **featureMap / _livefeatures drift - FIXED during Task 4.** The committed qa/_livefeatures.json snapshot had 245 features while the working DB AppFeature table has 263, so regenerating the feature map reported not-registered=4 for attendance.create/delete/restore and leaveReq.delete. I resynced _livefeatures.json from the DB (263 features) and regenerated featureMap: not-registered is now 0, and qa:rbac stayed 306/1/3 (no regression - those 4 routes now map to their real features instead of being treated as unmapped). Nothing for you to do; noting it because _livefeatures.json and featureMap.json changed. If those 4 features were deliberately removed from the snapshot, tell me and I will reconsider.
- **Online Orders agent person is still unset** (AG-ONLINE.userId is null) and **AG004 Sadaf Raza still has no login**. Left as-is per your earlier note that you will confirm the person.

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
