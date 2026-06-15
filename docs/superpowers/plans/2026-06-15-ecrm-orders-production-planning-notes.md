# Orders And Production Planning Notes

Date: 2026-06-15
Status: Planning-only while CRM Core is active
Depends on: CRM Core, Opportunities, and Products/Proposals landed on `main`

## Purpose

Prepare the order and production slice without adding order, production, or line-item code before opportunity and product/proposal contracts exist.

## Intended Scope After Upstream Slices

- Order records created from won opportunities and received PO details.
- Order line items tied to products/services.
- Booked value excluding GST, GST amount, and total value.
- Primary owner and optional incentive split snapshot.
- Production stage templates by product/service category.
- Production stage instances per order line item.
- Company-wide production status visibility for Admin and Sales.

## Upstream Handoff Needed

Do not implement this slice until these contracts are stable:

- Won opportunity state and order eligibility.
- Proposal commercial summary and selected proposal relationship.
- Product/service catalog identifiers and GST defaults.
- Owner and split ownership shape.
- Amount storage convention.

## Candidate Data Ownership

This slice should own these future concepts:

- `Order`
- `OrderLineItem`
- `ProductionStageTemplate`
- `ProductionStageInstance`

It should not own lead/customer, opportunity, proposal, product catalog, invoice, payment, cost, incentive, or reports tables outside the necessary foreign keys.

## Workflow Notes

- Orders are created only after an opportunity is won and PO/order details are available.
- One order can contain multiple line items.
- Each line item has its own production stages.
- Production status should be visible to Sales even if Admin or operations-style workflow owns updates.
- Production templates should ship with defaults for eLearning, video shoot, VR/AR, and animation.
- Order value excluding GST is the basis for target achievement and later gross margin.

## Acceptance Criteria Draft

- Admin and Sales can view all orders across the company.
- Admin and Sales can create an order from a won opportunity when required fields are present.
- Order totals preserve booked value excluding GST separately from GST and total value.
- Multiple line items can be added under one order.
- Line items inherit default production template stages from their product/service category.
- Production stage status updates persist after reload.
- Order detail shows linked lead/customer, branch when present, opportunity, proposal when present, owner, values, and production progress.
- Production status can be inspected without needing invoice/payment/cost modules.

## Risks To Resolve In Implementation Plan

- Whether order creation requires a selected proposal or can proceed directly from a won opportunity.
- Whether production templates are Admin-editable in this slice or seeded only.
- Whether production stages support assignees in MVP.
- How to snapshot owner splits so later reassignment does not rewrite historical incentives unintentionally.
- How to prevent finance fields from being partially implemented in order UI.

## Explicitly Out Of Scope Now

- Invoice records.
- Payment receipt and receivable status.
- Cost components.
- Incentive calculation or approval.
- Full reports implementation.
- CSV import.

