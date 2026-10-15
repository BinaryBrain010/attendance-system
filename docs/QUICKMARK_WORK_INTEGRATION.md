# QuickMark (Attendance App) — Work integration note

Goal: let employees view their tasks and submit their daily report from the QuickMark / attendance
mobile app.

## No new backend is required

The Work module API already supports this. Verified end to end with an employee-linked user that
holds `login.quickmark.*` + `appModules.work.*` + `work.task.read.own.*` + `work.report.read.own.*`
+ `work.report.submit.*`, logging in with `platform: "Attendance App"`:

- `POST /auth/login` `{ username, password, platform: "Attendance App", rememberMe: true }` returns
  the JWT and the linked `employee` object.
- `POST /task/get` `{ page, pageSize }` -> the employee's own tasks (own-scope: assigned to /
  created / watched by them). 200.
- `POST /task/getById` `{ id }` -> one task (scope-checked).
- `POST /task/setStatus` `{ id, status }` -> only if the role also has `work.task.transition.*`.
- `POST /dailyReport/myToday` `{}` -> today's report (or null).
- `POST /dailyReport/submit` `{ whatIDid, hours, blockers, planTomorrow }` -> create/update today's
  report (same-day editable, late flag set after 18:00). 200.
- `POST /notification/get` / `GET /notification/unreadCount` -> the employee's notifications.

A user without the feature is correctly denied (e.g. `POST /task/create` -> 403 without
`work.task.create.*`).

## What the mobile app needs (app-side only — not shipped here)

This is a UI change in the QuickMark app, not a server change, so no new APK is built as part of this
work. Two read/write screens are enough:

1. **My Tasks** — list from `POST /task/get`, open a task, optionally change status via
   `POST /task/setStatus` (if the role allows). Read-only is fine for a first cut.
2. **Daily Report** — load `POST /dailyReport/myToday`, show the form, submit via
   `POST /dailyReport/submit`. Disable editing when the stored report is not from today.

Auth and base URL are the same ones the app already uses for attendance; reuse the stored JWT.

## RBAC to grant employees

Add to the employee role (in the permission editor, "Work Features" section + App Modules > Work):

- `appModules.work.*` (so the feature is enabled for them)
- `work.task.read.own.*`
- `work.report.read.own.*`
- `work.report.submit.*`
- optionally `work.task.transition.*` if field staff should move their own tasks.

That is all that is required for QuickMark employees to see their tasks and file daily reports.
