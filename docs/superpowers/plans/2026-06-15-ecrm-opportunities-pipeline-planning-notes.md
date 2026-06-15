# Opportunities And Pipeline Planning Notes

Date: 2026-06-15
Status: Planning-only while CRM Core is active
Depends on: CRM Core landed on `main`

## Purpose

Prepare the next code-owning slice after CRM Core without touching Prisma, app source, tests, or shared configuration while `feature/crm-core` is in progress.

## Intended Scope After CRM Core

- Opportunity records attached to a lead/customer and optionally a branch.
- Pipeline stages with default values: Lead, Qualified, Proposal Sent, Negotiation, Won, Lost, Dormant.
- Opportunity owner and optional split salespeople.
- Product/service interest captured as text or later catalog reference, depending on product catalog timing.
- Estimated value excluding GST.
- Last reach and next follow-up fields that either reuse CRM Core activity semantics or are derived from activities.
- List and board views for pipeline work.
- Sales targets by salesperson, financial year, and quarter.

## CRM Core Handoff Needed

Do not implement this slice until CRM Core confirms:

- Final lead/customer table and route names.
- Final branch identifier and optional branch association pattern.
- Final owner model and active owner query.
- Final activity/follow-up model, especially whether next follow-up is stored on activities only or denormalized for list speed.
- Company-wide Sales visibility behavior.

## Candidate Data Ownership

The Opportunities slice should own these future concepts:

- `Opportunity`
- `PipelineStage`
- `OpportunityOwnerSplit`
- `SalesTarget`

It should not own lead/customer, branch, contact, activity, proposal, product catalog, order, invoice, payment, cost, incentive, production, or report tables.

## Workflow Notes

- Creating an opportunity starts from an existing lead/customer.
- A lead/customer can have multiple active opportunities at once.
- Each distinct pursuit should be separate, such as eLearning, video shoot, and VR/AR.
- Won/lost state should be explicit and should drive downstream order creation later.
- Ownership filters narrow work queues but must not hide company records from Sales users.
- Targets use booked order value excluding GST later; opportunity value is forecast input, not achievement.

## Acceptance Criteria Draft

- Admin and Sales can create opportunities for any visible lead/customer.
- Admin and Sales can view all opportunities across the company.
- Owner filtering narrows the list without becoming authorization.
- Pipeline stages are ordered and can support list and board views.
- Stage changes are persisted and visible after reload.
- Won opportunities become eligible for future order creation.
- Lost and dormant opportunities remain visible in history and reports.
- Target records can be prepared without requiring order/payment modules.

## Risks To Resolve In Implementation Plan

- Whether pipeline stages are configurable in this slice or seeded defaults only.
- Whether product/service interest waits for the catalog slice or starts as structured text.
- Whether split ownership applies to opportunities only or is also copied to orders.
- Whether next follow-up is derived from CRM Core activities or duplicated on opportunity.
- How to prevent proposals/orders from being implemented prematurely through opportunity UI.

## Explicitly Out Of Scope Now

- Proposal records or uploaded Canva PDF metadata.
- Product/service catalog and GST defaults.
- Order creation.
- Invoice, payment, cost, incentive, production, and reports code.
- CSV import.

