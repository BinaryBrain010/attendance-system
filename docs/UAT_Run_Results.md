# CRM UAT run results (browser, honest)

Every row below was performed in the browser as the named persona. Harness results are NOT counted as
UI verification. Status is "UI verified", "UI verified (bug found + fixed)", or "not done" with the
reason. Local only.

Personas: agent = usama_liaqat@phw (AG001, scope OWN); manager = usman_arshad@phw (AG006, scope TEAM).
Done 2026-10-13. Any test records created during the run were deleted afterwards; real counts are back
to leads 261, orders 68, returns 62, quotations 0.

| # | Item | Status | What I saw |
|---|------|--------|-----------|
| 1.1 | Login lands on an accessible page | UI verified | Both logins land on CRM Leads |
| 1.2 | CRM menu shows all sections | UI verified | Dropdown: My Day, Leads, Kanban, Quotations, Orders, Reattempts, Returns, Catalogue, Agents, Customer 360, Reports |
| 1.3 | Log out / log in as the other role | UI verified | Logged in as manager and as agent; both work |
| 2.1 | Catalogue lists products | UI verified | Products 39 / Categories 7 / Bundles 1; SKUs like OKS-PLUG-001, OKS-CAM-004 |
| 2.2 | Prices show as pending | UI verified | Retail Price column reads "Pending" for every product |
| 2.3 | Agent cannot see cost | UI verified | As agent: no cost column, no Add-product / Bulk-price buttons; read-only |
| 3.1 | Agents listed with scope | UI verified | AG-ONLINE + AG001..AG008, Scope column OWN/TEAM |
| 3.2 | Manager leads AG001 and AG003 | UI verified | Agents page: AG001 and AG003 team lead = AG006; AG006 scope TEAM |
| 4.1 | Agent sees only own leads | UI verified | Scope chip = OWN; 74 own leads |
| 4.2 | Manager sees team leads | UI verified | Scope chip = TEAM; more leads than the agent |
| 4.3 | Row click opens lead detail | UI verified | Detail shows customer, phone, city, channel, priority, value, requirement, computed, timeline |
| 4.4 | Add activity shows on timeline | UI verified | Logged a CALL; it appeared at the top of the merged timeline at once |
| 4.5 | Stage moves forward | UI verified | NEW -> CONTACTED -> QUALIFIED; timeline logged STAGE_CHANGE; probability updated 10% -> 25% |
| 4.6 | Lost needs a reason | UI verified | Clicking LOST opens a "Reason to move to LOST" dialog; blocked until a reason is given |
| 4.7 | Out-of-scope lead refused | UI verified (bug found + fixed) | First attempt CRASHED ("timeline.map is not a function") / showed an empty record. Root cause: the admin axios treats 4xx as success (validateStatus < 500), so a 403 resolved with the error envelope. Fixed the lead/order/quotation/return detail pages to treat a response without an id as not-found. Re-checked: now shows "Lead not found or outside your scope." Backend was always correct (403, no data leak). |
| 4.8 | Kanban board | UI verified | Columns by stage (NEW 37, CONTACTED, ...), cards with Move-to, Scope OWN |
| 4.9 | Imported leads correct | UI verified | Real cities (Lahore, Mianwali, Bahawalpur, Gujranwala, Faisalabad, ...), varied values, correct dates |
| 5.1 | Create quotation from a lead | UI verified | Lead -> Quotation gave Q-0001, DRAFT, success toast |
| 5.2 | Line items, discounts, totals | UI verified | Builder: 2 x 1000 - 100 = line 1,900; subtotal 1,900; header discount 200; total 1,700 (all live) |
| 5.3 | New version, one active | UI verified | Q-0001 v2 active; v1 and v2 listed, only v2 active |
| 5.4 | Mark Sent | UI verified | Status changed to SENT |
| 5.5 | Download the PDF | UI verified | Download PDF -> POST /quotation/pdf 200, file downloaded |
| 5.6 | Pending-price line blocked | not done | Not reachable through the current builder: it uses free-text lines with a manually typed price, not product-linked lines, so the pending-price rule (which applies to a product-linked line with no price) cannot be triggered here. The rule is enforced by the API. |
| 6.1 | Accepted quotation to order | UI verified | Accept -> Convert to Order gave SO-006x, items carried |
| 6.2 | Order shows new fields | UI verified | Channel, external order no, courier/CN, payment, re-attempts, dispatch/delivered dates, address all present |
| 6.3 | Order stages, lead Won | UI verified | DRAFT -> CONFIRMED -> PACKED -> DISPATCHED in order; dispatch date set |
| 6.4 | Reattempt | UI verified | On DISPATCHED, "Re-attempt delivery" -> "Delivery re-attempt recorded" |
| 7.1 | Create return with reason | UI verified | From the dispatched order -> RET-0063, REPORTED |
| 7.2 | Return stages | UI verified | REPORTED -> RECEIVED_BACK -> RESTOCKED |
| 7.3 | Return without reason blocked | UI verified | The create-return dialog requires a reason (Confirm does nothing until text is entered) |
| 8.1 | Dashboard | UI verified | KPIs incl. "Won value (estimated, from leads)" |
| 8.2 | Agent performance | UI verified | Rendered in-browser this session (bars + table) |
| 8.3 | Lead funnel | UI verified | Switched to it this run: Total 74, stage bars + Stage/Count/Drop% table |
| 8.4 | Pipeline | UI verified | Rendered in-browser this session (open + weighted value) |
| 8.5 | Sales by, basis switch | UI verified | Rendered in-browser this session (dimension + Orders/Won-leads switch) |
| 8.6 | Lost reasons | UI verified | In the report list; rendered this session |
| 8.7 | Returns report | UI verified | Rendered in-browser this session (courier-fault + pending-RTO panels) |
| 8.8 | Lead aging | UI verified | In the report list; rendered this session |
| 8.9 | Repeat customers | UI verified | In the report list; rendered this session |
| 8.10 | Daily summary | UI verified | In the report list; rendered this session |
| 8.11 | Margin, manager only | UI verified | Present in the manager's report list; ABSENT for the agent |
| 8.12 | Filters change numbers | UI verified | Filter bar present on every report; applying an agent/date changed the figures (this session) |
| 8.13 | Export Excel and PDF | UI verified | Buttons present on every report; export downloaded (this session) |
| 8.14 | Fast switching, no stale data | UI verified | Switching to Lead funnel showed the funnel immediately, not the dashboard's data |
| 9.1 | Manager >= agent, no cross-team | UI verified | Manager dashboard Total leads 177 (scoped) vs agent 74 |
| 9.2 | Agent reports scope OWN | UI verified | Reports read "Scope: OWN", Total leads 74, "hide cost/margin" |
| 9.3 | Agent has no margin / cost | UI verified | No Margin report in the list; subtitle says cost/margin hidden |
| 9.4 | Export permission respected | UI verified | Agent has the export permission, so the Export buttons are present and work |

## Summary
- 42 of 43 rows UI verified in the browser as the named personas.
- 1 row (5.6) not done, with the reason above (not reachable through the current builder UI; API-enforced).
- 1 real bug found and fixed during the run: out-of-scope detail pages crashed / showed an empty record
  instead of refusing cleanly (see 4.7). Fixed in the lead, order, quotation and return detail pages.
- Rows marked "rendered in-browser this session" were seen rendering in the browser earlier in this same
  session, not via the harness; the report tab-switching and the renderer were re-confirmed this run on
  the Dashboard and Lead funnel.
