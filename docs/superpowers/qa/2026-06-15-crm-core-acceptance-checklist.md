# CRM Core Acceptance Checklist

Date: 2026-06-15
Status: Draft for implementation planning
Slice: CRM Core

## Scope

This checklist covers the CRM Core slice only:

- Leads/customers.
- Branches.
- Contacts.
- Activities and follow-ups.
- Ownership and reassignment.
- Sales visibility across company records.
- Admin/Sales permission boundaries where CRM Core touches them.

Out of scope for this slice:

- Opportunities and pipeline stages.
- Proposals, Canva PDF upload, and proposal commercial summaries.
- Orders, PO records, line items, GST totals, production status, invoices, payments, costs, incentives, reports, and CSV import.
- Admin settings beyond any minimal user/role behavior already delivered by foundation.

## Assumptions

- The foundation slice already provides login, Admin and Sales roles, protected app layout, seeded users, and permission helpers.
- CRM Core routes may be adjusted during implementation, but the expected workflow surfaces are dashboard entry, lead/customer list, lead/customer detail, branch/contact management, activity history, follow-up queues, and ownership reassignment.
- Sales users can see all company CRM Core records. Ownership is for responsibility, filtering, follow-up accountability, and reassignment, not record hiding.

## Acceptance Criteria By Route And Workflow

### Authentication And Protected Shell

- Unauthenticated users cannot access CRM Core routes and are redirected to login.
- Authenticated Admin and Sales users can reach the CRM Core navigation from the protected dashboard shell.
- CRM Core pages retain the foundation layout, session state, role display or role-aware navigation, and logout behavior.
- Refreshing a CRM Core page preserves the authenticated session and current route.
- Direct deep links to lead/customer detail pages respect authentication before loading data.

### Leads / Customers List

- Admin and Sales users can view the same company-wide list of lead/customer records.
- The list clearly distinguishes lead/customer state where the state exists.
- The list supports scanning by company name, owner, last activity, and next follow-up where those fields are implemented.
- Filtering by owner does not remove access to records owned by others; it only narrows the visible list.
- Empty state appears when there are no lead/customer records and offers the correct create action.
- Loading and error states are visible and do not break the app shell.

### Create And Edit Lead / Customer

- Admin and Sales users can create a company-level lead/customer with required fields.
- Required-field validation blocks save and identifies the missing fields.
- Duplicate company warnings appear where practical without preventing an intentional save unless the implementation explicitly disallows duplicates.
- Notes and source/industry fields save and display after reload when included in the implementation.
- Owner defaults to the current Sales user where appropriate, or requires an explicit owner selection when created by Admin.
- Editing a lead/customer persists changes without losing related branches, contacts, or activities.
- Changing lead/customer state does not create a separate duplicate company record.

### Lead / Customer Detail

- Detail page displays the company-level CRM record, owner, state, branches, contacts, activity history, and upcoming follow-ups in one coherent workflow.
- Admin and Sales users can open detail pages for records owned by any salesperson.
- Missing optional data renders as a useful empty state, not broken text or layout gaps.
- Detail pages remain usable on laptop layouts and are readable on mobile-sized viewports for lookup, notes, and quick follow-up updates.

### Branches

- Admin and Sales users can add a branch under an existing lead/customer.
- Branches remain linked to the parent lead/customer and do not create an unrelated company record.
- Branch address, location, GST/location hints, and branch-specific sales context save and display when those fields are present.
- A lead/customer can have multiple branches.
- Branch validation prevents saving a blank branch or invalid required location fields.
- Editing or deleting/removing a branch, if supported, does not orphan contacts or activities without a clear warning or reassignment path.

### Contacts

- Admin and Sales users can add multiple contacts to a lead/customer.
- A contact can be linked to the parent lead/customer and optionally to one branch.
- Contact name plus at least one practical communication field, such as email or phone, is validated according to the implementation rules.
- Invalid email or phone formats show clear errors when format validation is implemented.
- Contact lookup works across all company records for Sales users.
- Editing a contact persists after reload and keeps the branch association.
- Duplicate contact warnings appear where practical for the same company or branch.

### Activities And Follow-Ups

- Admin and Sales users can add activities such as call, email, meeting, note, and follow-up where those types are implemented.
- Activity entries are associated with the correct lead/customer and optionally the correct contact or branch.
- Activity history is chronological and shows author, type, note, and timestamp or date.
- Follow-up date/time can be set, updated, cleared, and displayed in upcoming follow-up views.
- Past-due and upcoming follow-ups are visually distinguishable where the UI has status treatment.
- Required notes or activity type validation is enforced.
- Activity creation failure does not clear unsaved user input without warning.

### Ownership And Reassignment

- Every lead/customer has a visible owner when ownership is part of the record.
- Admin can reassign ownership to any active Sales user.
- Sales reassignment behavior follows the implemented rule: either allowed for normal CRM records or blocked with a clear permission error.
- Reassignment persists after reload and updates owner filters, detail header, and any follow-up ownership displays.
- Reassignment does not hide the record from the previous owner or other Sales users.
- Reassignment records enough audit-friendly context to identify who changed ownership and when, if audit metadata is included in CRM Core.
- Inactive users cannot become new owners unless the product explicitly supports historical assignment.

### Sales Company-Wide Visibility

- Sales user A can create a lead/customer.
- Sales user B can view Sales user A's lead/customer, branches, contacts, and activities.
- Sales user B can filter by Sales user A as owner without needing Admin access.
- Sales users cannot access Admin-only settings or user-management pages from CRM Core navigation.
- Sales users cannot perform destructive Admin-only deletes if destructive delete support exists in CRM Core.
- Sales visibility applies to list, detail, search, branch/contact lookup, and follow-up views.

### Admin / Sales Permission Boundaries

- Admin can view and edit all CRM Core records.
- Sales can create and update normal CRM Core records.
- Sales cannot manage users, global settings, pipeline configuration, products/services, production templates, incentives, or destructive Admin actions from CRM Core.
- Permission denials return clear UI feedback and do not expose server errors or partial privileged data.
- API routes, server actions, and pages enforce the same role boundaries; hiding buttons in the UI is not sufficient.

## Validation And Error Scenarios

- Blank company name is rejected.
- Overlong names, notes, addresses, and phone/email fields are handled without layout breakage or database errors.
- Invalid email format is rejected where email validation is implemented.
- Invalid phone format is rejected or normalized according to the selected implementation rule.
- Branch cannot be saved without its required parent lead/customer.
- Contact cannot be saved against a non-existent lead/customer or branch.
- Activity cannot be saved against a non-existent lead/customer, contact, or branch.
- Follow-up date rejects impossible dates and handles past dates intentionally as overdue, not as invalid unless the spec says otherwise.
- Owner reassignment to a missing, inactive, or non-Sales user is rejected.
- Duplicate lead/customer and duplicate contact warnings are tested where implemented.
- Network/server errors show recoverable UI states.
- Browser back/forward and reload do not duplicate submissions.
- Concurrent edits do not silently overwrite critical ownership or follow-up changes without the implementation's chosen conflict behavior.

## Browser Smoke Scenarios

Run these against seeded Admin and Sales users after implementation:

1. Admin login, open dashboard, navigate to CRM Core list, create a lead/customer, add branch, add contact, add activity, set follow-up, reassign owner, reload detail page.
2. Sales login, create a lead/customer, add branch/contact/activity, verify the record appears in list and detail after reload.
3. Second Sales login, find the first Sales user's record, open detail, verify branches, contacts, activities, and follow-up are visible.
4. Sales filter by owner and confirm filtering narrows the list without blocking direct access to other company records.
5. Sales attempts Admin-only user/settings route or destructive CRM action and receives a controlled denial.
6. Unauthenticated browser opens a CRM Core deep link and is redirected to login, then returns or can navigate to the requested workflow after login.
7. Mobile viewport smoke: dashboard to contact lookup, lead detail, note/activity add, and follow-up update remain usable without overlapping controls.

## Foundation Regression Risks

- Protected layout regressions could expose CRM Core pages without login.
- Role helper drift could let Sales manage Admin-only settings or block Sales from company-wide CRM records.
- Session cookie or JWT changes could break direct route refreshes and Playwright login setup.
- Dashboard shell changes could hide CRM Core navigation or produce different behavior for Admin and Sales than intended.
- Prisma schema changes for CRM Core could break the existing User model, seed users, or login smoke tests.
- Tailwind/layout changes could degrade the dense laptop-first CRM interface or mobile lookup workflows.
- Local database fallback assumptions should not mask Vercel/Postgres deployment configuration issues.

## Definition Of Done

- CRM Core records can be created, viewed, edited, and reloaded for leads/customers, branches, contacts, activities, and follow-ups.
- Ownership and reassignment work according to the accepted Admin/Sales rules.
- Sales users have company-wide visibility across CRM Core records regardless of owner.
- Admin/Sales boundaries are enforced in UI and server-side paths.
- Validation errors are clear, recoverable, and tested for required fields and invalid associations.
- Browser smoke covers Admin, Sales, second Sales visibility, unauthorized access, and mobile lookup/update paths.
- Existing foundation auth, layout, seed, and login smoke behavior still pass.
- No CRM Core work introduces opportunities, proposals, orders, payments, production, incentives, reports, or CSV import behavior.

## Gate Checklist

- Review this checklist against the final CRM Core implementation plan before coding.
- Add focused unit/integration coverage for validation, ownership, visibility, and permission boundaries.
- Add browser smoke coverage for create lead/customer, branch, contact, activity/follow-up, reassignment, and cross-salesperson visibility.
- Run the repo's established gate command from foundation status, expected to include lint, tests, build, and relevant e2e checks.
- Run Prisma validation/generation if CRM Core changes schema.
- Confirm Admin and Sales seeded accounts still work.
- Confirm no source files implement out-of-scope opportunities, proposals, orders, payments, production, incentives, reports, or CSV import as part of this slice.
