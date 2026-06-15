# Products and Proposals After CRM Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task after the Opportunities slice lands. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the products/services catalog and proposal management slice after CRM Core and after the Opportunities model, routes, and service contracts are merged.

**Architecture:** CRM Core is already landed around `LeadCustomer`, `Branch`, `Contact`, `Activity`, and `User` ownership. Products/services are an Admin-managed catalog with GST defaults; proposals belong to Opportunities and store commercial summary, proposal-line totals, and uploaded Canva PDF metadata. Implementation is blocked until Opportunities lands because proposals must attach to an Opportunity, not directly to `LeadCustomer`.

**Tech Stack:** Next.js App Router, React, TypeScript, Prisma, Postgres, Zod, Vitest, Playwright, Tailwind CSS, and object storage for PDF files.

---

## Status

Implementation status: **BLOCKED until Opportunities lands**.

This is a docs-only planning artifact. It must not be treated as approval to edit `prisma/**`, `src/**`, `tests/**`, package files, config files, seed data, or migrations in the current task.

The blocker is structural: the current CRM Core source has `LeadCustomer`, `Branch`, `Contact`, `Activity`, `LeadOwnershipHistory`, and `User`, but it does not yet have an `Opportunity` model, opportunity routes, opportunity service functions, or opportunity pipeline state. The approved product design says proposals belong to opportunities, so this slice cannot be implemented correctly until the Opportunities handoff is available.

## Current CRM Core Integration Points

Use these names from the landed CRM Core source:

- `LeadCustomer`: company-level lead/customer record. It has `ownerId`, `owner`, `branches`, `contacts`, `activities`, and `ownershipHistory`.
- `Branch`: child of `LeadCustomer`. It stores branch address context plus `gstin`, `locationHint`, and `salesContext`.
- `Contact`: child of `LeadCustomer` and optionally `Branch`.
- `Activity`: child of `LeadCustomer` and optionally `Branch` and `Contact`. It has an `ownerId` relation to `User`.
- Owner model: the owner is a `User`; CRM Core uses `LeadCustomer.ownerId` and `Activity.ownerId`. Ownership drives responsibility and filtering, not visibility.
- Sales visibility: Sales users can see company-wide records. Product and proposal visibility must follow this rule and must not hide records based on owner.
- Existing CRM routes use `/leads`, `/leads/[leadId]`, and child routes for branches, contacts, and activities.

Do not rename these concepts in future implementation. Use `LeadCustomer` in server and Prisma-facing names, while UI copy may continue to say "lead/customer".

## Scope

Included after the Opportunities handoff:

- Admin-managed products/services catalog.
- Active/inactive product visibility.
- Default GST rate per product/service, with 18 percent as the default.
- Proposal records under opportunities.
- Proposal line items tied to products/services.
- Server-calculated proposal commercial summary.
- Uploaded Canva PDF metadata.
- Proposal status lifecycle for draft, sent, accepted, rejected, expired, and withdrawn states.
- Proposal detail and list surfaces reachable from opportunity detail.
- Unit, service, and browser smoke coverage for product catalog and proposal workflows.

Excluded from this slice:

- Opportunity implementation itself.
- Order creation, PO management, production stages, invoices, payments, costs, incentives, and reports.
- Replacing Canva or building an in-app proposal document editor.
- Invoice PDF generation.
- Native mobile app behavior.
- Destructive deletes for records with downstream history.

## Products And Services Catalog

The catalog should be Admin-managed and readable by Sales when creating proposals. The catalog represents both physical products and services, because the business design uses "Product / Service" as one concept.

Recommended model name after implementation begins: `ProductService`.

Recommended fields:

- `id`: stable generated identifier.
- `name`: required display name.
- `code`: optional short code for searching and exports.
- `category`: one of the implementation's configured product/service categories.
- `description`: optional internal description shown to Sales.
- `defaultGstRateBps`: integer basis points; default `1800` for 18 percent.
- `defaultProductionTemplateKey`: optional string key such as `elearning`, `video_shoot`, `vr_ar`, or `animation` until the production-template module lands.
- `active`: boolean; inactive products remain visible on historical proposal lines but are hidden from new proposal selection.
- `sortOrder`: integer for Admin ordering.
- `createdById` and `updatedById`: `User` references where the implementation needs audit context.
- `createdAt` and `updatedAt`: standard timestamps.

Recommended seeded categories:

| Category | Default GST | Default production template key | Notes |
| --- | ---: | --- | --- |
| eLearning | 18 percent | `elearning` | Covers script, storyboard, voiceover, editing, review, edits, completion. |
| Video shoot | 18 percent | `video_shoot` | Covers script, shoot, voiceover, editing, review, edits, completion. |
| VR/AR | 18 percent | `vr_ar` | Covers script, development, voiceover, editing, review, edits, completion. |
| Animation | 18 percent | `animation` | Covers script, modeling, voiceover, editing, review, edits, completion. |
| Other service | 18 percent | empty | Used only when Admin has not mapped a service to a production template. |

Catalog behavior:

- Admin can create, edit, activate, and deactivate products/services.
- Sales can select active products/services on new proposal lines.
- Historical proposal line items must keep product name, category, and GST snapshots so later catalog edits do not rewrite old commercial records.
- The server must reject new proposal lines that reference inactive products unless the line already exists on the same proposal and is being edited for non-product fields.
- The implementation must validate GST as basis points from `0` through `2800` unless the business approves a wider range.

## GST Defaults

GST rules:

- Currency is INR.
- Default GST is 18 percent.
- Store rates as integer basis points. Example: 18 percent is `1800`, 0 percent is `0`, and 5 percent is `500`.
- Product/service default GST initializes proposal lines.
- `Branch.gstin` and `Branch.locationHint` may suggest GST treatment, but the MVP must store the final chosen GST rate on each proposal line.
- Line-level GST overrides are allowed for 0 percent GST, lower GST, or other approved exceptions.
- Proposal totals must be calculated server-side from line items and persisted as snapshots.

Commercial calculations:

- `lineSubtotalPaisa = quantity * unitPricePaisa`.
- `lineGstPaisa = round(lineSubtotalPaisa * gstRateBps / 10000)`.
- `lineTotalPaisa = lineSubtotalPaisa + lineGstPaisa`.
- `proposalSubtotalPaisa = sum(lineSubtotalPaisa)`.
- `proposalGstPaisa = sum(lineGstPaisa)`.
- `proposalTotalPaisa = proposalSubtotalPaisa + proposalGstPaisa`.

The browser may show preview totals, but save operations must recompute totals on the server and ignore client-supplied totals.

## Proposal Commercial Summary

Recommended model names after implementation begins:

- `Proposal`
- `ProposalLineItem`
- `ProposalPdfAttachment`

Recommended `Proposal` fields:

- `id`: stable generated identifier.
- `opportunityId`: required relation to the landed Opportunity model.
- `title`: required user-facing title.
- `sequenceNumber`: integer scoped to the opportunity.
- `versionLabel`: human label such as `V1`, `V2`, or `Commercial revision`.
- `status`: `DRAFT`, `SENT`, `ACCEPTED`, `REJECTED`, `EXPIRED`, or `WITHDRAWN`.
- `currency`: default `INR`.
- `validUntil`: optional date.
- `commercialSummary`: structured summary text for the proposal overview.
- `assumptions`: optional structured text.
- `inclusions`: optional structured text.
- `exclusions`: optional structured text.
- `paymentTerms`: optional structured text.
- `deliveryTimeline`: optional structured text.
- `internalNotes`: optional internal-only notes.
- `subtotalPaisa`, `gstPaisa`, and `totalPaisa`: server-calculated snapshots.
- `createdById` and `updatedById`: `User` references.
- `createdAt` and `updatedAt`: standard timestamps.

Recommended `ProposalLineItem` fields:

- `id`: stable generated identifier.
- `proposalId`: required relation to `Proposal`.
- `productServiceId`: required relation to `ProductService`.
- `productNameSnapshot`: copied from the selected catalog item at save time.
- `productCategorySnapshot`: copied from the selected catalog item at save time.
- `description`: proposal-specific description.
- `quantity`: positive decimal or integer based on implementation support.
- `unitPricePaisa`: non-negative integer.
- `gstRateBps`: copied from product default at creation and editable before final send.
- `lineSubtotalPaisa`, `lineGstPaisa`, and `lineTotalPaisa`: server-calculated snapshots.
- `sortOrder`: integer for display order.

Proposal behavior:

- A proposal must belong to one Opportunity.
- Multiple proposals under the same Opportunity are separate records, not implicit revisions of a single row.
- Proposal records remain editable in MVP, but creating a new proposal under the same Opportunity is the recommended way to preserve a separate commercial version.
- Accepted proposals must be ready for the later Orders slice to consume as commercial source context.
- Proposal status changes should be audit-friendly and should not delete the uploaded PDF metadata.

## Uploaded Canva PDF Metadata

The CRM does not replace Canva. Users continue creating the proposal document in Canva and upload the exported PDF to the CRM.

Recommended `ProposalPdfAttachment` fields:

- `id`: stable generated identifier.
- `proposalId`: required relation to `Proposal`.
- `originalFileName`: original user-uploaded filename.
- `storedFileName`: normalized storage filename or object key suffix.
- `storageProvider`: provider key such as `vercel_blob`.
- `storageKey`: provider object key.
- `publicUrl` or `signedUrlKey`: use the application's chosen object-storage access pattern.
- `mimeType`: must be `application/pdf`.
- `fileSizeBytes`: positive integer.
- `sha256`: optional checksum when available.
- `canvaDesignUrl`: optional source Canva design URL pasted by the user.
- `uploadedById`: `User` reference.
- `uploadedAt`: timestamp.
- `replacedAt`: optional timestamp if the implementation keeps replaced uploads.

Upload rules:

- Accept PDF files only.
- Reject empty files.
- Enforce the chosen upload size limit before object-storage write. A practical MVP default is 25 MB unless deployment limits require a smaller value.
- Store file metadata in Postgres and binary file content in object storage.
- Display filename, file size, uploader, upload time, and optional Canva design URL on proposal detail.
- Do not require a PDF while the proposal is `DRAFT`.
- Require a PDF before changing status to `SENT`, unless the business explicitly allows sending a summary-only proposal.

## Opportunities Handoff Requirements

Implementation can start only after the Opportunities slice provides these current, source-backed contracts:

- A landed Opportunity model name and primary key.
- Opportunity relation to `LeadCustomer`.
- Optional Opportunity relation to `Branch` if branch-specific pursuits are supported.
- Opportunity owner field and owner relation to `User`.
- Opportunity status or pipeline-stage fields, including how `Proposal Sent`, `Won`, `Lost`, and `Dormant` are represented.
- Opportunity detail route path for linking proposals, expected to be similar to `/opportunities/[opportunityId]`.
- Query function for loading opportunity detail with its `LeadCustomer`, optional `Branch`, owner, and visibility rules.
- Permission helper or service rule confirming Sales users keep company-wide visibility regardless of owner.
- Server action or mutation pattern for changing opportunity stage when a proposal is sent or accepted.
- Seed data or factory helpers for at least one active opportunity tied to a `LeadCustomer` and optional `Branch`.
- Existing test pattern for opportunity list/detail routes and server actions.

The handoff must also state whether proposal creation is allowed for opportunities in `Lost`, `Won`, or `Dormant` states. Until clarified, the products/proposals slice should allow creation only for active pipeline stages before `Won` or `Lost`.

## Future File Structure After Unblock

These are future implementation targets, not files to edit in this docs-only task:

- Modify: `prisma/schema.prisma`
  Add product/service, proposal, proposal-line, and PDF metadata models after confirming Opportunity relation names.
- Create migration under `prisma/migrations/**`
  Add product/proposal tables and indexes after schema review.
- Modify: `prisma/seed.ts`
  Seed default product/service catalog items after Admin/Sales seed data.
- Create: `src/server/products/types.ts`
  Define product catalog payloads and list result types.
- Create: `src/server/products/validators.ts`
  Validate catalog item input, GST basis points, active flag, and sorting.
- Create: `src/server/products/queries.ts`
  List active products for proposal creation and Admin catalog records for settings.
- Create: `src/server/products/mutations.ts`
  Create, update, activate, and deactivate product/service records.
- Create: `src/server/products/actions.ts`
  Server actions for Admin catalog forms.
- Create: `src/server/proposals/types.ts`
  Define proposal, line-item, status, and PDF metadata payloads.
- Create: `src/server/proposals/calculations.ts`
  Calculate GST and totals from proposal lines.
- Create: `src/server/proposals/validators.ts`
  Validate proposal summary, line items, status transitions, and PDF metadata.
- Create: `src/server/proposals/queries.ts`
  List proposals by opportunity and load proposal detail.
- Create: `src/server/proposals/mutations.ts`
  Create/update proposals, manage line items, persist PDF metadata, and change statuses.
- Create: `src/server/proposals/actions.ts`
  Server actions for proposal forms and status transitions.
- Create: `src/components/products/product-service-form.tsx`
  Admin product/service create/edit form.
- Create: `src/components/products/product-service-list.tsx`
  Admin catalog list with active/inactive controls.
- Create: `src/components/proposals/proposal-form.tsx`
  Proposal header and commercial summary form.
- Create: `src/components/proposals/proposal-line-items.tsx`
  Line item editor with product selection, GST override, and calculated totals.
- Create: `src/components/proposals/proposal-pdf-upload.tsx`
  PDF metadata and upload control.
- Create: `src/components/proposals/proposal-status-actions.tsx`
  Proposal status transition controls.
- Create: `src/app/(app)/admin/products/page.tsx`
  Admin product catalog route.
- Create: `src/app/(app)/admin/products/new/page.tsx`
  Product/service creation route.
- Create: `src/app/(app)/admin/products/[productServiceId]/edit/page.tsx`
  Product/service edit route.
- Create: `src/app/(app)/opportunities/[opportunityId]/proposals/new/page.tsx`
  New proposal route under an opportunity.
- Create: `src/app/(app)/opportunities/[opportunityId]/proposals/[proposalId]/page.tsx`
  Proposal detail route.
- Create: `src/app/(app)/opportunities/[opportunityId]/proposals/[proposalId]/edit/page.tsx`
  Proposal edit route.
- Create: focused tests beside the server modules and browser smoke tests under `tests/e2e`.

## Implementation Tasks After Unblock

### Task 1: Confirm Opportunities Handoff

**Files:**

- Read: landed Opportunity schema, routes, server modules, and tests.
- Modify: this plan if the landed names differ from the assumptions above.

- [ ] Confirm Opportunity model, route, query, mutation, and owner names.
- [ ] Confirm whether proposals can be created for won, lost, or dormant opportunities.
- [ ] Confirm where proposal links should appear on opportunity detail.
- [ ] Confirm whether sending or accepting a proposal changes opportunity stage.
- [ ] Commit any plan updates before implementation if the handoff changes names.

### Task 2: Add Product Catalog Data Model

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/**`
- Modify: `prisma/seed.ts`

- [ ] Add `ProductService` with GST basis points, active flag, production template key, and audit fields.
- [ ] Add indexes for active catalog lookup, category filtering, and stable ordering.
- [ ] Seed the default catalog categories listed in this plan.
- [ ] Validate with `npx prisma validate` and the repo's Prisma generation command.

### Task 3: Add Product Catalog Server Module

**Files:**

- Create: `src/server/products/types.ts`
- Create: `src/server/products/validators.ts`
- Create: `src/server/products/queries.ts`
- Create: `src/server/products/mutations.ts`
- Create: `src/server/products/actions.ts`
- Create: matching unit tests.

- [ ] Validate required name, category, GST basis points, active flag, and sort order.
- [ ] Restrict create/update/deactivate actions to Admin.
- [ ] Allow Sales to read active catalog items for proposal creation.
- [ ] Preserve historical proposal line snapshots when catalog rows change.

### Task 4: Add Proposal Data Model

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/**`

- [ ] Add `Proposal`, `ProposalLineItem`, and `ProposalPdfAttachment`.
- [ ] Use the landed Opportunity relation name from the handoff.
- [ ] Store proposal totals and line totals as integer paise.
- [ ] Store GST rates as integer basis points.
- [ ] Add indexes for opportunity proposals, proposal status, created date, and uploaded PDF lookup.

### Task 5: Add Proposal Calculations And Validation

**Files:**

- Create: `src/server/proposals/calculations.ts`
- Create: `src/server/proposals/validators.ts`
- Create: matching unit tests.

- [ ] Calculate line and proposal totals server-side.
- [ ] Validate proposal title, commercial summary, line items, GST overrides, and status transitions.
- [ ] Require at least one line item before changing status to `SENT`.
- [ ] Require PDF metadata before changing status to `SENT` unless the business explicitly approves summary-only sending.

### Task 6: Add Proposal Queries, Mutations, And Actions

**Files:**

- Create: `src/server/proposals/types.ts`
- Create: `src/server/proposals/queries.ts`
- Create: `src/server/proposals/mutations.ts`
- Create: `src/server/proposals/actions.ts`
- Create: matching unit tests.

- [ ] Load proposals by opportunity with product line snapshots and latest PDF metadata.
- [ ] Create proposal sequence numbers scoped to the opportunity.
- [ ] Update proposal summary and line items transactionally.
- [ ] Persist uploaded PDF metadata after object-storage upload succeeds.
- [ ] Change proposal statuses with audit-friendly validation.
- [ ] Revalidate opportunity and proposal routes after successful writes.

### Task 7: Add Admin Product UI

**Files:**

- Create: product catalog components and Admin routes listed in "Future File Structure After Unblock".
- Create: matching component tests where practical.

- [ ] Render a dense Admin catalog list with status, category, default GST, and production template key.
- [ ] Provide create/edit forms for product/service records.
- [ ] Provide deactivate/reactivate controls instead of destructive deletes.
- [ ] Keep inactive products visible in Admin views.

### Task 8: Add Proposal UI Under Opportunity Detail

**Files:**

- Modify: landed opportunity detail route or component.
- Create: proposal components and routes listed in "Future File Structure After Unblock".
- Create: browser smoke tests.

- [ ] Add proposal list and "New proposal" entry point on opportunity detail.
- [ ] Render proposal form with title, version label, commercial summary, assumptions, inclusions, exclusions, payment terms, and delivery timeline.
- [ ] Render line item editor with product selection, quantity, unit price, GST override, and server-confirmed totals.
- [ ] Render PDF upload metadata for exported Canva PDFs.
- [ ] Render status controls that enforce validation before `SENT`, `ACCEPTED`, or terminal states.

### Task 9: Verify The Slice

**Files:**

- Review all files changed after implementation begins.

- [ ] Run Prisma validation and generation.
- [ ] Run product/proposal unit tests.
- [ ] Run the full repo gate.
- [ ] Run browser smoke tests that create a product, create an opportunity-backed proposal, add proposal lines, upload PDF metadata, and send the proposal.
- [ ] Run `git diff --check`.

## Acceptance Criteria

- Implementation does not start until Opportunities lands and the handoff requirements are satisfied.
- Product/service catalog is Admin-managed and Sales-readable for proposal creation.
- Product/service catalog includes name, category, active flag, default GST, and default production template key.
- Default GST is 18 percent and stored as `1800` basis points.
- Proposal line items copy product/service snapshots so historical proposals do not change when Admin edits the catalog.
- Proposal commercial totals are recalculated server-side and persisted in integer paise.
- Proposal records belong to Opportunities, not directly to `LeadCustomer`.
- Proposal pages expose the linked Opportunity's `LeadCustomer`, optional `Branch`, and owner context without duplicating CRM Core ownership logic.
- Sales users keep company-wide visibility; owner is used for responsibility and filtering only.
- Uploaded Canva PDF metadata stores filename, size, MIME type, storage key, uploader, upload timestamp, and optional Canva design URL.
- PDF binary content is stored in object storage, not Postgres.
- Proposal status cannot move to `SENT` without at least one line item and required PDF metadata unless the business approves summary-only sending.
- Inactive catalog items are hidden from new proposal selection but remain visible on historical proposal lines.
- The implementation includes focused unit tests for GST calculations, proposal totals, validations, permissions, and status transitions.
- Browser smoke coverage verifies an Admin catalog change and a Sales/Admin proposal workflow under a landed Opportunity.

## Open Questions

- What exact Opportunity model, route, and service names will land?
- Should proposals be allowed on won opportunities for post-win revised commercials?
- Should accepted proposals automatically move the Opportunity to `Won`, or should Orders own that transition?
- Should `ProposalPdfAttachment` keep every replaced upload or only the latest attachment metadata?
- What PDF upload size limit should match the deployment target and object-storage provider?
- Should the optional `canvaDesignUrl` be required for all uploaded Canva PDFs?
- Should Sales be allowed to create one-off proposal line descriptions without selecting a catalog item?
- Should product/service categories be a fixed enum, Admin-configurable values, or seeded strings?
- Should GST override reasons be required when a line differs from the product default?
- Should proposal numbering be global, per Opportunity, per financial year, or human-managed?

## Handoff Summary

This plan is ready for the Opportunities implementer to consume, but product/proposal coding is intentionally blocked. Once Opportunities lands, update this artifact with the actual Opportunity names, then implement the catalog and proposal slice without changing CRM Core model names or ownership semantics.
