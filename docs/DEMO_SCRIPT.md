# Demo script

A separate demo stack runs beside the dev stack. The demo uses the `gatepass_demo`
database. The dev app and dev database (`gatePassSystem`) are not touched by the demo.

## URLs

- Demo admin UI: http://localhost:3006
- Demo API: http://localhost:3005
- Dev admin (unrelated, leave alone): http://localhost:3001 on API http://localhost:3002

Log in on the demo UI at http://localhost:3006/login.

## Logins

All passwords are `demo1234`.

| Role | Username | Name | What they see |
| --- | --- | --- | --- |
| Admin | admin@demo.pk | Aisha Khan | Everything: Analytics, Access Control, Quick Mark, Frontdesk, CRM, Work, Settings |
| Sales Manager | manager@demo.pk | Bilal Ahmed | CRM (team scope) and Work |
| Sales Agent | agent@demo.pk | Fatima Noor | CRM (own scope) and Work |
| Order Ops | orders@demo.pk | Hamza Tariq | CRM orders and returns (all agents), no leads |
| Frontdesk | frontdesk@demo.pk | Sana Malik | Frontdesk visitors |
| HR | hr@demo.pk | Imran Shah | Quick Mark (employees, attendance, leave, shifts, units) |
| Team Lead | lead@demo.pk | Zara Sheikh | Work for their team |
| Employee | employee@demo.pk | Omar Farooq | Work only: own tasks and own daily report |

To show that each role sees a different menu, log in as Admin, then Sales Agent, then
Employee, and point at the top menu. Admin has every section, the Sales Agent has only
CRM and Work, the Employee has only Work.

## Start the demo

Open two terminals.

Terminal 1, the demo API on port 3005:

```bash
cd "D:/Development/Projects/Project 6 (SolarMax)/codes/Backend"
DATABASE_URL="$(grep -oP 'DATABASE_URL="\K[^"]+' .env | sed 's#/gatePassSystem#/gatepass_demo#')" ALLOWED_ORIGINS="http://localhost:3006,http://localhost:3001" RBAC_ENFORCE=on PORT=3005 node index.js
```

Terminal 2, the demo admin UI on port 3006 (production build, already built):

```bash
cd "D:/Development/Projects/Project 6 (SolarMax)/codes/admin"
NEXT_DIST_DIR=.next-demo npx next start -p 3006
```

Wait for Terminal 2 to print "Ready", then open http://localhost:3006/login.

## Stop the demo

Press Ctrl+C in each terminal. If a port stays busy, free both in PowerShell:

```powershell
Get-NetTCPConnection -LocalPort 3005,3006 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }
```

## 15 minute click path

Start logged in as Admin.

1. Dashboard (2 min). Open http://localhost:3006/analytics. Show the greeting,
   today's attendance, the last 7 days chart, and the shift card. Click the sun or moon
   in the top bar to switch light and dark, then switch back.
2. Leads board (2 min). CRM menu, then Leads. Switch from List to Board. Drag a card to a
   new stage. Switch back to List and show the Created by and Updated by columns.
3. Quotation to order (3 min). CRM, then Quotations. Open QT-2026-015. Show the line
   items, status and totals. Go back, open Orders, open SO-2026-010, and show the order
   status, courier, Invoice PDF and Delivery slip buttons.
4. Returns (1 min). CRM, then Returns. Open a return and show its status and reason.
5. Customer 360 (1 min). CRM, then Customers. Click a customer (for example Capital Smart
   Homes). Show their leads, quotations, orders, returns and total spent on one page.
6. Agent detail (1 min). CRM, then Agents. Open an agent (for example Online Orders) and
   show their scope and figures.
7. Reports (1 min). CRM, then Reports. Show the dashboard figures and open one or two
   report tabs such as Lead funnel or Agent performance.
8. Work: assign a task (1 min). Work menu, then My Tasks. Open a task, or create one, and
   assign it to a team member.
9. Daily report (1 min). Work, then Daily Reports. Show the submit form for today and the
   team view with the last several days.
10. Manager view (1 min). Log out, log in as manager@demo.pk. Show the team scope on
    Leads and the Team Board in Work.
11. Permissions and role differences (1 min). Log back in as Admin. Access Control, then
    Roles, open a role and show its allowed features. Then log in as agent@demo.pk and
    employee@demo.pk to show the shorter menus.
12. Audit log (1 min). As Admin, Settings, then Audit Log. Filter by module or action and
    show who changed what, with time and IP.

## Demo data (only in gatepass_demo)

Added on top of the copied dev data: 20 leads, 15 quotations, 10 orders, 3 returns,
8 role logins plus a few more employees, 3 teams (Sales, Operations, HR), 30 tasks across
statuses, daily reports for the last 7 days (with a couple missing on purpose), a few
notifications, and a few edits so the History tabs show changes.

The dev database is unchanged: leads 261, orders 68, returns 62, quotations 0.

## Reseed the demo data (only if needed)

The demo data is already in place. To rebuild it from scratch (demo database only, it
refuses to run against any other database):

```bash
cd "D:/Development/Projects/Project 6 (SolarMax)/codes/Backend"
DATABASE_URL="$(grep -oP 'DATABASE_URL="\K[^"]+' .env | sed 's#/gatePassSystem#/gatepass_demo#')" npx ts-node seedDemo.ts
```
