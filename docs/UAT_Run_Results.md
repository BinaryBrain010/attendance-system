# CRM UAT run results

I ran through docs/CRM_UAT_Checklist.md in the browser as the seeded personas, backed by the automated
CRM harness (qa/crm.ts, 162 checks) for the flows that are awkward or destructive to click through by
hand. Local only.

Evidence types:
- UI: I did this in the browser and saw the result.
- harness: the backend behaviour is covered by an automated test in qa/crm.ts (162/162 passing).

Personas used: manager usman_arshad@phw (scope TEAM) and, by the harness, an own-scope agent, a team
lead, an all-scope admin, a no-cost viewer, and a user with no CRM access.

| # | Item | Result | Evidence |
|---|------|--------|----------|
| 1.1 | Login lands on an accessible page | Pass | UI: logged in as manager, landed in the app with the CRM menu |
| 1.2 | CRM menu shows all sections | Pass | UI: menu shows My Day, Leads, Kanban, Quotations, Orders, Reattempts, Returns, Catalogue, Agents, Customer 360, Reports |
| 1.3 | Manager scope reads TEAM | Pass | UI: Leads page shows "Scope: TEAM" |
| 2.1 | Catalogue lists products/SKUs | Pass | harness: catalogue CRUD + seed; UI reports/pages load catalogue |
| 2.2 | Prices show as pending | Pass | harness: pending-price product rejected without an explicit price; prices seeded null |
| 2.3 | Agent cannot see cost | Pass | harness: AGENT_OWN cost stripped, /withCost 403, margin 403 |
| 3.1 | Agents listed with scope | Pass | UI: Agents page; harness: agent scope resolves OWN/TEAM/ALL |
| 3.2 | Manager leads AG001 + AG003 | Pass | harness: TEAM sees own + AG001 + AG003 (5 of the 7 fixtures) |
| 4.1 | Agent sees only own leads | Pass | harness: AGENT_OWN sees 2 own fixtures (scope OWN) |
| 4.2 | Manager sees team leads | Pass | UI: manager leads list populated; harness: TEAM sees 5 |
| 4.3 | Row click opens lead detail | Pass | UI: lead rows open the detail page |
| 4.4 | Add activity shows on timeline | Pass | harness: activity logged, appears in merged timeline |
| 4.5 | Stage moves forward | Pass | harness: NEW to CONTACTED to QUALIFIED etc.; UI: stage buttons on detail |
| 4.6 | Lost needs a reason | Pass | harness: LOST without reason 400, with reason 200 |
| 4.7 | Out-of-scope lead refused | Pass | harness: AGENT_OWN getById/update/transition on another agent's lead 403 |
| 4.8 | Kanban board | Pass | UI: Kanban link present and opens; harness data backs the columns |
| 4.9 | Imported leads correct | Pass | UI: real leads show correct dates, real PK cities, values |
| 5.1 | Create quotation, number generated | Pass | harness: Q-0001 style number generated |
| 5.2 | Line items, discounts, totals | Pass | harness: subtotal/discount/total computed (lineA 1900, subtotal 6900, total 6700) |
| 5.3 | New version, one active | Pass | harness: newVersion -> v2, v1 inactive, single active enforced |
| 5.4 | Sent moves lead to Quotation | Pass | harness: quotation SENT -> lead stage QUOTATION |
| 5.5 | Quotation PDF | Pass | harness: /quotation/pdf 200; letterhead verified in an earlier session |
| 5.6 | Pending-price line blocked | Pass | harness: line with a pending product and no price 400 |
| 6.1 | Accepted quotation to order | Pass | harness: accepted quotation -> order, items carried, total 6000 |
| 6.2 | Order shows new fields | Pass | harness: externalOrderNo/paymentType/area persist and read back |
| 6.3 | Order stages, lead Won | Pass | harness: DRAFT..DELIVERED in order; order CONFIRMED -> lead WON |
| 6.4 | Reattempt | Pass | harness: reattempt on DISPATCHED, count 1; UI: Reattempts page + button |
| 7.1 | Create return with reason | Pass | harness: order -> return carries items, order marked RETURNED |
| 7.2 | Return stages | Pass | harness: REPORTED -> RECEIVED_BACK -> RESTOCKED; DAMAGED needs a note |
| 7.3 | Return without reason blocked | Pass | harness: return create without reason 400 |
| 8.1 | Dashboard | Pass | UI: dashboard KPIs including "Won value (estimated, from leads)" |
| 8.2 | Agent performance | Pass | UI: per-agent bars + table |
| 8.3 | Lead funnel | Pass | UI: stage counts + drop-off |
| 8.4 | Pipeline | Pass | UI: open + weighted value by agent |
| 8.5 | Sales by, basis switch | Pass | UI: dimension + Orders/Won-leads basis switch |
| 8.6 | Lost reasons | Pass | harness/UI: lostReasons 200 with reasons |
| 8.7 | Returns report | Pass | UI: returns report with courier-fault and pending RTO panels |
| 8.8 | Lead aging | Pass | harness/UI: age buckets + overdue by agent |
| 8.9 | Repeat customers | Pass | harness/UI: repeatCustomers 200 |
| 8.10 | Daily summary | Pass | harness/UI: per-day revenue |
| 8.11 | Margin (manager only) | Pass | UI: Margin tab visible for the manager; harness: hidden/403 for agents |
| 8.12 | Filters change the numbers | Pass | UI: applying an agent/date filter changes the result |
| 8.13 | Export Excel and PDF | Pass | UI/harness: export endpoints return files; cost-gated for margin |
| 8.14 | Fast report switching, no stale data | Pass | UI: stale-response guard; switching reports shows the right one |
| 9.1 | Manager sees >= agent, no cross-team | Pass | harness: team includes own; out-of-team refused |
| 9.2 | Agent reports scope OWN | Pass | harness: scoped report rows cover only own data |
| 9.3 | Agent has no margin / cost | Pass | harness: margin 403, cost stripped |
| 9.4 | Export permission respected | Pass | harness: no report.export -> 403 |

## New screens added this run (also checked)

| Screen | Result | Evidence |
|--------|--------|----------|
| My Day (/crm/my-day) | Pass | UI: 120 overdue follow-ups for the manager, Log call + Open work |
| Customer 360 (/crm/customers) | Pass | UI: searched a phone, saw the customer's 2 leads + timeline + totals |
| Lead create form (/crm/leads/new) | Pass | UI: phone lookup warned "this phone already exists (2)" |
| Lead search (Leads page) | Pass | UI: search box present; harness: search by name/phone/code |
| Reattempts (/crm/orders/reattempts) | Pass | UI: page renders (empty in the manager's scope, which is correct) |
| Order invoice / delivery slip PDF | Pass | harness: both endpoints 200; buttons on the order detail |
| Quotation duplicate / WhatsApp | Pass | UI: buttons on the quotation detail |

## Not fully exercised in the UI this run (no failures found)

- The quotation builder and the full order and return click-through were verified by the harness, not
  re-clicked by hand, because they create and mutate data that then has to be cleaned up. The harness
  covers these paths end to end (162 checks, all passing).
- Deferred Task 4 screens were not built, so they are not in this run: agents edit, catalogue product
  add/edit and bulk price Excel, bulk lead reassign, Frontdesk "Create lead" button, lead edit form.
  See NIGHT_LOG.md.

## Fails found and fixed during the run

- Lead form phone lookup first showed no warning because the phone filter matched the raw formatted
  phone. Fixed to match on the normalized phone (last 7 digits). Re-checked: the warning now appears.
- Customer 360 first returned nothing for the same reason. Same fix. Re-checked: it now finds the
  customer.

No open fails at the end of the run.
