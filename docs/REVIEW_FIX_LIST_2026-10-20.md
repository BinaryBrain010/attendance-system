# SolarMax Client-Review Fix List — 2026-10-20

Source of truth for the review phases. **Re-read this file after any context compaction.**
Tick items here as they are finished. Work in sub-phases; commit + report after each sub-phase.

## Standing rules
- Test only with `QA_`-prefixed users and delete them after. Never change real users'
  passwords/grants. Never touch records you didn't create. No seedDemo, no `--replace`, no qa
  scripts on prod. Work in phases, commit after each, report after each. **DO NOT deploy.**
- No "Co-Authored-By" / "Generated with" attribution lines in commits (memory rule).
- Seeds for new permissions are **upsert-only**.

## GLOBAL RULE
All counts, stats, totals, statuses and filters are calculated on the **backend**. The frontend only
displays. Every list is **server paginated**. **No getAll calls from screens** (getAll is export-only,
gated by the export permission).

---

## Phase 1 — DONE (blob/napi + log hygiene + hook hardening + getAll gating)
- [x] Blob/base64 exclusion from all `findMany`; hard pagination caps (commit 3a09610)
- [x] pm2 log hygiene: quiet 401, leave-overlap 409 no-stack, 5xx logs userId (commit e7051be)
- [x] Hook hardening: detail opt-ins, no silent truncation, upload compression, metadata redaction,
      leave-status linking; qa:blobhardening (commit e0470ba)
- [x] getAll routes gated behind export perm; attendanceReq server-side stats + filters; admin stats
      bar / navbar / analytics no longer download all rows (Backend 0d322d5, admin ca50523)

---

## Phase 2 — CRM  (IN PROGRESS — sub-phase + commit each)
- [x] 2a. Lead timeline: merge the 3 entries (activity, activity-log, audit) into ONE entry per
      action — type, outcome, notes, next follow-up, who did it, readable sentence case. Raw field
      changes only behind "Show changes". (Backend timeline() correlates by actor+time; admin
      TimelineItem with Show changes. Incidental: malformed-JSON body now 400 not 500. crm harness
      188/0.)
- [x] 2b. Quick actions on lead detail + lead-list row menu: Called (outcome: no answer, busy,
      interested, not interested, call back), WhatsApp sent, Visit, Quotation sent, Mark won, Mark
      lost (reason required). Small popover: notes + optional next follow-up, 1–2 clicks. Stage chips
      to change stage. Replaces the long "Change stage" + "Log activity" form; full form behind
      "More details". (Shared LeadQuickActions component. Detail page + board cards. Flat list rows
      open the detail where the actions live; the shared MUI table was NOT rewritten for a per-row
      popover — board is the per-lead quick-action surface. Reuses addActivity/transition endpoints.)
- [x] 2c. New permission `crm.lead.assign`. Without it, the Agent field is hidden on New/Edit lead and
      the lead goes to the creator's own agent. Enforce on backend. Upsert-only seed.
      (Backend lead.service create/update: without crm.lead.assign the requested agentId is ignored and
      the lead is forced to the caller's own agent; /lead/assign already gated. seedLeadAssignFeature.ts
      (upsert-only). Admin leadform already hides the Agent field without the permission. Verified with
      QA agents; crm harness 188/0. NOTE for prod: run seedLeadAssignFeature.ts.)
- [ ] 2d. New permission `crm.lead.transfer`: "Transfer" to another agent in the same team (all-scope
      managers pick anyone). Requires a reason, goes on the timeline, notifies both agents.
- [ ] 2e. @mentions in lead and activity notes (team members; everyone for managers). Mentioned user
      gets a notification linking to the lead.
- [ ] 2f. Agent detail page redesign: header (name, code, login, status, team, scope). KPIs: target vs
      achieved progress bar, pipeline value, won value, conversion rate, due today + overdue
      follow-ups. Tabs: Leads, Quotations, Orders, Returns, Activity, Team, History — real tables +
      links. History shows names, not raw ids.

## Phase 3 — Access Control
- [ ] 3a. Users/Roles/Groups tables with server-computed, sortable counts; null-safe mapper.
      Users: username, linked employee, roles (chips), groups count, status, last login, created.
      Roles: name, users count, groups count, permissions count, updated.
      Groups: name, members count, roles, updated.
- [ ] 3b. User detail: header cards (status, last login + device, roles, groups, linked employee).
      Employee tab last. Suspend/Reactivate behind new `user.suspend` (blocks login, revokes
      sessions+tokens, audited). Role/group detail show members with last login + permission summary.
- [ ] 3c. Auto-suspend when employee becomes resigned/terminated/inactive or deleted → linked user
      suspended automatically + audited. No auto-reactivate. Dry run of affected prod users.
- [ ] 3d. Change Password: add confirm field + minimum length rule everywhere a password is set.

## Phase 4 — Quick Mark small fixes
- [ ] 4a. Remove `/ams` landing page; redirect to employees list.
- [ ] 4b. Employee detail: linked user (username, roles, last login, status, link), team + team lead,
      assigned tasks, linked sales agent, recent daily reports.
- [ ] 4c. "Update Record Details" dialog: names not ids, friendly labels, formatted dates, clean
      old→new table. One shared component.
- [ ] 4d. Attendance page: rename "Add Attendance" → "Mark Attendance".
- [ ] 4e. Employee filter dialog has two close icons — keep one.
- [ ] 4f. Date pickers inside dialogs open behind the dialog — fix globally.
- [ ] 4g. Create/Edit Staff: Designation + Department become comboboxes of existing distinct values
      from the server, still allowing a new typed value.

## Phase 5 — Quick Mark pages
- [ ] 5a. Attendance requests page: compact/professional. One stats strip from /stats, one search box,
      filters (status, date range, employee, unit), dense table (photo, employee, type, reason, date,
      requested time, status, created), row→side drawer with approve/reject+note, bulk approve. First
      page <500ms on prod size.
- [ ] 5b. Leave requests: default view shows all statuses (remove hidden filter). Same layout+drawer.
- [ ] 5c. Detail pages: Leave allocation (per type allocated/used/pending/remaining, taken, adjustment
      history); Leave type (rules, applies-to, usage summary, edit).
- [ ] 5d. Holidays: month calendar view; click date to add, click holiday to edit. Types public/
      company/weekly-off; all or selected units; date ranges; yearly recurring. "Mark Sundays" → a
      per-unit weekly-off rule if safe, else propose options first.
- [ ] 5e. Unit detail: today stats strip (total, present, late, absent, on leave, not checked in,
      checked out), a "Today" tab (who is in/late/missing with times), status filter on employee cards.
- [ ] 5f. Shift page: soft distinct colours per shift + schedule block. Assignments tab = employee
      cards with photos. Assign dialog lists only active employees.
- [ ] 5g. Photo endpoint `GET /employee/:id/photo?size=thumb` with stored thumbnail, cached. Lazy
      photos everywhere with initials fallback. (DEFERRED here by design.)
- [ ] 5h. Mark Attendance: method selector = one row of small tabs; scanner/form shows directly with
      one title (Face Recognition currently appears 3×); remove duplicate Full Page buttons; remove or
      collapse Recent Activity panel; fits one screen at 1080p.

## Phase 6 — Frontdesk
- [ ] 6a. "Referred To" suggests only employees present today (checked in, not out). Free text allowed.
- [ ] 6b. Referred employee notified at once (bell + sound), can mark visit "Attended" with a note.
      Store referredAt, attendedAt, attendedBy; show wait time; add "Waiting" filter.
- [ ] 6c. Frontdesk per unit: visitor belongs to a unit (default user's unit). Unit column + filter.
      Users see only their unit unless `visitor.viewAll.unit` (backend-enforced). Additive migration;
      backfill existing visitors to head-office unit with a dry run first.

## Phase 7 — Quick Pass
- [ ] 7a. Items table picker too narrow: widen column, show name+code in full (wrap), dropdown wider
      than the cell.

## Phase 8 — Work, notifications, personal settings
- [ ] 8a. Work > Reports crashes ("Something went wrong") after "Completion report ready". Fix + remove
      that toast.
- [ ] 8b. Notification sound on new notifications only (not on page load), toggle-able, respects
      autoplay rules.
- [ ] 8c. Rename current "Settings" app (audit + configuration) → "Administration".
- [ ] 8d. New "Me" app: profile (name, photo, linked employee, roles, last login); change password
      (with confirm); logout; logout all devices; preferences (theme, font size small/default/large
      app-wide via CSS vars, notification sound, default landing app, date format) stored per user on
      backend (additive migration).
- [ ] 8e. App launcher: drag-drop reorder saved per user on backend + "Reset order".

## Phase 9 — Print and PDF
- [ ] 9a. Every print/PDF action (gate pass, quotation, invoice, delivery slip, employee print,
      reports) gets View (inline new tab) and Download (proper filename, e.g.
      `GP-0123_2026-10-20.pdf`). One shared component; Content-Disposition set by a query param.

## END deliverables
- [ ] Run all qa scripts (rbac, crm, gatePass, insights, listpaging, blobhardening) + both builds.
- [ ] Full list of new migrations, permissions and seed scripts for prod.
- [ ] Auto-suspend dry run (Phase 3c) + visitor backfill dry run (Phase 6c).
- [ ] Dry-run script for compressing existing prod images + redacting old ActivityLog metadata.
