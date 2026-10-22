# Deploy package — Review fix list (Phases 3–9)

Date: 2026-10-22
Backend HEAD: **063510c**   Admin HEAD: **5b76a92**
Base already in prod: backend `a567afd` / admin `dc6bfea` (deployed before Phase 3).
This package = everything from Phase 3 through Phase 9 + the END deliverables.

Builds: `npx tsc` (backend) = clean; `npm run build` (admin) = clean.
QA: qa:rbac 305 pass / 2 fail / 3 blocked (the fails+blocked are the **pre-existing** Unit/Scoping
expectation on the employee & attendance lists — not touched this review); qa:featuremap 529/0
unregistered; listpaging, blobhardening (PASS), insights 16/0, audit 23/0, work 27/0, leadassign /
leadtransfer / leadmention PASS.

## 1. Pending migrations (ALL additive — ADD COLUMN only, nullable or defaulted; none destructive)
Apply with `npx prisma migrate deploy` (NOT `migrate dev`), then `npx prisma generate`:
1. `20261022202403_add_user_suspend` — User.suspendedAt, User.suspendedById
2. `20261022210622_add_employee_image_thumb` — Employee.imageThumb
3. `20261022213001_add_holiday_fields` — Holiday.endDate, type(def 'PUBLIC'), recurring(def false), unitIds(def '{}')
4. `20261022215041_add_visitor_referral_unit` — Visitor.referredAt, attendedAt, attendedBy, attendedNote, unitId
5. `20261022221304_add_user_preferences` — User.preferences (JSONB)

## 2. Seeds (upsert-only, remote-guarded — DO NOT run `npm run seed`)
Run once, in this order:
1. `npx ts-node seedReviewFeatures.ts --allow-remote`
   Upserts every new AppFeature introduced by this review:
   - attendanceReq.export.*, activityLog.export.*, visitor.export.*  (bulk get-all export gating)
   - crm.lead.assign.*, crm.lead.transfer.*  (CRM lead ownership)
   - user.suspend.*  (suspend / reactivate)
   - visitor.viewAll.unit.*  (Frontdesk: see visitors from all units)
   (Re-runnable; it also rewrites qa/_livefeatures.json.)

No other seed is required. (gatePass.* / voucher.* features already exist in prod from Quick Pass.)

## 3. Permissions to GRANT to roles after seeding
Most new routes reuse EXISTING features (holiday.read.*, employee.read.*, leaveConfig.read.*,
visitor.update.*, attendanceReq.read.*) and need no new grants. Grant these NEW ones where wanted:
- **user.suspend.*** → admin roles (needed to suspend/reactivate users).
- **visitor.viewAll.unit.*** → head-office / managers who must see visitors from every unit.
  (Without it, a user sees only their own unit's visitors — by design.)
- **attendanceReq.export.*, activityLog.export.*, visitor.export.*** → whoever may export those bulk lists.
- **crm.lead.assign.*, crm.lead.transfer.*** → CRM managers (if not already granted).
- Quick Pass workflow (if not already granted from the earlier Quick Pass deploy): gatePass.dispatch.*,
  gatePass.return.*, gatePass.cancel.*, gatePass.reject.*.

## 4. .env — no changes required.

## 5. Post-deploy data jobs (all have a READ-ONLY dry run; nothing writes without --apply)
- **Auto-suspend** (Phase 3c) — users linked to RESIGNED/FIRE employees get suspended.
  Dry run (done on the local copy): **48 users would be suspended.** This happens automatically when an
  employee is set RESIGNED/FIRE going forward; to apply the backlog once, run the dedicated path / confirm 48.
  Dry run: `npx ts-node dryRunAutoSuspend.ts`
- **Visitor → unit backfill** (Phase 6c): `npx ts-node dryRunVisitorBackfill.ts` (dry run) then
  `... --apply --allow-remote`. Local dry run: **3704 visitors → "HEAD OFFICE"** unit.
- **Image compress + ActivityLog redaction** (ops): `npx ts-node dryRunImageCompressAndRedact.ts` then
  `... --apply --allow-remote`. Local dry run: **209 employee photos (~87 MB base64)** to compress +
  backfill thumbnails; **2305 / 63156 ActivityLog rows** carry sensitive metadata to redact.

## 6. Deploy order
1. Pull backend `063510c` + admin `5b76a92`.
2. `npx prisma migrate deploy` → `npx prisma generate` → build backend (`npx tsc`) → restart.
3. `npx ts-node seedReviewFeatures.ts --allow-remote`.
4. Grant the §3 permissions.
5. Build + deploy admin (`npm run build`).
6. Run the §5 backfills (dry run first, then `--apply --allow-remote`).
