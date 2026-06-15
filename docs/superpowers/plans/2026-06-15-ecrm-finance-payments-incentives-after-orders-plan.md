# Finance, Payments, Costs, And Incentives After Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL AFTER UNBLOCK: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the finance workflow after Orders/Production lands: invoice records, payments, cumulative order payment completion, cost components, gross margin, 5 percent incentive calculation, split support, and Admin approval.

**Architecture:** Orders/Production has landed with stable order, order-line, production-stage, proposal, product/service, owner, and split contracts. Finance records attach to `Order` and optionally `OrderLineItem`; calculations are server-owned, stored in INR paise and basis points, and exposed through Admin-managed workflows with company-wide payment status visibility.

**Tech Stack:** Next.js App Router, React, TypeScript, Prisma, Postgres, Zod, Vitest, Testing Library, Playwright, Tailwind CSS.

---

## Status

Implementation status: **READY TO START** on `feature/finance-payments-incentives`.

Orders/Production has landed and this plan has been refreshed against the actual source contracts. Finance is now the only active schema-owning implementation lane. Parallel work may prepare docs-only reports/dashboard notes, but no other lane should edit `prisma/**`, `src/**`, `tests/**`, package files, config files, seed data, or migrations until Finance lands.

Upstream contracts already landed:

- CRM Core: `LeadCustomer`, `Branch`, `Contact`, `Activity`, `User`, owner assignment, reassignment history, and company-wide Admin/Sales visibility.
- Opportunities: `Opportunity`, pipeline stages, opportunity owner, opportunity splits, target setup, opportunity detail route, and split validation.

Additional upstream contracts now landed:

- Products/Proposals: `ProductService`, GST defaults, `Proposal`, `ProposalLineItem`, commercial snapshots, accepted proposal context, and `ProposalPdfAttachment`.
- Orders/Production: `Order`, `OrderLineItem`, `OrderOwnerSplitSnapshot`, `ProductionTemplate`, `ProductionTemplateStage`, `ProductionWorkItem`, `ProductionStageInstance`, and `ProductionNote`.

## Blocking Contract

The Orders/Production blocking contract is now resolved:

- Order primary key and model name: `Order.id`.
- Order line model: `OrderLineItem.id`.
- Order relations: `proposalId`, `opportunityId`, `leadCustomerId`, optional `branchId`, primary `ownerId`, and `splitSnapshots`.
- Order split source for incentive attribution: `OrderOwnerSplitSnapshot` rows. If no split snapshots exist, use `Order.ownerId` as the 100 percent recipient.
- Order status lifecycle: `DRAFT`, `BOOKED`, `IN_PRODUCTION`, `READY_FOR_DELIVERY`, `DELIVERED`, `CANCELLED`. Finance calculations must block new invoice/payment/cost/incentive writes for `CANCELLED` orders. Historical finance records must be voided/rejected rather than deleted.
- Booked value excluding GST: `Order.subtotalPaisa`.
- GST value: `Order.gstPaisa`.
- GST-inclusive total: `Order.totalPaisa`.
- Order line amounts: `OrderLineItem.lineSubtotalPaisa`, `lineGstPaisa`, and `lineTotalPaisa`.
- Product/service snapshots: `OrderLineItem.productNameSnapshot`, `productCategorySnapshot`, and `productionTemplateKeySnapshot`.
- Production visibility: `OrderLineItem.productionWorkItems[]` on order detail and `ProductionWorkItem.status`/`ProductionStageInstance.status` in the production module. Finance does not block on production completion in this slice.
- Stable order detail route for finance entry points and revalidation: `/orders/[orderId]`.
- Stable order list route: `/orders`.
- Permission convention: read visibility follows `canViewCompanyRecords()` for Admin and Sales; finance writes are Admin-only.
- Seed status: there is a seeded accepted proposal (`seed_proposal_acme_lms_accepted`) but no seeded `Order` row. Finance e2e should create/book an order through the supported UI flow before exercising finance, or Task 2 may add deterministic order seed data if needed.

## Scope

Included after unblock:

- Invoice records against orders.
- Multiple invoices per order.
- Payment records against an invoice and order context.
- One-time and installment payments.
- Cumulative order payment completion across all invoice/payment records.
- Pending receivables and collected amount calculations.
- Uninvoiced work-in-progress calculation.
- Admin-managed cost components at order or order-line level.
- Approved-cost-only gross margin calculation.
- Default incentive rate of 5 percent, stored as `500` basis points.
- Incentive split support for one or more salespeople.
- Primary salesperson receives 100 percent by default when no split rows exist.
- Incentive readiness only after full payment receipt.
- Admin approval, rejection, override, and payout-state tracking.
- Focused calculation, permission, integration, and browser smoke tests after unblock.

Excluded from this slice:

- Creating orders or production stages.
- Changing opportunity/proposal/product contracts except through the landed Orders/Production handoff.
- Invoice PDF generation.
- Payment gateway integration.
- Accounting export.
- Payroll disbursement automation.
- Reports dashboards beyond returning tested read models for later reports.
- Destructive deletes of finance, cost, payment, or incentive history.

## Financial Rules

Currency and amount storage:

- Currency is INR.
- Store money in integer paise.
- Store rates as integer basis points. Example: 5 percent is `500`.
- Booked order value and target achievement use amounts excluding GST.
- GST is part of invoice/payment collection totals, but incentive base uses order value excluding GST.

Invoice rules:

- One order may have one or many invoices.
- Invoice records store invoice number, invoice date, due date, subtotal excluding GST, GST amount, total amount, status, and notes.
- Invoice PDF generation is deferred.
- Invoice totals must not exceed the order total unless Admin uses an explicit override path with reason.
- Invoice subtotal/GST/total must be calculated from supplied finance allocation fields or copied from order totals; the server is the source of truth.

Payment rules:

- Payments store amount, payment date, mode, reference, invoice allocation, order context, created-by metadata, and notes.
- Payments can be one-time or installments.
- Order payment completion is cumulative across invoices and payments.
- An invoice can be paid while the order remains partially paid if other invoices remain unpaid.
- Payment totals cannot silently exceed expected invoice/order totals. Either block the save or require an explicit Admin overpayment acknowledgement with reason.
- Payment status is visible company-wide to Admin and Sales users.

Cost rules:

- Admin can add cost components against an order or an order line item.
- Suggested categories: external vendor, shipping, printing, travel, platform/subscription, freelance/contractor, misc.
- Cost statuses are `DRAFT`, `APPROVED`, `REJECTED`, and `VOID`.
- Gross margin uses only approved cost components.
- Draft, rejected, and void costs do not reduce margin.
- Sales users can view approved finance status if business visibility requires it, but they cannot approve costs.

Gross margin and incentive rules:

- `grossMarginPaisa = orderBookedValueExGstPaisa - approvedCostTotalPaisa`.
- `defaultIncentiveRateBps = 500`.
- `calculatedIncentivePaisa = max(0, round(grossMarginPaisa * defaultIncentiveRateBps / 10000))`.
- Negative margin produces zero default incentive unless Admin explicitly overrides with reason.
- Incentive is not payable until cumulative order payment reaches the order total.
- Default incentive recipient is the primary salesperson.
- Optional split rows distribute incentive by percentage across multiple salespeople.
- Split totals must equal 100 percent.
- Admin can approve, reject, or override incentive payout amount with approver, timestamp, and reason metadata.

## Future File Structure After Unblock

These are future implementation targets, not files to edit while this plan is blocked:

- Modify: `prisma/schema.prisma`
  Add invoice, payment, cost component, incentive, and incentive split models after confirming landed Order/Production relation names.
- Create migration under `prisma/migrations/**`
  Add finance tables, indexes, status enums, and foreign keys after schema review.
- Modify: `prisma/seed.ts`
  Add deterministic invoice/payment/cost/incentive seed data only if this slice also adds deterministic order setup. Otherwise keep browser smoke responsible for booking an order through the supported UI.
- Create: `src/server/finance/types.ts`
  Define invoice, payment, cost, incentive, status, and read-model types.
- Create: `src/server/finance/calculations.ts`
  Implement pure calculations for invoice totals, cumulative payments, receivables, approved costs, gross margin, and incentives.
- Create: `src/server/finance/validators.ts`
  Validate invoice, payment, cost, incentive split, approval, rejection, and override inputs.
- Create: `src/server/finance/permissions.ts`
  Define Admin write permissions and company-wide read permissions.
- Create: `src/server/finance/queries.ts`
  Load order finance summary, invoice list, payment history, cost list, and incentive status.
- Create: `src/server/finance/mutations.ts`
  Create/update invoice records, record payments, manage cost components, recalculate incentive snapshots, and record Admin approvals.
- Create: `src/server/finance/actions.ts`
  Server actions for forms and status transitions.
- Create: focused tests beside each server module.
- Create: `src/components/finance/invoice-form.tsx`
  Invoice create/edit form for Admin.
- Create: `src/components/finance/payment-form.tsx`
  Payment recording form with cumulative status preview.
- Create: `src/components/finance/cost-component-form.tsx`
  Admin cost entry and approval controls.
- Create: `src/components/finance/incentive-panel.tsx`
  Gross margin, calculated incentive, split recipients, readiness, and approval controls.
- Create: `src/components/finance/order-finance-summary.tsx`
  Order-level invoice, payment, receivable, cost, margin, and incentive summary.
- Modify: landed order detail route or component
  Add finance entry points after confirming the route name.
- Create or modify: `tests/e2e/finance.spec.ts`
  Browser smoke for invoice, payment, cost, and incentive readiness after orders exist.

## Recommended Data Model

Use exact names only after checking the landed Orders/Production code. Suggested names:

- `Invoice`
- `Payment`
- `PaymentAllocation`
- `CostComponent`
- `Incentive`
- `IncentiveSplit`

Recommended `Invoice` fields:

- `id`: stable generated identifier.
- `orderId`: required relation to `Order`.
- `invoiceNumber`: required display identifier, unique or company-unique based on final order model.
- `invoiceDate`: required date.
- `dueDate`: optional date.
- `status`: `DRAFT`, `ISSUED`, `PARTIALLY_PAID`, `PAID`, `VOID`.
- `subtotalPaisa`: amount excluding GST.
- `gstPaisa`: GST amount.
- `totalPaisa`: invoice total.
- `notes`: optional internal notes.
- `createdById`, `updatedById`, `voidedById`: `User` references as needed.
- `voidReason`: required when status becomes `VOID`.
- `createdAt`, `updatedAt`: timestamps.

Recommended `Payment` fields:

- `id`: stable generated identifier.
- `orderId`: required relation to `Order`.
- `paymentDate`: required date.
- `amountPaisa`: positive amount.
- `mode`: `BANK_TRANSFER`, `UPI`, `CHEQUE`, `CASH`, `CARD`, `OTHER`.
- `reference`: optional transaction/reference number.
- `notes`: optional internal notes.
- `createdById`: `User` reference.
- `createdAt`, `updatedAt`: timestamps.

Recommended `PaymentAllocation` fields:

- `id`: stable generated identifier.
- `paymentId`: required relation to `Payment`.
- `invoiceId`: required relation to `Invoice`.
- `amountPaisa`: positive amount allocated to the invoice.
- `createdAt`: timestamp.

Recommended `CostComponent` fields:

- `id`: stable generated identifier.
- `orderId`: required relation to `Order`.
- `orderLineItemId`: optional relation to `OrderLineItem`.
- `category`: required string or enum from configured categories.
- `description`: required display text.
- `amountPaisa`: non-negative amount.
- `status`: `DRAFT`, `APPROVED`, `REJECTED`, `VOID`.
- `approvedById`, `approvedAt`: Admin approval metadata.
- `rejectedById`, `rejectedAt`, `rejectionReason`: rejection metadata.
- `voidedById`, `voidedAt`, `voidReason`: void metadata.
- `createdById`, `updatedById`: `User` references.
- `createdAt`, `updatedAt`: timestamps.

Recommended `Incentive` fields:

- `id`: stable generated identifier.
- `orderId`: required unique relation to `Order`.
- `grossMarginPaisa`: snapshot.
- `approvedCostTotalPaisa`: snapshot.
- `rateBps`: default `500`.
- `calculatedAmountPaisa`: server-calculated snapshot.
- `overrideAmountPaisa`: optional Admin override.
- `payableAmountPaisa`: final payout amount after override logic.
- `status`: `NOT_READY`, `READY_FOR_REVIEW`, `APPROVED`, `REJECTED`, `PAID`, `VOID`.
- `readinessReason`: short explanation when not ready.
- `approvedById`, `approvedAt`: approval metadata.
- `overrideById`, `overrideAt`, `overrideReason`: override metadata.
- `paidById`, `paidAt`, `paymentReference`: payout metadata.
- `createdAt`, `updatedAt`: timestamps.

Recommended `IncentiveSplit` fields:

- `incentiveId`: relation to `Incentive`.
- `userId`: recipient `User`.
- `percent`: integer 1 through 100.
- `amountPaisa`: server-calculated split payout.
- Composite key: `[incentiveId, userId]`.

## Calculation Contracts

Implement pure helpers first after unblock:

- `calculateInvoiceStatus(invoiceTotalPaisa, allocatedPaymentPaisa)`
- `calculateOrderPaymentSummary(orderTotalPaisa, invoices, payments)`
- `calculatePendingReceivable(orderTotalPaisa, cumulativePaidPaisa)`
- `calculateUninvoicedAmount(orderTotalPaisa, invoiceTotalPaisa)`
- `calculateApprovedCostTotal(costComponents)`
- `calculateGrossMargin(orderBookedValueExGstPaisa, approvedCostTotalPaisa)`
- `calculateIncentive(grossMarginPaisa, rateBps = 500)`
- `calculateIncentiveSplits(incentiveAmountPaisa, splitPercentages)`

Rounding rules:

- Use integer paise throughout.
- For percentage calculations, round to nearest paise.
- When split rounding leaves a remainder, assign the remainder to the first split sorted by stable recipient order so the sum equals the approved payout amount.
- Never calculate incentive from GST-inclusive totals.

## Implementation Tasks After Unblock

### Task 1: Refresh Against Landed Orders/Production

**Files:**

- Read: landed order schema, order routes, order server modules, production modules, and order tests.
- Modify: this plan only if landed names differ.

- [x] Confirm order and order line model names: `Order` and `OrderLineItem`.
- [x] Confirm order total field names for excluding GST, GST, and total value: `subtotalPaisa`, `gstPaisa`, and `totalPaisa`.
- [x] Confirm owner and split source for incentive attribution: `Order.ownerId` and `OrderOwnerSplitSnapshot`.
- [x] Confirm order detail route for finance entry points and revalidation: `/orders/[orderId]`.
- [x] Confirm production status visibility requirements on the order detail page: finance can show production status but does not depend on production completion.
- [x] Confirm whether cancelled/void orders are excluded from finance and incentive calculations: block new finance writes for `CANCELLED`; preserve history through void/reject states.
- [x] Commit the docs-only refresh before touching implementation files.

### Task 2: Add Finance Schema

**Files after unblock:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/**`
- Modify: `prisma/seed.ts` only if deterministic finance smoke data is needed.

- [x] Add invoice, payment, payment allocation, cost component, incentive, and incentive split enums/models.
- [x] Add order and order-line relations using actual landed Orders/Production names.
- [x] Add indexes for order finance summary, invoice status, due date, payment date, cost status, incentive status, and recipient lookup.
- [x] Seed finance records only against a deterministic `Order` if Task 2 adds one; otherwise keep finance e2e responsible for booking an order through supported UI.
- [x] Run `npx prisma validate`.
- [x] Run `npm run prisma:generate`.

### Task 3: Add Pure Finance Calculations

**Files after unblock:**

- Create: `src/server/finance/calculations.ts`
- Create: `src/server/finance/calculations.test.ts`

- [x] Cover default GST examples where order inputs require recalculation.
- [x] Cover cumulative order payment completion across one invoice, installments, and split invoices.
- [x] Cover pending receivables and uninvoiced work in progress.
- [x] Cover approved-cost-only gross margin.
- [x] Cover 5 percent default incentive and negative-margin zero default.
- [x] Cover split payouts for 100 percent owner default and 60/40 split.
- [x] Cover split rounding so payout split amounts always sum to the payable incentive.

### Task 4: Add Validators And Permissions

**Files after unblock:**

- Create: `src/server/finance/validators.ts`
- Create: `src/server/finance/validators.test.ts`
- Create: `src/server/finance/permissions.ts`
- Create: `src/server/finance/permissions.test.ts`

- [x] Validate invoice number, dates, amounts, status transitions, and void reason.
- [x] Validate payment amount, date, mode, reference, allocation totals, and overpayment acknowledgement.
- [x] Validate cost category, amount, status transition, approval/rejection/void reason, and Admin-only approval.
- [x] Validate incentive splits total exactly 100 percent when split rows exist.
- [x] Validate Admin override amount requires reason.
- [x] Enforce company-wide read visibility for Admin and Sales.
- [x] Enforce Admin-only writes for invoices, payments, costs, incentive approvals, overrides, payout marking, rejection, and voiding.

### Task 5: Add Queries, Mutations, And Actions

**Files after unblock:**

- Create: `src/server/finance/types.ts`
- Create: `src/server/finance/queries.ts`
- Create: `src/server/finance/queries.test.ts`
- Create: `src/server/finance/mutations.ts`
- Create: `src/server/finance/mutations.test.ts`
- Create: `src/server/finance/actions.ts`
- Create: `src/server/finance/actions.test.ts`

- [x] Load order finance summary with invoices, payments, allocations, costs, incentive, and split recipients.
- [x] Create and update invoice records transactionally.
- [x] Record payment and allocations transactionally.
- [x] Recalculate invoice status and order payment completion after each payment write.
- [x] Create/update/approve/reject/void cost components.
- [x] Recalculate incentive snapshots after approved cost or payment completion changes.
- [x] Create default 100 percent incentive split from primary salesperson when no split rows are provided.
- [x] Support explicit incentive split recipients and percentages.
- [x] Reject incentive approval until full order payment is confirmed.
- [x] Store Admin approval, override, rejection, and payout metadata.
- [x] Revalidate landed order detail and finance routes after successful writes.

### Task 6: Add Finance UI On Orders

**Files after unblock:**

- Create finance components listed in "Future File Structure After Unblock".
- Modify landed order detail route or component only after confirming route names.

- [ ] Render order finance summary with booked value excluding GST, GST, total, invoiced amount, collected amount, pending receivable, uninvoiced amount, approved costs, gross margin, incentive readiness, and payout status.
- [ ] Render Admin invoice form and invoice table.
- [ ] Render Admin payment form and payment history.
- [ ] Render Admin cost component form with approval/rejection controls.
- [ ] Render incentive panel with calculated gross margin, 5 percent incentive default, split recipients, Admin override fields, and approval controls.
- [ ] Hide or disable write controls for Sales while preserving company-wide read visibility where approved by business rules.

### Task 7: Add Browser Smoke And Final Gates

**Files after unblock:**

- Create: `tests/e2e/finance.spec.ts`

- [ ] Admin creates an invoice for a seeded order.
- [ ] Admin records partial payment and sees order remain partially paid.
- [ ] Admin records final payment and sees order become fully paid.
- [ ] Admin adds and approves cost components.
- [ ] Gross margin recalculates from booked value excluding GST minus approved costs.
- [ ] Incentive becomes ready only after full payment.
- [ ] Admin approves incentive payout.
- [ ] Sales can view payment status but cannot approve costs or incentives.
- [ ] Run targeted finance unit tests.
- [ ] Run `npx prisma validate`.
- [ ] Run `npm run prisma:generate`.
- [ ] Run `npm run test`.
- [ ] Run `npm run gate`.
- [ ] Run `npm run test:e2e`.
- [ ] Run `git diff --check`.

## Acceptance Criteria

- Implementation starts only after Orders/Production lands and this plan is refreshed against actual contracts.
- No other Prisma-owning lane edits `prisma/**`, `src/**`, `tests/**`, package/config files, seed files, or migrations while Finance is active.
- Invoice records attach to orders and support multiple invoices per order.
- Payment records support one-time and installment payments.
- Order payment completion is cumulative across all invoices and payments.
- Pending receivables and collected payments are calculated from payment records, not manual status fields.
- Uninvoiced work in progress is calculated from order total minus invoice totals.
- Cost components can attach to order or order line item.
- Only approved costs reduce gross margin.
- Gross margin equals booked order value excluding GST minus approved costs.
- Default incentive rate is 5 percent, stored as `500` basis points.
- Incentive is zero by default when gross margin is negative.
- Incentive becomes payable only after full order payment receipt.
- Default incentive recipient is the primary salesperson at 100 percent when no split rows exist.
- Optional incentive splits must total exactly 100 percent.
- Admin can approve, reject, or override incentive payouts with audit metadata.
- Sales cannot approve costs, override incentives, approve incentives, or mark payouts paid.
- Payment status remains visible company-wide.
- Tests cover FIN-001 through FIN-025 from `docs/superpowers/qa/2026-06-15-finance-incentive-test-matrix.md`.
- Final verification includes Prisma validation, Prisma generation, unit tests, full gate, browser smoke, and whitespace check.

## Guardrails

- Keep this lane as the only schema-owning implementation branch until Finance lands.
- Do not create placeholder finance tables before order contracts exist.
- Do not infer order totals from proposal records after Orders exist; use the landed order as the finance source of truth.
- Do not calculate incentives from GST-inclusive totals.
- Do not mark an incentive payable from invoice status alone; use cumulative order payment completion.
- Do not let overpayments silently change order completion, receivables, or incentive state.
- Do not allow cost drafts, rejected costs, or void costs to reduce gross margin.
- Do not allow Sales UI restrictions to be the only permission boundary; server actions and mutation services must reject unauthorized writes.
- Do not delete invoices, payments, costs, or incentives with downstream history; use void/reject states with reasons.
- Do not duplicate report formulas in dashboard code; expose tested read models for later reports.
- Keep one schema owner active. Finance implementation must not run in parallel with another Prisma-owning slice.

## Handoff Summary

Orders/Production has landed, and this plan has been refreshed against the exact model, route, query, mutation, permission, and seed names. Finance implementation may proceed from `feature/finance-payments-incentives`.
