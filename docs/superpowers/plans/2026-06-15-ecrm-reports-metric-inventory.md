# Reports Metric Inventory

Date: 2026-06-15
Status: Planning-only while CRM Core is active
Depends on: stable read models from CRM Core and later slices

## Purpose

Define report metrics and source fields early without building queries against unstable tables.

## Reporting Principles

- Reports must reuse tested calculation helpers from implementation slices.
- Currency metrics use INR.
- Sales target achievement uses booked order value excluding GST.
- Payment completion uses cumulative payments across invoices and orders.
- Incentive readiness requires full payment receipt and approved/finalized costs.
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

## Finance And Incentive Metrics

| Metric | Source Needed | Notes |
| --- | --- | --- |
| Pending receivables | Order total, invoices, payments | Reuse finance test matrix scenarios. |
| Collected payments | Payment records and period filters | Period filter needed before final report UI. |
| Uninvoiced work in progress | Order totals minus invoice totals | Finance workflow metric. |
| Gross margin | Booked value excluding GST minus approved costs | Draft costs excluded. |
| Incentives pending approval | Calculated incentive and approval status | Admin action, Sales visibility. |
| Incentives payable | Full payment plus approved incentive | Avoid payout before full payment. |

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
| Incentives pending | Costs/Incentives |

## Implementation Guardrails

- Do not create report queries until source tables and helper functions are stable.
- Do not duplicate financial formulas inside dashboard components.
- Do not infer payment completion from invoice status alone.
- Do not include GST in booked target achievement.
- Do not hide company-wide metrics from Sales solely because they do not own the records.
- Do not treat CRM Core follow-ups as opportunity pipeline movement unless the opportunity slice defines that relationship.

