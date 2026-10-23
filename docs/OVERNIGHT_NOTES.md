# Overnight run 2026-10-23 — notes, blockers and decisions

Autonomous run. Local only; QA_ data only; additive migrations only; no push/deploy.
Items that are blocked, risky, or need the user's decision are recorded here (skipped, then moved on).

## Decisions / blockers

### A4 — employee/attendance unit scoping (qa:rbac)
- Implemented: the employee list (GET+POST /employee/get) and attendance list (POST /attendance/get)
  now scope by the caller's **token `unitIds`** (exposed from the JWT in authentication.ts). Empty
  unitIds = no restriction (see all), matching login (which derives unitIds from the user's unit
  assignments) and the visitor no-unit fallback. A non-empty set restricts to those units' members +
  attendance managers (getEmployeeIdsInUnits).
- Why token-driven, not permission-driven: the list routes are gated on `employee.read.*` /
  `attendance.read.*`, and in the feature hierarchy `*.read.all.*` is a CHILD of `*.read.*`, so ANY
  user allowed to read the list already holds read-all. Scoping "unless viewAll" is therefore not
  expressible via permission alone. Token unitIds is the signal the app already issues.
- qa:rbac: 305/2/3 → **307 pass / 0 fail / 3 blocked**. The 3 blocked (T0280 attendanceReq, T0281
  leave-request, T0282 analytics topAttendance) are Unit/Scoping comparisons where QA_UnitScoped has
  no read permission on those endpoints, so the harness can't compare counts — not failures.
- DECISION FOR USER: a real user who holds read-all AND is assigned to a unit will now be scoped to
  that unit on these two lists (token carries their unit). A true see-everything admin should have no
  unit assignment (unitIds=[] → sees all). Flag if you want read-all to always override unit scoping.
