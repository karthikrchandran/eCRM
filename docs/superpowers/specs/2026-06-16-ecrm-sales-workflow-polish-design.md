# eCRM Sales Workflow Polish Design

Date: 2026-06-16
Status: Draft for user review

## Context

The current eCRM implementation has the core sales, product, proposal, order, production, finance, and reporting slices in place, but the sales-facing UI reads as a set of plain lists and database forms. Admin and sales demo users are visually similar, seed data looks static, several green action buttons need stronger text contrast, and proposal document handling exposes storage metadata rather than a simple user workflow.

The selected direction is Option A: professional list polish. The goal is to improve the existing sales workflow without introducing a new sales cockpit or broad CRM redesign in this slice.

## Goals

- Make the current sales pages feel more professional, credible, and easier to scan.
- Keep both manual lead entry and CSV import, presented as clear intake paths.
- Make Admin and Sales identities visibly distinct in the shell, selectors, and seed data.
- Ensure green primary buttons consistently use white text.
- Improve lead, opportunity, and proposal pages without changing their core data ownership model.
- Treat proposal documents as simple external links that open in a new browser tab or window.
- Keep Canva optional as a design/source link, not a required render path.

## Non-Goals

- No new sales cockpit dashboard in this slice.
- No S3, Azure Blob, Supabase Storage, or other managed file storage.
- No in-app PDF hosting, upload pipeline, or embedded PDF viewer.
- No production template builder or deep admin production-status management in this slice.
- No broad redesign of every module in the product.

## Scope

### Global UI Polish

Introduce or refine reusable UI patterns for the existing app:

- Page headers with title, short operational context, and primary actions.
- Metric or summary strips where a list benefits from quick scanning.
- Role badges for Admin and Sales users.
- Status badges for lead state, proposal status, production status, and active/inactive records.
- Consistent action groups for primary and secondary actions.
- Professional empty states for no records, no matching filters, and no linked proposal document.
- Global primary button styling that guarantees white text on green backgrounds.

These should be lightweight components or shared class conventions that match the current Next.js App Router and Tailwind setup.

### App Shell And Identity

The shell should make the signed-in user clearer:

- Show name, email, and role badge.
- Give Admin and Sales role badges distinct visual treatment.
- Improve nav presentation without changing route structure.
- Keep mobile behavior simple and reliable.

Seed users should be renamed from generic "Admin User" and "Sales User" to realistic, distinct demo personas. This should make role differences obvious during local review.

### Lead Workflow

The leads page remains the primary sales intake surface.

Changes:

- Present "Add one lead" and "Import leads from CSV" as two clear intake options.
- Keep the existing manual form and CSV import route.
- Improve filters so search, owner, state, and follow-up controls are easier to scan.
- Improve lead rows with clearer hierarchy: customer name, state badge, owner identity, coverage counts, next follow-up, and updated date.
- Add better empty states for no leads and no filter matches.

Manual entry and CSV import should remain separate workflows. This avoids mixing upload validation and single-record creation in one complex form.

### Opportunity And Proposal Workflow

Opportunity and proposal pages should feel more like sales workflow screens and less like raw records.

Proposal creation:

- Keep the existing proposal form and product selection.
- Improve section layout and field grouping.
- Present commercial fields as proposal content areas.
- Make line-item entry easier to understand.

Proposal detail:

- Use a stronger commercial document header with customer, opportunity, status, validity, and total.
- Group customer/opportunity context separately from commercial text.
- Keep status actions visible but not visually dominant.
- Make totals and line items easier to scan.
- Rename "PDF metadata" to proposal documents or linked documents.

### Proposal Documents

Proposal documents are external links in this slice.

Behavior:

- The CRM stores a document reference and opens it in a new tab/window.
- If a document URL exists, show an "Open document" action.
- If a Canva URL exists, show it as an optional "Open Canva design" action.
- If neither exists, show an empty state that asks the user to add a proposal document link.
- The app must not depend on Canva to view a proposal.
- The app must not pretend to host or render a PDF when it only has metadata.

Implementation can reuse the existing `ProposalPdfAttachment` table. The safest first implementation is to treat the existing `storageKey` as the external document URL when `storageProvider` is set to a URL-style provider such as `external`, `sharepoint`, `onedrive`, `google_drive`, or `local_link`. If this mapping becomes awkward during implementation, add the smallest schema change needed for a clear document URL field.

The user-facing form should ask for:

- Document name.
- Document URL.
- Optional Canva/design URL.
- Optional version or notes only if it fits the existing schema cleanly.

### Demo Freshness

Seed data should remain useful for smoke checks but look less stale.

Changes:

- Use distinct Admin and Sales demo names.
- Refresh customer, contact, opportunity, proposal, and document names to feel current.
- Avoid implying all data is fake in user-visible copy.
- Keep deterministic seed IDs so existing tests remain stable where possible.

## Permissions

Use the existing role model unless a current route already enforces stricter access.

- Sales users can add leads one at a time, import CSV, create proposals, and add proposal document links for proposals they can access.
- Admin users retain company-wide visibility and product administration access.
- Role display is a UI clarity improvement, not a new authorization model.

## Data And Architecture

Preferred architecture:

- Add focused UI helpers/components under `src/components/` where reuse is clear.
- Keep server-side authorization in existing server modules.
- Keep validation in existing validator/action layers.
- Avoid large cross-cutting rewrites.
- Do not introduce a new design system package.

Proposal document handling should start from the existing proposal attachment model. If the implementation can cleanly use existing fields, do that. If not, add a narrow migration for an explicit document URL while preserving existing attachment metadata.

## Error Handling

- Invalid document URLs should return field-level errors.
- CSV preview/import errors should remain row-level and readable.
- Empty states should distinguish "no data yet" from "filters hide all records."
- Proposal document links should open in a new tab and use safe link attributes.
- Missing optional Canva links should not block proposal viewing.

## Testing And Verification

Expected tests:

- Unit tests for any changed proposal document validation or parsing.
- Component tests for lead/proposal presentation where existing tests already cover those surfaces.
- E2E update for the products/proposals flow:
  - Create or inspect a proposal.
  - Confirm polished proposal detail content is visible.
  - Add a proposal document link.
  - Confirm the document action renders as an external link.
- E2E or component coverage for lead intake labels if the current tests cover that page.

Final verification commands:

```powershell
npm run test
npm run gate
npm run test:e2e -- tests/e2e/products-proposals.spec.ts
```

Broader E2E may be run if shared shell or navigation changes affect multiple pages.

## Acceptance Criteria

- Green primary buttons have white text across the touched pages.
- Admin and Sales users are visually distinguishable in the app shell and selectors.
- Leads page presents manual entry and CSV import as clear, separate intake paths.
- Leads page is more scannable and no longer reads as a plain database table.
- Proposal creation/detail pages have clearer commercial structure.
- Proposal document handling is understandable to a user: add a link, then open it in a new tab/window.
- Canva is optional and never required for proposal viewing.
- Seed data looks current enough for demo review while preserving test stability.
- The agreed verification commands pass or any blocker is documented clearly.
