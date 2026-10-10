# Okasha Smart CRM — User Acceptance Test (UAT) Checklist

A step-by-step script the client can follow to accept the Sales CRM. Work top to bottom; tick **Pass**
or **Fail** for each row and add a note on any Fail. No technical knowledge is needed.

## Before you start

- **Where:** the Admin portal (ask us for the URL for your environment).
- **Test accounts** (both password `CrmTest!2026`):
  | Login | Who | Sees |
  |-------|-----|------|
  | `usama_liaqat@phw` | Sales agent (AG001) | **only their own** leads/quotes/orders/returns |
  | `usman_arshad@phw` | Sales manager (AG006) | **their team** (AG001 + AG003) |
- **“Scope”** is shown as a small chip on list and report pages (OWN / TEAM / ALL). It is the heart of
  the system: an agent must never see another agent’s data.
- **Cost & margin** are hidden unless your login has the cost permission. The manager account can see
  Margin; the agent account cannot (the Margin report simply won’t appear for them).
- Money is shown in whole rupees with thousands separators (e.g. `2,562,177`).

Legend: **Steps** → what to click. **Expected** → what you should see. Then tick ☐ Pass / ☐ Fail.

---

## 1. Login & navigation

| # | Steps | Expected | Pass | Fail |
|---|-------|----------|:----:|:----:|
|1.1| Log in as the **agent** | You land on a page you can access (CRM Leads), **not** a blank/404 | ☐ | ☐ |
|1.2| Open the top **CRM** menu | You see Leads, Kanban, Quotations, Orders, Returns, Catalogue, Agents, **Reports** | ☐ | ☐ |
|1.3| Log out, log in as the **manager** | Same menu; scope chips later read **TEAM** | ☐ | ☐ |

## 2. Catalogue

| # | Steps | Expected | Pass | Fail |
|---|-------|----------|:----:|:----:|
|2.1| CRM → Catalogue | Categories, products and bundles list; SKUs look like `OKS-LOCK-…`, `OKS-CAM-…` | ☐ | ☐ |
|2.2| Open any product’s prices | Prices show as **pending** (no number) until the real price list is loaded — **no invented prices** | ☐ | ☐ |
|2.3| As the **agent**, look for any cost/margin column | **Not shown** (cost is hidden without permission) | ☐ | ☐ |

## 3. Agents

| # | Steps | Expected | Pass | Fail |
|---|-------|----------|:----:|:----:|
|3.1| CRM → Agents | AG001–AG008 listed, mapped to real staff names, each with a scope (OWN/TEAM/ALL) | ☐ | ☐ |
|3.2| Confirm the manager (AG006) leads AG001 and AG003 | Team relationship is correct | ☐ | ☐ |

## 4. Leads

| # | Steps | Expected | Pass | Fail |
|---|-------|----------|:----:|:----:|
|4.1| As **agent**, CRM → Leads | Scope chip = **OWN**; you see only your own leads | ☐ | ☐ |
|4.2| As **manager**, CRM → Leads | Scope chip = **TEAM**; you see AG001 + AG003 + your own leads (more than the agent saw) | ☐ | ☐ |
|4.3| Click a lead row | The lead detail opens (customer, phone, city/area, stage, value, timeline) | ☐ | ☐ |
|4.4| On the detail, add an activity (note/call) | It appears in the merged timeline immediately | ☐ | ☐ |
|4.5| Change the stage forward (e.g. Contacted → Qualified) | Stage updates; timeline records it | ☐ | ☐ |
|4.6| Try to move a lead to **Lost** without a reason | Blocked until you give a reason | ☐ | ☐ |
|4.7| As the **agent**, try to open a lead that belongs to another agent (ask us for a link) | **Refused** (you cannot see out-of-scope data) | ☐ | ☐ |
|4.8| CRM → Leads → **Kanban** | Leads grouped in columns by stage; counts look right | ☐ | ☐ |
|4.9| Check the imported leads | Dates are correct (no “off by one day”); cities are real PK cities (not everything “Lahore”); addresses/notes populated | ☐ | ☐ |

## 5. Quotations

| # | Steps | Expected | Pass | Fail |
|---|-------|----------|:----:|:----:|
|5.1| From a lead, create a quotation | A quotation number `Q-0001`-style is generated | ☐ | ☐ |
|5.2| Add line items with quantity, price and a discount | Subtotal, discount and total compute correctly | ☐ | ☐ |
|5.3| Create a **new version** of the same quotation | Same quotation number, new version; only one version is “active” | ☐ | ☐ |
|5.4| Mark a version **Sent** | Status updates; the linked lead moves to **Quotation** stage (check the lead timeline) | ☐ | ☐ |
|5.5| Download the **PDF** | Okasha Smart letterhead, phone **0301 0444888**, quotation no + version + dates, customer block, items, totals in PKR, terms, signature line; clean black/grey | ☐ | ☐ |
|5.6| Try to add a line for a product whose price is still **pending**, with no price typed | Blocked (you must enter a price) | ☐ | ☐ |

## 6. Orders

| # | Steps | Expected | Pass | Fail |
|---|-------|----------|:----:|:----:|
|6.1| Convert an **Accepted** quotation to an order | Order `SO-0001`-style created with the quote’s lines | ☐ | ☐ |
|6.2| Open the order | Shows channel, external/Shopify order no, courier, CN/tracking, payment type + amount received, delivery city/area/address, dispatch/delivered dates | ☐ | ☐ |
|6.3| Move the order through its stages (Confirmed → Packed → Dispatched → Delivered) | Each step allowed in order; the linked lead becomes **Won** at Confirmed-or-later (check lead timeline) | ☐ | ☐ |
|6.4| On a Dispatched order, use **Reattempt** | Re-attempt recorded | ☐ | ☐ |

## 7. Returns

| # | Steps | Expected | Pass | Fail |
|---|-------|----------|:----:|:----:|
|7.1| From a Dispatched/Delivered order, create a **return** with a reason | Return `RET-0001`-style created; the order is marked Returned | ☐ | ☐ |
|7.2| Move the return REPORTED → RECEIVED_BACK → RESTOCKED | Each step allowed; a DAMAGED outcome asks for a note | ☐ | ☐ |
|7.3| Try to create a return with **no reason** | Blocked | ☐ | ☐ |

## 8. Reports (CRM → Reports)

Use the **filter bar** (date range, company, channel, agent, outlet, city) then **Apply**. Switch
reports from the left list. Every report should respect your **scope** chip.

| # | Report | Expected | Pass | Fail |
|---|--------|----------|:----:|:----:|
|8.1| **Dashboard** | Lead counts, Won, **“Won value (estimated, from leads)”**, conversion %, pipeline value, overdue follow-ups, delivered orders, returns + rate % | ☐ | ☐ |
|8.2| **Agent performance** | One row per agent: leads, won, value, conversion %, avg days-to-close, overdue, target % — within your scope | ☐ | ☐ |
|8.3| **Lead funnel** | Stage-by-stage counts with drop-off % | ☐ | ☐ |
|8.4| **Pipeline** | Open value and weighted value, by stage and by agent | ☐ | ☐ |
|8.5| **Sales by…** | Change the dimension (product/category/channel/city/outlet). Toggle the **basis**: *Orders (delivered)* vs *Won leads*. Product/category show a note on the Won-leads basis | ☐ | ☐ |
|8.6| **Lost reasons** | Lost leads grouped by reason with value | ☐ | ☐ |
|8.7| **Returns** | Returns, delivered orders **(excl. imports)**, rate %, RTO value with a **“pending price”** count; panels by reason, **courier fault by courier**, courier, city, month | ☐ | ☐ |
|8.8| **Lead aging & follow-up** | Age buckets (0-7 / 8-30 / 31-60 / 60+) and overdue follow-ups per agent | ☐ | ☐ |
|8.9| **Repeat customers** | Customers (by phone) with more than one won/delivered | ☐ | ☐ |
|8.10| **Daily summary** | Per-day leads / won / delivered / revenue / returns | ☐ | ☐ |
|8.11| **Margin** (manager only) | Revenue, cost, margin, margin %, pending-cost lines. **Agent login: this report is not shown** | ☐ | ☐ |
|8.12| **Filters** | Pick an agent or a date range and Apply — numbers change accordingly | ☐ | ☐ |
|8.13| **Export** | On any report, **Export Excel** and **Export PDF** download a file; PDF is clean black/grey with the Okasha Smart heading | ☐ | ☐ |
|8.14| **Switching reports fast** | Click several reports quickly — the panel always shows the one you landed on (no stale/old numbers) | ☐ | ☐ |

## 9. Scope & permissions (the critical acceptance gate)

| # | Steps | Expected | Pass | Fail |
|---|-------|----------|:----:|:----:|
|9.1| Compare lead/quote/order counts between the **agent** and the **manager** | Manager always sees **≥** the agent (team ⊇ own); neither sees other teams | ☐ | ☐ |
|9.2| As the **agent**, every report’s scope chip | Reads **OWN**; totals only cover their own data | ☐ | ☐ |
|9.3| As the **agent**, the **Margin** report and any cost/margin figure | **Not available** | ☐ | ☐ |
|9.4| Export as the **agent** | Allowed only if they have export permission; otherwise refused (no silent empty file) | ☐ | ☐ |

---

## Notes / defects found

_Record the row number, what you did, and what you saw._

| Row | What happened | Severity |
|-----|---------------|----------|
|     |               |          |
|     |               |          |

---

### Known, by-design behaviours (not defects)
- **Catalogue prices are blank/pending** until the Shopify price export is loaded — intentional (no
  invented prices).
- The **imported returns** (Sept 2026) are mostly online-store customers who are **not** in the lead
  register, so only a couple link to a lead by phone, and their RTO value shows as **pending price**
  until catalogue prices exist (then it is backfilled by product match).
- The **returns rate** excludes the historical orders created by the returns import, so it reflects
  real delivered orders only.
