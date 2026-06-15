# eCRM Product Design

Date: 2026-06-15
Status: Approved for implementation planning

## Purpose

Build a single-company CRM for a small organization with fewer than five salespeople. The app manages the full lead-to-cash workflow: leads, branches, contacts, opportunities, proposals, orders, payment status, production status, incentives, and reports.

The app is designed for laptop use first, hosted on Vercel, with mobile-friendly access for dashboards, lookup, notes, and quick status updates. It is not a native mobile app.

## Core Decisions

- The app is single-company, not multi-tenant.
- The first usable release is a full lead-to-cash MVP, not sales-only.
- The architecture is a modular monolith: one Next.js app with clear module boundaries.
- MVP roles are Admin and Sales only.
- Finance and Operations are workflow modules, not separate roles in the MVP.
- Sales users can see all company leads, contacts, opportunities, proposals, orders, payment status, and production status.
- Ownership is used for responsibility, filtering, reassignment, targets, and incentive calculations, not for hiding records.
- Leads can represent a company-level account or branch-level sales context.
- A lead/customer record persists across repeat orders.
- Opportunities sit between leads and proposals so multiple product/service pursuits can be tracked separately.
- Proposals store a structured commercial summary and an uploaded Canva PDF.
- Invoice records are stored, but invoice PDF generation is out of scope for MVP.
- Files are stored in cloud object storage with database metadata.
- Currency is INR and the financial year is April to March.

## Core Lifecycle

```text
Lead / Branch -> Opportunity -> Proposal(s) -> Order -> Invoices / Payments + Production + Incentives
```

## Architecture

The app will be built as a single Next.js application deployed to Vercel.

Recommended stack:

- Next.js App Router with TypeScript.
- Postgres for relational CRM data.
- Prisma for database schema, migrations, and queries.
- Internal email/password authentication.
- Role checks for Admin and Sales users.
- Vercel Blob or equivalent object storage for proposal PDFs, PO files, and future uploaded documents.
- Tailwind or a practical component system for a dense CRM interface.
- CSV parser and validator for fixed-template lead import.

Primary modules:

- Admin: users, products/services, GST defaults, pipeline stages, production templates, approvals, destructive actions.
- Sales CRM: leads/customers, branches, contacts, activities, opportunities, proposals, orders, targets.
- Finance workflow: invoice records, payments, receivables, collected status, uninvoiced work in progress, cost components.
- Production workflow: order-line production stages and delivery progress.
- Reports: salesperson progress, pipeline, orders, collections, production, and incentives.

## Permissions

MVP roles:

- Admin
- Sales

Admin can:

- View and edit all data.
- Manage users.
- Manage products/services.
- Manage pipeline stages.
- Manage production templates.
- Add and finalize cost components.
- Approve or override incentives.
- Perform destructive deletes where supported.

Sales can:

- View all leads, contacts, branches, opportunities, proposals, orders, payment status, and production status across the company.
- Create and update normal sales records.
- Add activities, follow-ups, proposals, and order-related sales context.
- Filter by owner, pipeline stage, next follow-up, product/service, branch, customer, payment status, and production status.

Sales cannot:

- Manage users.
- Change global admin settings.
- Finalize cost components.
- Approve or override incentives.
- Perform destructive admin deletes.

Ownership rules:

- Each opportunity/order has a primary salesperson by default.
- Ownership can be reassigned because the team is small and attrition can require handoff.
- Optional incentive splits allow multiple salespeople to share incentive by percentage.
- Ownership drives target reporting and incentive calculation.

## Data Model

### User

Stores name, email, password hash, role, and active flag.

### Lead / Customer

Stores company name, lead/customer state, industry, source, owner, and notes. The same record can start as a lead and later behave as a customer with repeat orders.

### Branch

Belongs to a lead/customer. Stores address, location, GST/location hints, and branch-specific sales context. A branch can be used as a separate sales context while remaining linked to the parent lead/customer.

### Contact

Belongs to a lead/customer and optionally a branch. Stores person name, designation, email, phone, and notes. One lead can have many contacts.

### Opportunity

Belongs to a lead/customer and optionally a branch. Stores owner, optional split salespeople, product/service interest, pipeline stage, value estimate, last reach, next follow-up, and won/lost state.

Each separate sales pursuit should be its own opportunity. Example: one lead can have one eLearning opportunity, one Video Shoot opportunity, and one VR/AR opportunity at the same time.

### Proposal

Belongs to an opportunity. Stores title, sequence/version label, structured commercial summary, quoted amount, GST summary, status, uploaded Canva PDF metadata, and editable notes.

Multiple proposals under the same opportunity are separate proposal records. They can represent alternate offerings, revised commercials, or different proposal documents.

Proposal records remain editable in MVP. If the team wants to preserve a separate historical commercial version, they should create another proposal record under the same opportunity.

### Product / Service

Admin-managed catalog with name, category, default GST, default production template, and active flag. Products/services can be added as needed.

### Order

Created when an opportunity is won and a PO/order is received. Stores lead/customer, opportunity, PO details, booked value excluding GST, GST, total value, primary owner, and optional incentive splits.

### Order Line Item

Stores product/service, quantity, price, GST rate, production template, and production status. One order can contain multiple product/service line items.

### Invoice

Stores invoice number, order, amount, GST, due date, and status. MVP creates invoice records only. PDF invoice generation is deferred.

### Payment

Stores amount, payment date, mode/reference, and linked invoice/order context. Payments can be one-time or installments.

Order payment completion is tracked cumulatively across invoices and payments.

### Cost Component

Stores costs such as external vendor cost, shipping cost, printing cost, miscellaneous cost, travel cost, and similar items. Costs are used for gross margin and incentive calculation.

### Incentive

Stores calculated gross margin, incentive amount, split recipients, approval status, and approval/override metadata.

### Production Stage Template

Stores reusable stage templates for product/service categories. The app ships with seeded defaults and Admin can edit or add templates.

### Production Stage Instance

Stores actual progress stages for an order line item. Each line item gets its own stage instances based on its selected production template.

### Target

Stores salesperson, financial year, quarter, and booked order value target excluding GST.

### Activity / Follow-up

Stores calls, emails, meetings, notes, last reach, next follow-up, and activity history.

### Import Batch

Stores CSV import metadata, accepted rows, rejected rows, validation errors, and import audit history.

## Business Rules

### Targets

- Targets are assigned to salespeople.
- Financial year runs April to March.
- Target reports support quarterly and yearly views.
- Target achievement is based on booked order value excluding GST.

### GST

- Currency is INR.
- Default GST is 18%.
- Product/service and branch/location can suggest GST rates.
- Final GST rate is stored per proposal/order line item.
- Exceptions such as 0% GST or lower GST are supported by overriding the line-level GST rate.

### Orders, Invoices, And Payments

- One won opportunity can lead to an order.
- The same lead/customer can have repeat orders over time through additional opportunities and orders.
- One order can contain multiple products/services.
- One order can be split into multiple invoice records.
- Payments can be one-time or installment-based.
- Payment completion is tracked cumulatively against the order.
- Payment status should be visible to all users.

### Costs And Incentives

- Admin can add cost components against an order or line item.
- Gross margin = booked order value excluding GST minus approved cost components.
- Incentive = 5% of gross margin.
- Incentive is payable only after full payment receipt for the order.
- Default incentive recipient is the primary salesperson.
- Optional split percentages can distribute incentive across multiple salespeople.
- Admin approves or overrides incentive payouts in the MVP.

### Production

- Production status is tracked per order line item.
- Production status should be visible to all users.
- Product/service categories have seeded stage templates.
- Admin can edit or add production templates.
- Each order line item gets its own production stage instances.

Seeded production templates:

- eLearning: script, storyboard, voiceover, editing, review, edits, completion.
- Video shoot: script, video shoot, voiceover, editing, review, edits, completion.
- VR/AR: script, development, voiceover, editing, review, edits, completion.
- Animation: script, modeling, voiceover, editing, review, edits, completion.

## Screens And Workflows

### Dashboard

Role-aware dashboard. In MVP, Admin and Sales both see company-wide operational status, but Admin sees extra controls.

Dashboard cards should include:

- Open opportunities.
- Upcoming follow-ups.
- Booked order value.
- Target progress.
- Pending payments.
- Collected payments.
- Production pending.
- Incentives pending approval or payout.

### Leads / Customers

Manage company/customer records, branch records, contacts, activities, ownership, and lead/customer state.

### Opportunities

Pipeline board/list with stage, value, product interest, last reach, next follow-up, owner, and split information.

Default pipeline stages:

- Lead
- Qualified
- Proposal Sent
- Negotiation
- Won
- Lost
- Dormant

Admin can customize pipeline stages.

### Proposals

Manage proposal records under opportunities. Each proposal stores a commercial summary and an uploaded Canva PDF. The CRM does not replace Canva in MVP.

### Orders

Create and manage PO/order records, line items, GST, owner/splits, and links to opportunity/proposal context.

### Finance Workflow

Admin-managed in MVP:

- Invoice records.
- Payments.
- Pending receivables.
- Collected payments.
- Uninvoiced work in progress.
- Cost components.
- Incentive readiness.

Payment status is visible company-wide.

### Production Workflow

Track production stages per order line item. Production status is visible company-wide.

### Reports

Reports should include:

- Salesperson target progress.
- Quarterly and yearly booked value.
- Pipeline by stage.
- Opportunity conversion.
- Orders by customer/product/salesperson.
- Pending and collected payments.
- Production progress.
- Incentive calculations and approval status.

### Admin Settings

Admin settings include:

- Users.
- Products/services.
- GST defaults.
- Pipeline stages.
- Production templates.
- Incentive approval/override.

## CSV Import

MVP supports fixed-template CSV import for leads.

Import flow:

1. Upload CSV.
2. Validate required fields and supported values.
3. Show preview with accepted and rejected rows.
4. Import valid rows.
5. Store rejected rows and error messages.

Column mapping is deferred.

## Mobile Scope

Mobile support is web responsive, not a native app.

Mobile-friendly workflows:

- Dashboard review.
- Pipeline review.
- Contact lookup.
- Call notes and follow-ups.
- Opportunity status updates.
- Payment status checks.
- Production status checks.

Laptop-first workflows:

- CSV import.
- Admin setup.
- Product/service configuration.
- Production template configuration.
- Complex reporting.
- Finance-heavy entry.
- Incentive review.

## Error Handling And Audit

The app should provide clear validation and audit-friendly behavior:

- Required-field validation for core records.
- Duplicate warnings for leads/contacts where practical.
- CSV import row-level errors.
- File upload type/size validation.
- Payment totals cannot silently exceed expected order totals without an explicit warning.
- Incentive cannot move to payable until full payment receipt is confirmed.
- Admin override actions should capture who performed the override and when.
- Destructive deletes should be limited to Admin and should be avoided for records with downstream history where soft-delete is safer.

## Testing Strategy

Unit tests:

- GST calculations.
- Order totals.
- Payment completion.
- Gross margin.
- Incentive amount.
- Incentive split percentages.
- Financial year and quarter calculations.
- Target progress.

Integration tests:

- Authentication.
- Admin vs Sales permissions.
- Lead/contact/opportunity creation.
- Proposal creation and file metadata.
- Order creation from opportunity.
- Invoice/payment flows.
- Production stage creation per order line item.
- CSV import validation.

Browser smoke tests:

- Login.
- Dashboard loads.
- Create lead, branch, and contact.
- Create opportunity.
- Add proposal summary and PDF metadata/upload.
- Create order with multiple line items.
- Add invoice and payment.
- Update production status.
- View reports.

## Out Of Scope For MVP

- Multi-tenant signup.
- Native mobile app.
- Google/Microsoft login.
- Invoice PDF generation.
- Arbitrary CSV column mapping.
- Full document editor for proposals.
- Replacing Canva.
- Separate Finance and Operations roles.
- External accounting system integration.
- Advanced automation and email sync.

## Implementation Slices

1. Foundation: project setup, auth, users, roles, layout, database, seed data.
2. CRM core: leads/customers, branches, contacts, activities, ownership/reassignment.
3. Opportunities and pipeline: configurable stages, pipeline/list views, targets.
4. Products/services and proposals: catalog, GST defaults, proposal summaries, PDF uploads.
5. Orders and production: PO/order records, line items, production templates/instances.
6. Invoices and payments: invoice records, installments, cumulative order payment tracking.
7. Costs and incentives: cost components, gross margin, 5% incentive, split support, admin approval.
8. Reports and dashboards: sales progress, pipeline, orders, payments, production, incentives.
9. CSV import and hardening: fixed template, validation, rejected rows, audit/history.
10. Responsive polish: mobile dashboard, quick updates, contact lookup, notes, status changes.
