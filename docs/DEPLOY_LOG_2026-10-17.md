# Production deploy log — Power Highway ERP backend

Target: solarmaxcompk@174.136.29.206 (operator SSH'd in via PuTTY; Claude provides commands only).
Rules honored: no secrets printed/stored/committed, no git push, restart only the `gatepass` pm2
process, CRM/Work go live EMPTY (no imports, no demo seed, no qa harness, no test users), never
change admin@panel.com or any real user password.

Timestamps and command outputs are pasted by the operator. Secrets are never recorded here.

## Pre-flight finding (from local repo)
- NODE_ENV branches reviewed: logger level (info vs debug), Prisma prod pooling, audit-off banner
  only. `trust proxy=1` and CORS `credentials:true` are unconditional. No prod-gated cookie
  secure/sameSite. Verdict: NODE_ENV=production is safe to set (step 6).

## Step 1 — Recon (read only)
Commands run (Block 1): pm2 list; whoami/home/node/npm; disk/mem; ~/server git state; DATABASE_URL
host+db only (redacted); Postgres version; table list; row counts for User/Employee/Attendance/
Visitor/GatePass; Todo existence+count; admin-frontend-on-box check.

Output (recon 2026-10-18 ~03:57 server time):
- pm2: one app `gatepass` (id 0), online, 12h uptime, 80 restarts, ~240MB.
- node v20.18.1 at ~/node-v20.18.1-linux-x64/bin; npm 10.8.2. Disk 61G free; RAM ok.
- ~/server is a git checkout, HEAD e191d74 "Add half-day threshold for late check-ins", with
  uncommitted working-tree changes (asset image renames + deleted uploads). .env is 292 bytes.
- DB: localhost:5432 / solarmaxcompk_gatepasssystem.
- BLOCKER: DATABASE_URL password contains an unencoded '@', so libpq-based tools (psql, pg_dump)
  mis-parse host as "gatepass@localhost" and fail. The app runs because Prisma's parser is lenient.
  First pg_dump produced a 0-byte (invalid) dump -> NO valid DB backup yet. Fixed by parsing .env in
  Node and exporting PGHOST/PGPORT/PGUSER/PGDATABASE/PGPASSWORD (password never printed).
- Admin frontend IS on this server: ~/public_html/admin and ~/public_html/adminpanel (no admin node
  process in pm2 -> static build served by Apache). Handle in step 9.
- Still pending (Block 3): pg version, Todo row count (GATE), table counts, valid DB backup.

## Step 2 — Backups (must succeed before any change)
Commands run (Block 2): pg_dump -Fc -> ~/backups/pre_erp_<TS>.dump; pg_restore -l verify; tar of
~/server (excl node_modules/.git) -> ~/backups/server_code_<TS>.tgz; cp .env -> ~/backups/env_<TS>.bak.

Output: operator used their own cPanel SQL backup instead of the pg_dump (Ctrl-C'd mine).
File: ~/solarmaxcompk_gatepasssystem-2026-10-18-07-53-34.sql (410MB). VERIFIED complete: 32 CREATE
TABLE + 32 COPY blocks (schema+data for all tables incl. Todo), ends with the modern pg_dump
`\unrestrict <token>` completion marker. GATE: Todo row count = 0 (safe to drop). Prod counts:
User 228, Employee 231, Attendance 77957, Visitor 0 (table exists, empty), GatePass 1227. PG 14.24.
Rollback note: the dump is plain SQL with \restrict/\unrestrict — restore needs a modern psql or the
cPanel restore UI; but the real rollback for this additive release is dropping the new tables.

### Ship: local build tsc-clean (exit 0); crmSeed.ts gained a --features-only flag (features, no
catalogue/agents). Tarball built: scratchpad/erp_deploy_20261018_131211.tgz (13MB) = compiled .js +
seeds + prisma + featureMap, excluding node_modules/.env/qa.backups/logs/src.assets.uploads. Prod
uploads carried from ~/server on extract. System user is auto-ensured on backend boot (no seed cmd).

### Rollback commands (filled once TS is known)
Let TS = the timestamp printed by Block 2.
- Code:  `cd ~ && mv server server_failed_$(date +%s) && tar xzf ~/backups/server_code_<TS>.tgz -C ~`
  (or, after the §7 switch: `mv ~/server ~/server_failed && mv ~/server_old_<TS> ~/server`)
- .env:  `cp ~/backups/env_<TS>.bak ~/server/.env`
- DB:    `DBURL=$(grep -E '^DATABASE_URL=' ~/server/.env | cut -d= -f2- | tr -d '"'); \
          pg_restore --no-owner --no-privileges --clean --if-exists -d "$DBURL" ~/backups/pre_erp_<TS>.dump`
- Restart: `pm2 restart gatepass --update-env`

## Step 3+ — Ship code / schema / seed / switch / smoke
_(pending recon; commands added here as they are run)_
