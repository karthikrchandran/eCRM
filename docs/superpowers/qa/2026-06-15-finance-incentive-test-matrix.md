# Finance And Incentive Test Matrix

Date: 2026-06-15
Status: Planning artifact for later finance, payments, costs, and incentive slices

## Purpose

This matrix captures the financial business rules that should be converted into unit, integration, and browser tests when the order, invoice, payment, cost, and incentive modules are implemented.

## Assumptions

- Currency is INR.
- Booked value and target achievement use amounts excluding GST.
- GST defaults to 18 percent but is stored per line item and can be overridden to 0 percent or another supported rate.
- Payment completion is tracked cumulatively at order level, even when the order has multiple invoice records.
- Incentive is 5 percent of gross margin.
- Gross margin is booked order value excluding GST minus approved cost components.
- Incentive becomes payable only after full payment receipt for the order.
- Admin approves, rejects, or overrides incentive payouts in the MVP.

## Matrix

| ID | Scenario | Setup | Expected Result | Level | Notes |
| --- | --- | --- | --- | --- | --- |
| FIN-001 | Default GST calculation | One order line: base INR 100,000, GST 18 percent | GST INR 18,000, total INR 118,000, booked value INR 100,000 | Unit | Test line total helper before UI exists. |
| FIN-002 | Zero GST override | One order line: base INR 100,000, GST 0 percent | GST INR 0, total INR 100,000, booked value INR 100,000 | Unit | Required for product/location exceptions. |
| FIN-003 | Lower GST override | One order line: base INR 100,000, GST 5 percent | GST INR 5,000, total INR 105,000 | Unit | Confirms rate is line-stored, not globally inferred. |
| FIN-004 | Multi-line order totals | eLearning INR 100,000 at 18 percent plus VR INR 200,000 at 0 percent | Booked value INR 300,000, GST INR 18,000, total INR 318,000 | Unit | Prevents mixing GST into booked sales value. |
| FIN-005 | Single invoice full payment | Order total INR 118,000, one invoice INR 118,000, one payment INR 118,000 | Invoice paid, order fully paid, collected amount INR 118,000 | Integration | Payment status visible to Admin and Sales. |
| FIN-006 | Installment payments | One invoice INR 118,000, payments INR 50,000 and INR 68,000 | Partial after first payment, full after second payment | Integration | Payment completion should not depend on one payment row. |
| FIN-007 | Split invoices cumulative payment | Order total INR 236,000, invoices INR 118,000 and INR 118,000, payments against each | Order full payment only when cumulative paid amount reaches INR 236,000 | Integration | Each invoice can be complete independently; order aggregates all. |
| FIN-008 | Overpayment warning | Order total INR 118,000, payment attempt INR 120,000 | Save is blocked or explicit warning path is required | Integration | Spec says payment totals cannot silently exceed expected totals. |
| FIN-009 | Pending receivables | Order total INR 236,000, paid INR 118,000 | Pending receivable INR 118,000 | Unit + Integration | Drives dashboard pending payments card. |
| FIN-010 | Collected payments | Two paid orders with payments INR 100,000 and INR 50,000 | Collected amount INR 150,000 for selected period | Unit + Integration | Period filters should be added when reporting lands. |
| FIN-011 | Uninvoiced work in progress | Order booked INR 300,000, invoices total INR 100,000 | WIP/uninvoiced amount INR 200,000 | Unit + Integration | Finance workflow says work in progress means not invoiced yet. |
| FIN-012 | Approved vendor cost reduces margin | Booked value ex-GST INR 300,000, approved vendor cost INR 80,000 | Gross margin INR 220,000 | Unit | Use only approved/finalized costs in payout calculation. |
| FIN-013 | Multiple approved costs | Booked value INR 300,000; vendor 80,000, shipping 10,000, printing 20,000, travel 5,000, misc 5,000 | Gross margin INR 180,000 | Unit | Cost categories should be configurable enough for these labels. |
| FIN-014 | Draft cost excluded | Booked value INR 300,000; approved cost 80,000; draft cost 20,000 | Gross margin INR 220,000 until draft is approved | Unit + Integration | Sales cannot finalize costs. |
| FIN-015 | Incentive base calculation | Gross margin INR 220,000 | Incentive INR 11,000 | Unit | 5 percent of gross margin. |
| FIN-016 | No payout before full payment | Incentive calculated INR 11,000, order paid INR 117,999 of INR 118,000 | Incentive status remains not payable | Unit + Integration | Use exact minor-unit handling once amount storage is chosen. |
| FIN-017 | Payout after full payment | Incentive calculated INR 11,000, order fully paid | Incentive becomes ready for Admin approval or payout | Integration | Payment receipt is the trigger. |
| FIN-018 | Primary salesperson default split | Order owner is one salesperson, no split rows | 100 percent incentive assigned to primary owner | Unit | Supports simple small-team workflow. |
| FIN-019 | Two-person split | Incentive INR 10,000; split 60 percent and 40 percent | Recipients get INR 6,000 and INR 4,000 | Unit + Integration | Validate split total equals 100 percent. |
| FIN-020 | Invalid split total | Split rows total 90 percent or 110 percent | Save is rejected with validation error | Integration | Prevent silent payout leakage. |
| FIN-021 | Admin override amount | Calculated incentive INR 10,000; Admin overrides to INR 8,000 with reason | Stored payout uses override amount and captures approver, timestamp, reason | Integration | Audit-friendly admin override. |
| FIN-022 | Sales cannot approve incentive | Sales user attempts incentive approval | Action rejected or control hidden; server rejects regardless of UI | Integration + E2E | Permission helper plus server action validation. |
| FIN-023 | Admin can approve incentive | Admin approves ready incentive | Status changes to approved with approver metadata | Integration + E2E | Browser smoke can cover final approval path. |
| FIN-024 | Negative margin | Booked value INR 100,000, approved costs INR 120,000 | Gross margin INR -20,000, incentive INR 0 unless Admin override exists | Unit | Avoid negative default incentive. |
| FIN-025 | Repeat orders same customer | Same lead/customer has two fully paid orders | Collections and incentives aggregate by order while customer history shows both | Integration | Prevent customer-level payment state from overwriting repeat orders. |

## Gate Expectations For Future Slices

- Unit tests should cover all pure calculations before UI work starts.
- Integration tests should prove Admin/Sales permission boundaries on costs and approvals.
- Browser smoke should cover one happy path from order to invoice, payment, cost entry, and incentive readiness once those modules exist.
- Reports should reuse tested calculation helpers instead of duplicating formulas inside pages.
