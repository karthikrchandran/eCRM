# Products And Proposals Planning Notes

Date: 2026-06-15
Status: Planning-only while CRM Core is active
Depends on: CRM Core and Opportunities landed on `main`

## Purpose

Capture product catalog and proposal requirements without creating product, proposal, upload, or GST implementation before upstream opportunity contracts exist.

## Intended Scope After Opportunities

- Admin-managed product/service catalog.
- Active flag for catalog entries.
- Product/service category.
- Default GST rate per product/service.
- Optional default production template reference once production templates exist.
- Proposal records under an opportunity.
- Proposal title, version or sequence label, status, quoted amount, GST summary, notes, and uploaded Canva PDF metadata.
- Multiple proposals per opportunity.

## Upstream Handoff Needed

Do not implement this slice until these contracts are stable:

- Opportunity identifier and won/lost semantics.
- Product/service interest shape in opportunity records.
- Owner and split ownership behavior from opportunity/order handoff.
- File storage choice for uploaded proposal PDFs.
- GST amount storage convention, including minor units versus decimal values.

## Candidate Data Ownership

This slice should own these future concepts:

- `ProductService`
- `Proposal`
- `ProposalFile`
- Proposal commercial summary structures.

It should not own opportunities, orders, invoices, payments, production stages, costs, incentives, or reports.

## Workflow Notes

- Canva remains the proposal authoring tool in MVP.
- eCRM stores proposal metadata, commercial summary, amount, GST details, and uploaded PDF metadata.
- Proposal records remain editable.
- A revised commercial should be a new proposal record when history matters.
- Proposal PDF upload should validate type and size before storing metadata.
- Proposal records must stay linked to exactly one opportunity.

## Acceptance Criteria Draft

- Admin can create and deactivate product/service catalog entries.
- Admin can configure default GST per product/service.
- Sales can select active products/services when preparing proposal summaries.
- Admin and Sales can create proposal records under visible opportunities.
- Proposal amount and GST summary persist after reload.
- Multiple proposals can exist under one opportunity.
- Uploaded proposal metadata shows filename, size, type, uploader, and upload time.
- Sales cannot change global catalog settings unless the final role policy explicitly allows it.

## Risks To Resolve In Implementation Plan

- Whether GST rates are stored as basis points, percent decimal, or integer percent.
- Whether file upload uses Vercel Blob in the first implementation or a local metadata-only placeholder.
- Whether proposal status should be configurable or fixed for MVP.
- Whether product/service catalog must land before proposal creation UI.
- Whether proposal commercial summaries need line items before order line items exist.

## Explicitly Out Of Scope Now

- Replacing Canva.
- PDF generation.
- Order conversion.
- Production template implementation.
- Invoice/payment/cost/incentive logic.
- Report queries.

