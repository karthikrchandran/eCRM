# Reports Metric Inventory

Date: 2026-06-15
Status: Updated after read-only reports/dashboard implementation
Depends on: stable read models through Finance

## Purpose

Define report metrics and source fields. The current implemented slice covers live dashboard cards and a read-only `/reports` page for open pipeline, booked value excluding GST, pending receivables, collected payments, production pending, upcoming follow-ups, top clients, top products/services, top billings, collections, and recent booked orders.

Explicit exclusions for the implemented slice:

- Gross margin.
- Incentives pending approval.
- Incentives payable or paid.
- Payroll or commission reporting.

## Reporting Principles

- Reports must reuse tested calculation helpers from implementation slices.
- Currency metrics use INR.
- Sales target achievement uses booked order value excluding GST.
- Payment completion uses cumulative payments across invoices and orders.
- Ownership is reporting responsibility, not authorization.
- Sales users see company-wide report data unless a future Admin-only approval workflow requires a restricted action.

## CRM Core Metrics

| Metric | Source Needed | Notes |
| --- | --- | --- |
| Lead/customer count by state | Lead/customer state | Available after CRM Core. |
| Leads by owner | Lead/customer owner | Owner filter only, not visibility. |
| Upcoming follow-ups | Activity/follow-up due date and status | Should distinguish overdue, today, and upcoming. |
| Activity volume by type | Activity type and created/occurred date | Useful before opportunity reports exist. |
| Reassignment count | Ownership history | Helps audit handoffs. |

## Opportunity Metrics

| Metric | Source Needed | Notes |
| --- | --- | --- |
| Open pipeline value | Opportunity estimate and open stages | Exclude won/lost/dormant from open total. |
| Pipeline by stage | Opportunity stage | Needs ordered stages. |
| Won/lost conversion | Opportunity final state | Define date basis before implementation. |
| Opportunity aging | Created date and stage update history if available | Stage history may be deferred. |
| Target coverage | Sales target and forecast value | Forecast only until orders land. |

## Order And Production Metrics

| Metric | Source Needed | Notes |
| --- | --- | --- |
| Booked order value | Order booked value excluding GST | Drives target achievement. |
| Orders by customer/product/owner | Order, line item, product, owner | Requires product catalog. |
| Production pending | Line item stage instances | Count line items or stages consistently. |
| Production completion rate | Stage instance status | Define denominator in order plan. |
| Repeat customer orders | Lead/customer and order history | Do not collapse repeat orders into one customer status. |

## Finance Metrics

| Metric | Source Needed | Notes |
| --- | --- | --- |
| Pending receivables | Order total, invoices, payments | Reuse finance test matrix scenarios. |
| Collected payments | Payment records and period filters | Period filter needed before final report UI. |
| Uninvoiced work in progress | Order totals minus invoice totals | Finance workflow metric. |

Gross margin and incentive metrics are intentionally excluded from the current reports/dashboard implementation.

## Dashboard Card Readiness

| Card | Earliest Slice That Can Back It |
| --- | --- |
| Upcoming follow-ups | CRM Core |
| Open opportunities | Opportunities |
| Target progress | Opportunities for setup, Orders for actual achievement |
| Booked order value | Orders |
| Pending payments | Invoices/Payments |
| Collected payments | Invoices/Payments |
| Production pending | Orders/Production |

Incentive cards are intentionally excluded from the current dashboard.

## Implementation Guardrails

- Do not create report queries until source tables and helper functions are stable.
- Do not duplicate financial formulas inside dashboard components.
- Do not infer payment completion from invoice status alone.
- Do not include GST in booked target achievement.
- Do not hide company-wide metrics from Sales solely because they do not own the records.
- Do not treat CRM Core follow-ups as opportunity pipeline movement unless the opportunity slice defines that relationship.

