# Orders and Production After Products/Proposals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task after Products/Proposals lands. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the order booking and production tracking slice after accepted proposal records, proposal line items, product/service snapshots, and PDF metadata are landed.

**Architecture:** Orders are downstream of accepted proposals and must preserve commercial snapshots from Products/Proposals instead of recalculating from mutable catalog rows. Production work should attach to order line items and use product/service production template keys only after those keys are stable. Products/Proposals has landed; this update is a docs-only Task 1 handoff and does not implement Orders/Production.

**Tech Stack:** Next.js App Router, React, TypeScript, Prisma/Postgres, Zod, Vitest, Testing Library, Playwright, Tailwind CSS.

---

## Status

Implementation status: **UNBLOCKED FOR ORDERS/PRODUCTION IMPLEMENTATION**.

The current source baseline already includes CRM Core and Opportunities:

- CRM Core: `LeadCustomer`, `Branch`, `Contact`, `Activity`, `LeadOwnershipHistory`, and `User`.
- Opportunities: `Opportunity`, `PipelineStage`, `OpportunityOwnerSplit`, `SalesTarget`, `/opportunities/[opportunityId]`, `getOpportunityDetail()`, `listOpportunityFormOptions()`, `assertCanViewOpportunities()`, and `assertCanWriteOpportunities()`.
- Products/Proposals: landed in this worktree with `ProductService`, `Proposal`, `ProposalLineItem`, `ProposalPdfAttachment`, `ProposalStatus`, `/admin/products`, `/admin/products/new`, `/admin/products/[productServiceId]/edit`, `/opportunities/[opportunityId]/proposals/new`, `/opportunities/[opportunityId]/proposals/[proposalId]`, `listActiveProductServices()`, `listProductServicesForAdmin()`, `getProductServiceForAdmin()`, `createProposal()`, `addProposalPdfMetadata()`, `changeProposalStatus()`, `listProposalsForOpportunity()`, and `getProposalDetail()`.

The old Products/Proposals dependency is no longer a blocker. The accepted-proposal seed fixture and booking-specific accepted proposal loader are now present, so the Orders/Production implementation tasks may start from this branch.

**Hard block for this docs-only lane:** do not touch `prisma/**`, `src/**`, `tests/**`, package files, config files, seed files, or migrations. This document is the only allowed output for the current Task 1 unblock update.

## Scope

Included after Products/Proposals lands:

- Convert an accepted proposal into a booked order.
- Store customer, branch, opportunity, owner, split, commercial, GST, and product/service snapshots needed for order history.
- Track purchase order details when the customer provides a PO.
- Track order line items derived from proposal line items.
- Create production work items and stage instances from order lines.
- Provide order list, order detail, booking, and production board surfaces.
- Allow Admin and Sales to see company-wide order and production status.
- Add focused server, component, and browser smoke tests.

Excluded from this slice:

- Product/service catalog implementation.
- Proposal creation, proposal PDF uploads, or proposal status lifecycle implementation.
- Invoice generation, payment collection, cost tracking, incentive calculation, and reports.
- Native mobile behavior.
- Object storage implementation beyond reading proposal PDF metadata if Products/Proposals exposes it.
- Destructive deletes for orders, order line items, or production history.

## Resolved Pre-Implementation Gaps

The Products/Proposals handoff is source-confirmed, and the two source-backed setup gaps have been resolved:

- `prisma/seed.ts` now creates `seed_proposal_acme_lms_accepted` with one `ProposalLineItem`, active `ProposalPdfAttachment`, and `status: "ACCEPTED"` for order-booking smoke setup.
- `src/server/orders/queries.ts` now provides `loadAcceptedProposalForBooking()`, which requires `Proposal.status === "ACCEPTED"` and includes opportunity lead/customer, branch, owner, owner splits, line items, active PDF metadata, and `ProductService.defaultProductionTemplateKey`.
- `ProposalLineItem` snapshots product name/category and commercial fields, but not `defaultProductionTemplateKey`. If production template history must be preserved at booking, copy the key from the current `ProductService.defaultProductionTemplateKey` during order booking or add a proposal-line snapshot field in a future schema decision.
- `changeProposalStatus()` moves proposals to `SENT`, `ACCEPTED`, `REJECTED`, `EXPIRED`, or `WITHDRAWN`; only the `SENT` transition updates the opportunity stage to `Proposal Sent`. Acceptance does not currently move the opportunity to `WON`, so Orders must not assume proposal acceptance changes opportunity stage.

## Source-Aware Integration Rules

Use these landed names unless Products/Proposals changes the downstream contract:

- `LeadCustomer` remains the customer source. Do not create a second customer table.
- `Branch` remains the optional delivery/billing branch context.
- `Opportunity` remains the sales opportunity source.
- `PipelineStage.kind` has `OPEN`, `WON`, `LOST`, and `DORMANT`.
- `OpportunityOwnerSplit` stores split percentages and should be snapshotted onto orders when business reporting needs historical split values.
- Sales visibility is company-wide. Owner and split fields support responsibility, filtering, and reporting, not row-level visibility.
- Existing protected routes are under `src/app/(app)/**`.
- Existing server module pattern is `types.ts`, `validators.ts`, `queries.ts`, `mutations.ts`, `actions.ts`, plus focused tests beside those modules.
- `ProposalStatus` values are `DRAFT`, `SENT`, `ACCEPTED`, `REJECTED`, `EXPIRED`, and `WITHDRAWN`; the accepted value is exactly `ACCEPTED`.
- `Proposal.id` is the proposal primary key and `Proposal.opportunityId` is the required relation to `Opportunity`.
- `ProposalLineItem` uses `productServiceId`, `productNameSnapshot`, `productCategorySnapshot`, `description`, `quantity`, `unitPricePaisa`, `gstRateBps`, `gstOverrideReason`, `lineSubtotalPaisa`, `lineGstPaisa`, `lineTotalPaisa`, and `sortOrder`.
- `ProductService.defaultProductionTemplateKey` is the landed product/service production template field.
- Proposal permissions are `assertCanViewProposals()` and `assertCanWriteProposals()`; both currently rely on `canViewCompanyRecords()`, matching company-wide Admin/Sales visibility.

## Expected Data Model After Unblock

These are future implementation targets, not files to edit now.

Recommended order models:

- `Order`
- `OrderLineItem`
- `OrderOwnerSplitSnapshot`

Recommended production models:

- `ProductionTemplate`
- `ProductionTemplateStage`
- `ProductionWorkItem`
- `ProductionStageInstance`
- `ProductionNote`

Recommended `Order` fields:

- `id`: stable generated identifier.
- `orderNumber`: human-readable sequence such as `ORD-2026-0001`.
- `proposalId`: required relation to accepted proposal.
- `opportunityId`: required snapshot relation to `Opportunity`.
- `leadCustomerId`: required relation to `LeadCustomer`.
- `branchId`: optional relation to `Branch`.
- `ownerId`: primary owner at booking time.
- `status`: `DRAFT`, `BOOKED`, `IN_PRODUCTION`, `READY_FOR_DELIVERY`, `DELIVERED`, `CANCELLED`, or landed equivalent.
- `poNumber`: optional customer purchase order number.
- `poDate`: optional customer purchase order date.
- `poFileName`, `poStorageKey`, `poFileSizeBytes`, `poMimeType`: optional PO document metadata if file upload is included.
- `bookedAt`: timestamp set when order becomes booked.
- `deliveryDueAt`: optional promised delivery date.
- `currency`: expected `INR`.
- `subtotalPaisa`, `gstPaisa`, `totalPaisa`: copied from accepted proposal at booking.
- `createdById`, `updatedById`: `User` references.
- `createdAt`, `updatedAt`: standard timestamps.

Recommended `OrderLineItem` fields:

- `id`: stable generated identifier.
- `orderId`: required relation to `Order`.
- `proposalLineItemId`: required relation to accepted proposal line item.
- `productServiceId`: optional relation to landed product/service row.
- `productNameSnapshot`: copied from proposal line item.
- `productCategorySnapshot`: copied from proposal line item.
- `productionTemplateKeySnapshot`: copied from product/proposal source at booking time.
- `description`: copied from proposal line item.
- `quantity`: copied from proposal line item.
- `unitPricePaisa`, `gstRateBps`, `lineSubtotalPaisa`, `lineGstPaisa`, `lineTotalPaisa`: copied commercial snapshots.
- `sortOrder`: copied display order.

Recommended production behavior:

- Create one `ProductionWorkItem` per order line item by default.
- Generate `ProductionStageInstance` rows from the line item's production template key.
- Store stage status as `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `DONE`, or `SKIPPED`.
- Store `assignedToId`, `startedAt`, `dueAt`, `completedAt`, and `sortOrder` per stage instance.
- Allow manual stage notes without changing order commercial values.
- Order status may move to `IN_PRODUCTION` when at least one work item starts.
- Order status may move to `READY_FOR_DELIVERY` only when required production stages are complete or skipped with a reason.

## Expected Routes After Unblock

Future route targets:

- `src/app/(app)/orders/page.tsx`: order list with status, customer, opportunity, owner, booked date, due date, and total.
- `src/app/(app)/orders/new/page.tsx`: optional proposal lookup route if booking is not launched from proposal detail.
- `src/app/(app)/orders/[orderId]/page.tsx`: order detail with line items, PO metadata, production summary, and links to source proposal/opportunity/customer.
- `src/app/(app)/orders/[orderId]/edit/page.tsx`: limited edit route for PO metadata, due date, and internal notes.
- `src/app/(app)/opportunities/[opportunityId]/proposals/[proposalId]/book-order/page.tsx`: order booking route from the landed nested proposal detail route.
- `src/app/(app)/production/page.tsx`: production board/list grouped by stage status, due date, owner, and product/service category.
- `src/app/(app)/production/[workItemId]/page.tsx`: production work item detail.
- `src/app/(app)/admin/production-templates/page.tsx`: Admin template management if templates are editable in this slice.

Use the landed nested opportunity proposal route shape. Do not invent a parallel proposal URL.

## Expected Server Modules After Unblock

Future order module:

- `src/server/orders/types.ts`: order input, list filters, detail DTOs, and action state types.
- `src/server/orders/validators.ts`: Zod schemas for booking, PO metadata, order filters, and status transitions.
- `src/server/orders/queries.ts`: list orders, load order detail, add `loadAcceptedProposalForBooking()` or equivalent, and list booking options. The booking loader must require `Proposal.status === "ACCEPTED"` and include opportunity lead/customer, branch, owner, owner splits, line items, PDF metadata, and product `defaultProductionTemplateKey`.
- `src/server/orders/mutations.ts`: create order from accepted proposal, update PO metadata, change order status, and snapshot owner splits.
- `src/server/orders/actions.ts`: server actions for order booking and order updates.
- `src/server/orders/permissions.ts`: read/write assertions, likely aligned with opportunity visibility.

Future production module:

- `src/server/production/types.ts`: template, work item, stage, filter, and action state types.
- `src/server/production/validators.ts`: stage update, assignment, due date, note, and template schemas.
- `src/server/production/templates.ts`: default template definitions for `elearning`, `video_shoot`, `vr_ar`, and `animation` if not fully modeled in Prisma.
- `src/server/production/queries.ts`: production board, work item detail, and template reads.
- `src/server/production/mutations.ts`: instantiate work items, update stage status, assign users, add notes, and derive order production status.
- `src/server/production/actions.ts`: server actions for board and detail updates.
- `src/server/production/permissions.ts`: read/write assertions for Admin and Sales until a production role exists.

## Expected Components After Unblock

Future order components:

- `src/components/orders/order-list.tsx`
- `src/components/orders/order-booking-form.tsx`
- `src/components/orders/order-detail.tsx`
- `src/components/orders/order-line-items.tsx`
- `src/components/orders/order-status-actions.tsx`
- `src/components/orders/po-metadata-form.tsx`

Future production components:

- `src/components/production/production-board.tsx`
- `src/components/production/production-work-item-list.tsx`
- `src/components/production/production-stage-list.tsx`
- `src/components/production/production-stage-actions.tsx`
- `src/components/production/production-note-form.tsx`
- `src/components/production/production-template-form.tsx`

## Expected Tests After Unblock

Future focused tests:

- `src/server/orders/validators.test.ts`
- `src/server/orders/queries.test.ts`
- `src/server/orders/mutations.test.ts`
- `src/server/orders/actions.test.ts`
- `src/server/production/validators.test.ts`
- `src/server/production/queries.test.ts`
- `src/server/production/mutations.test.ts`
- `src/server/production/actions.test.ts`
- `src/components/orders/order-list.test.tsx`
- `src/components/production/production-board.test.tsx`
- `tests/e2e/orders-production.spec.ts`

Minimum test coverage:

- Reject booking from non-accepted proposals.
- Reject booking the same proposal twice unless the business explicitly approves revisions.
- Snapshot proposal commercial totals and line-item snapshots at booking.
- Preserve Sales company-wide visibility.
- Create production work items from order line items and template keys.
- Update production stages without changing order commercial snapshots.
- Move order production status only through validated transitions.
- Browser smoke: Admin or Sales books an accepted proposal, sees order detail, starts a production stage, completes required stages, and sees the production board update.

## Implementation Tasks After Unblock

### Task 1: Confirm Products/Proposals Handoff

**Files:**

- Read: landed proposal schema, routes, server modules, components, seed data, and tests.
- Modify: this plan if the landed names differ from the assumptions above.

- [x] Confirmed accepted proposal status value: `ProposalStatus.ACCEPTED` / `"ACCEPTED"`.
- [x] Confirmed proposal acceptance does not change opportunity stage in `changeProposalStatus()`; only `SENT` moves the opportunity to the `Proposal Sent` stage.
- [x] Confirmed proposal model and primary key: `Proposal.id`.
- [x] Confirmed proposal relation to opportunity: `Proposal.opportunityId` and `Opportunity.proposals`.
- [x] Confirmed proposal line model: `ProposalLineItem`.
- [x] Confirmed line fields to copy: `productServiceId`, `productNameSnapshot`, `productCategorySnapshot`, `description`, `quantity`, `unitPricePaisa`, `gstRateBps`, `gstOverrideReason`, `lineSubtotalPaisa`, `lineGstPaisa`, `lineTotalPaisa`, and `sortOrder`.
- [x] Confirmed proposal total fields to copy: `currency`, `subtotalPaisa`, `gstPaisa`, and `totalPaisa`.
- [x] Confirmed product/service model and production template field: `ProductService.defaultProductionTemplateKey`.
- [x] Confirmed proposal detail route where "Book order" should appear: `src/app/(app)/opportunities/[opportunityId]/proposals/[proposalId]/page.tsx`, via `ProposalDetail`.
- [x] Confirmed proposal list route where created orders can be surfaced later: `src/app/(app)/opportunities/[opportunityId]/page.tsx`.
- [x] Confirmed landed query/helper names: `getProposalDetail()`, `listProposalsForOpportunity()`, `createProposal()`, `addProposalPdfMetadata()`, `changeProposalStatus()`, `listActiveProductServices()`, `listProductServicesForAdmin()`, and `getProductServiceForAdmin()`.
- [x] Confirmed permission helper names: `assertCanViewProposals()`, `assertCanWriteProposals()`, `assertCanViewProductServices()`, and `assertCanManageProductServices()`.
- [x] Confirmed Products/Proposals test naming conventions: `src/server/proposals/*.test.ts`, `src/server/products/*.test.ts`, `src/components/proposals/*.test.tsx`, `src/components/products/*.test.tsx`, and `tests/e2e/products-proposals.spec.ts`.
- [x] Added accepted proposal seed fixture with line item and PDF metadata: `seed_proposal_acme_lms_accepted`.
- [x] Added booking-specific accepted proposal loader: `loadAcceptedProposalForBooking()`.
- [x] Orders/Production implementation is unblocked for Task 2 onward.

### Task 2: Add Order Schema

**Files after unblock:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/**`
- Modify: `prisma/seed.ts` only after accepted proposal seed data exists.

- [ ] Add order enums and order models.
- [ ] Add relations to landed Proposal, Opportunity, LeadCustomer, Branch, User, and proposal line item models.
- [ ] Add unique constraint preventing duplicate order booking per proposal unless approved otherwise.
- [ ] Add indexes for status, owner, customer, opportunity, booked date, and delivery due date.
- [ ] Validate with `npx prisma validate` and Prisma generation.

### Task 3: Add Order Server Module

**Files after unblock:**

- Create: `src/server/orders/types.ts`
- Create: `src/server/orders/validators.ts`
- Create: `src/server/orders/permissions.ts`
- Create: `src/server/orders/queries.ts`
- Create: `src/server/orders/mutations.ts`
- Create: `src/server/orders/actions.ts`
- Create: matching tests.

- [ ] Write failing validator tests for booking input, PO metadata, filters, and status transitions.
- [ ] Implement validators with no client-supplied commercial totals.
- [ ] Write failing mutation tests for accepted-proposal-only booking and duplicate prevention.
- [ ] Implement `createOrderFromAcceptedProposal()` as a transaction.
- [ ] Copy proposal and line item snapshots during booking.
- [ ] Revalidate proposal, opportunity, order, and dashboard routes after booking.

### Task 4: Add Production Schema

**Files after unblock:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/**`
- Modify: `prisma/seed.ts` only for default templates after schema is stable.

- [ ] Add production template, template stage, work item, stage instance, and note models.
- [ ] Link production work items to order line items.
- [ ] Add indexes for status, assigned user, due date, order, and product/service category snapshot.
- [ ] Seed default templates for eLearning, video shoot, VR/AR, and animation when template editing is in scope.
- [ ] Validate with Prisma commands.

### Task 5: Add Production Server Module

**Files after unblock:**

- Create: `src/server/production/types.ts`
- Create: `src/server/production/validators.ts`
- Create: `src/server/production/templates.ts`
- Create: `src/server/production/permissions.ts`
- Create: `src/server/production/queries.ts`
- Create: `src/server/production/mutations.ts`
- Create: `src/server/production/actions.ts`
- Create: matching tests.

- [ ] Write failing tests for template expansion and stage transitions.
- [ ] Implement work item creation from order line items.
- [ ] Implement production board reads with company-wide visibility.
- [ ] Implement stage status updates with timestamps and optional notes.
- [ ] Derive order production status from work item and stage state.

### Task 6: Add Order UI

**Files after unblock:**

- Create order components listed above.
- Create order routes listed above.
- Modify the landed proposal detail component or route to expose the order booking entry point.

- [ ] Add "Book order" only for accepted proposals without an existing order.
- [ ] Render order list and order detail with source proposal, opportunity, customer, branch, owner, split, and commercial snapshots.
- [ ] Provide PO metadata entry without requiring a PO to create the initial order unless the business requires it.
- [ ] Render status actions with validation-backed server actions.

### Task 7: Add Production UI

**Files after unblock:**

- Create production components listed above.
- Create production routes listed above.
- Modify order detail to include production summary and work item links.

- [ ] Render production board grouped by stage status or due date.
- [ ] Render work item detail with order line context, customer, product/service snapshot, current stage, and notes.
- [ ] Provide stage transition actions.
- [ ] Provide assignment and due date controls.
- [ ] Keep commercial values read-only on production screens.

### Task 8: Browser Smoke And Final Verification

**Files after unblock:**

- Create: `tests/e2e/orders-production.spec.ts`

- [ ] Seed or create an accepted proposal through supported setup.
- [ ] Book an order from the accepted proposal.
- [ ] Verify duplicate booking is not offered for the same proposal.
- [ ] Open the order detail and confirm commercial snapshots match the proposal.
- [ ] Open production board, start a stage, complete it, and verify the board updates.
- [ ] Run `npx prisma validate`.
- [ ] Run the repo's Prisma generation command.
- [ ] Run order and production unit/component tests.
- [ ] Run `npm run gate`.
- [ ] Run targeted and existing e2e smoke tests.
- [ ] Run `git diff --check`.

## Acceptance Criteria

- Implementation starts only after Products/Proposals lands and the handoff checklist is source-confirmed.
- No current docs-only work touches `prisma/**`, `src/**`, `tests/**`, package files, config files, seed files, or migrations.
- Accepted proposal is the only source for order booking.
- A proposal cannot be booked into more than one active order unless explicitly approved.
- Order records preserve proposal commercial totals and proposal line item snapshots.
- Order records link back to Proposal, Opportunity, LeadCustomer, optional Branch, and owner context.
- Sales users keep company-wide order and production visibility.
- Production work items are created from order line items, not directly from opportunities or leads.
- Production templates derive from product/service template keys or landed equivalent, not hard-coded UI labels.
- Production status changes do not mutate proposal or order commercial snapshots.
- Browser smoke proves accepted proposal to order to production flow.
- Reports and dashboard metrics consume Orders/Production only after this slice is complete and verified.

## Guardrails

- Do not edit implementation files for this lane until Products/Proposals lands.
- Do not make Orders own product catalog, proposal PDF upload, proposal acceptance, invoices, payments, costs, incentives, or reports.
- Do not infer order value from Opportunity estimated value; booked value comes from accepted proposal snapshots.
- Do not infer production work from CRM activity follow-ups.
- Do not duplicate CRM Core customer or branch concepts.
- Do not restrict Sales visibility by owner.
- Do not delete historical commercial, PO, or production records.
- Do not allow client-submitted totals to become source of truth.
- Do not add broad dashboard claims until order and production queries exist and pass tests.

## Handoff Summary

Products/Proposals has landed and the source-confirmed model, route, helper, and test names are captured above. The accepted-proposal browser-smoke fixture and booking-specific accepted proposal loader are now in place, so Orders/Production can proceed as the downstream schema-owning slice from this branch.
