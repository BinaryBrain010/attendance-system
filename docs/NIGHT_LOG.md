# Night log

Autonomous overnight run. Local only. Started 2026-10-13.

Backup taken first: qa/backups/night_20261013_022255.sql (354 MB, full gatePassSystem dump, gitignored).
DATABASE_URL confirmed localhost, DB gatePassSystem.

## Summary (filled in Task 9)

_pending_

## Decisions for Ahad

_(safe defaults chosen when blocked; review these)_

- none yet

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
- Commit (backend): see hash below.
