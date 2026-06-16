# Reports And Live Dashboard Design

Date: 2026-06-15
Status: Approved for implementation

## Purpose

Replace the placeholder dashboard metrics with live read-only business metrics and add a `/reports` page for operational summaries. Reports should use the source models that have now landed through Finance, while avoiding new schema work and avoiding formula duplication.

## Approved Scope

Dashboard summary cards:

- Open opportunities.
- Pipeline value.
- Booked value excluding GST.
- Pending receivables.
- Collected payments.
- Production pending.
- Upcoming follow-ups.

Reports page sections:

- Top clients by booked order value excluding GST.
- Top products/services by booked order value excluding GST.
- Top billings by order/customer, ranked by booked order value excluding GST.
- Collections summary from actual payment records.
- Recent booked orders.
- Open pipeline by stage.
- Production pending list.

## Explicit Exclusions

- Gross margin reports.
- Incentives pending approval.
- Incentive payout, payroll, or commission reporting.
- New Prisma models, migrations, seed data, or write workflows.
- PDF, CSV, or accounting exports.

## Metric Definitions

Booked value:

- Use `Order.subtotalPaisa`.
- Exclude GST by design.
- Exclude cancelled orders from current booked-value summaries.

Top clients:

- Group non-cancelled orders by `Order.leadCustomerId`.
- Sum `Order.subtotalPaisa`.
- Display client name, order count, and booked value excluding GST.

Top products/services:

- Group order line items by `OrderLineItem.productNameSnapshot`.
- Sum `OrderLineItem.lineSubtotalPaisa`.
- Count line items and parent orders.
- Exclude line items from cancelled orders.

Top billings:

- Rank individual non-cancelled orders by `Order.subtotalPaisa`.
- Display order number, customer, owner, booked value excluding GST, and order status.

Collections:

- Use `Payment.amountPaisa` and `Payment.paymentDate`.
- Pending receivables use order totals and cumulative payments through the existing finance calculation helpers.
- Collected payments are based on actual payment rows, not invoice status.

Pipeline:

- Open opportunities are opportunities whose stage is not won or lost.
- Pipeline value sums `Opportunity.estimatedValuePaisa` for open opportunities.
- Pipeline by stage groups open opportunities by current stage.

Production:

- Production pending counts `ProductionWorkItem` rows not in final completed/cancelled states.
- The reports page shows recent pending work with order, line item/product, stage/work status, and customer context where available.

Follow-ups:

- Upcoming follow-ups are open `Activity` rows with a future `dueAt`.
- Dashboard count should not include completed or cancelled activities.

## Permissions

- `ADMIN` and `SALES` can view dashboard and report data company-wide.
- Owner is a filter/display dimension, not a security boundary.
- Reports are read-only. They must not expose Admin-only mutation controls.

## Architecture

Create a reports server module that owns read-model queries and formatting-independent calculations:

- `src/server/reports/types.ts` defines dashboard and report read models.
- `src/server/reports/permissions.ts` enforces company-wide report visibility for Admin and Sales.
- `src/server/reports/queries.ts` loads dashboard summaries and report sections from landed Prisma models.
- `src/server/reports/queries.test.ts` covers metric definitions using mocked database adapters.

Wire the UI through server-rendered app routes:

- `src/app/(app)/dashboard/page.tsx` loads live dashboard data and renders summary cards.
- `src/app/(app)/reports/page.tsx` loads reports data and renders read-only tables.
- `src/components/reports/report-formatters.ts` formats INR paise and dates for dashboard and reports.

## Testing

Use focused unit tests for query aggregation and Playwright smoke for the visible workflows:

- Dashboard shows non-zero live seeded metrics instead of hard-coded zeros.
- Reports route is accessible from navigation.
- Reports page shows top clients, top products/services, top billings, collections, pipeline, and production sections.
- Sales can view reports but sees no mutation controls.

Final verification must include:

- `npx prisma validate`
- `npm run prisma:generate`
- `npm run test`
- `npm run gate`
- `npm run test:e2e`
- `git diff --check`
