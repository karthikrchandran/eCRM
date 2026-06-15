# eCRM Reports After CRM Core Plan

Date: 2026-06-15
Status: Planning artifact only
Branch: `plan/reports-after-crm`
Source baseline: `main` at `22587ce` after CRM Core landed

## Purpose

Define the dashboard and reports metrics that can be planned immediately after CRM Core, without building queries or introducing future data models. This document is a metric contract and dependency map for future reports/dashboard work.

CRM Core now provides reliable lead/customer, branch, contact, activity, follow-up, owner, and ownership history data. It does not provide opportunities, orders, invoices, payments, costs, incentives, production stages, products/services, targets, or proposal commercial values. Dashboard cards must respect that boundary.

## Current Source Of Truth

Use these landed CRM Core names exactly:

| Area | Landed name | Relevant fields |
| --- | --- | --- |
| User and owner model | `User` | `id`, `name`, `email`, `role`, `active`, `createdAt`, `updatedAt` |
| User roles | `UserRole` | `ADMIN`, `SALES` |
| Lead/customer | `LeadCustomer` | `id`, `name`, `state`, `industry`, `source`, `ownerId`, `notes`, `createdById`, `updatedById`, `createdAt`, `updatedAt` |
| Lead state | `LeadState` | `LEAD`, `CUSTOMER`, `DORMANT` |
| Branch | `Branch` | `id`, `leadCustomerId`, `name`, `addressLine1`, `addressLine2`, `city`, `region`, `postalCode`, `country`, `gstin`, `locationHint`, `salesContext`, `notes`, `createdAt`, `updatedAt` |
| Contact | `Contact` | `id`, `leadCustomerId`, `branchId`, `name`, `designation`, `email`, `phone`, `isPrimary`, `notes`, `createdAt`, `updatedAt` |
| Activity and follow-up | `Activity` | `id`, `leadCustomerId`, `branchId`, `contactId`, `ownerId`, `createdById`, `completedById`, `type`, `status`, `subject`, `body`, `occurredAt`, `dueAt`, `completedAt`, `createdAt`, `updatedAt` |
| Activity type | `ActivityType` | `CALL`, `EMAIL`, `MEETING`, `NOTE`, `FOLLOW_UP` |
| Activity status | `ActivityStatus` | `OPEN`, `COMPLETED`, `CANCELLED` |
| Ownership audit | `LeadOwnershipHistory` | `id`, `leadCustomerId`, `fromOwnerId`, `toOwnerId`, `changedById`, `reason`, `createdAt` |

Permission source of truth:

- `canViewCompanyRecords(role)` returns true for `ADMIN` and `SALES`.
- `assertCanViewCrmRecords(user)` is the CRM read guard.
- `assertCanWriteCrmRecords(user)` allows `ADMIN` and `SALES` to change CRM Core records.
- Sales visibility is company-wide. `ownerId` is for responsibility, filtering, reassignment, target attribution, and future incentive attribution. It is not a row-level access boundary.

## Dashboard Card Readiness

The current dashboard shell lists open opportunities, upcoming follow-ups, booked value, pending payments, production pending, and incentives pending. Only the follow-up card can be backed by CRM Core today. Several additional CRM health cards can also be backed now if the dashboard wants honest CRM Core content before the downstream modules land.

| Card or metric | Readiness after CRM Core | Source fields now | Blocking dependency |
| --- | --- | --- | --- |
| Upcoming follow-ups | Backed now | `Activity.status`, `Activity.dueAt`, `Activity.ownerId`, `Activity.leadCustomerId` | None |
| Overdue follow-ups | Backed now | `Activity.status`, `Activity.dueAt`, `Activity.ownerId` | None |
| Due today follow-ups | Backed now | `Activity.status`, `Activity.dueAt`, `Activity.ownerId` | None |
| Lead/customer count by state | Backed now | `LeadCustomer.state`, `LeadCustomer.ownerId`, `LeadCustomer.createdAt` | None |
| New CRM records in period | Backed now | `LeadCustomer.createdAt`, `LeadCustomer.state`, `LeadCustomer.ownerId` | None |
| Activity volume by type/status | Backed now | `Activity.type`, `Activity.status`, `Activity.createdAt`, `Activity.occurredAt`, `Activity.ownerId` | None |
| Contacts created in period | Backed now | `Contact.createdAt`, `Contact.leadCustomerId`, `Contact.branchId`, `Contact.isPrimary` | None |
| Branch coverage by location | Backed now | `Branch.city`, `Branch.region`, `Branch.country`, `Branch.leadCustomerId` | None |
| Recent owner reassignments | Backed now | `LeadOwnershipHistory.fromOwnerId`, `LeadOwnershipHistory.toOwnerId`, `LeadOwnershipHistory.changedById`, `LeadOwnershipHistory.createdAt` | None |
| Open opportunities | Blocked | None in CRM Core | Opportunities |
| Pipeline by stage | Blocked | None in CRM Core | Opportunities |
| Opportunity conversion | Blocked | None in CRM Core | Opportunities, then Orders for won-to-booked analysis |
| Target progress | Blocked | Owner exists now, but no target or booked-value source | Opportunities or target module, plus Orders |
| Booked order value | Blocked | None in CRM Core | Orders |
| Quarterly/yearly booked value | Blocked | None in CRM Core | Orders |
| Orders by customer/product/salesperson | Blocked | Customer and owner exist now, but no order/product source | Orders, Products/Services |
| Pending payments | Blocked | None in CRM Core | Orders, Invoices, Payments |
| Collected payments | Blocked | None in CRM Core | Orders, Payments |
| Production pending | Blocked | None in CRM Core | Orders, Production |
| Production progress | Blocked | None in CRM Core | Production |
| Gross margin | Blocked | None in CRM Core | Orders, Costs/Incentives |
| Incentives pending approval or payout | Blocked | Owner exists now, but no margin, payment completion, split, or approval source | Payments, Costs/Incentives |

## Backed-Now Metric Definitions

### Follow-Up Counts

Definition:

- Overdue follow-ups: count `Activity` rows where `status = OPEN`, `dueAt` is set, and `dueAt` is before the start of today.
- Due today follow-ups: count `Activity` rows where `status = OPEN`, `dueAt` is set, and `dueAt` falls from the start of today up to but not including the start of tomorrow.
- Upcoming follow-ups: count `Activity` rows where `status = OPEN`, `dueAt` is set, and `dueAt` is on or after the start of tomorrow.

Source fields:

- `Activity.status`
- `Activity.dueAt`
- `Activity.ownerId`
- `Activity.leadCustomerId`
- Optional display joins: `LeadCustomer.name`, `User.name`

Filters:

- Date bucket: overdue, today, upcoming, custom date range.
- Owner: `Activity.ownerId`, not `LeadCustomer.ownerId`.
- Lead state: join to `LeadCustomer.state`.
- Activity type: `Activity.type`.

Visibility:

- `ADMIN` and `SALES` see company-wide counts.
- Owner filters narrow the count but do not hide other owners by default.

Guardrails:

- Exclude activities with `status = COMPLETED` or `status = CANCELLED`.
- Exclude activities with `dueAt = null` from follow-up due-date buckets.
- Use the same local day-boundary behavior as `getDashboardFollowUpCounts()` until the product defines a specific reporting timezone.
- Do not treat `Activity.type = NOTE` with no `dueAt` as a follow-up.

### Lead/Customer State Counts

Definition:

- Count `LeadCustomer` rows by `state`.
- Valid states are `LEAD`, `CUSTOMER`, and `DORMANT`.

Source fields:

- `LeadCustomer.id`
- `LeadCustomer.state`
- `LeadCustomer.ownerId`
- `LeadCustomer.createdAt`
- `LeadCustomer.updatedAt`

Filters:

- State: `LeadCustomer.state`.
- Owner: `LeadCustomer.ownerId`.
- Created date range: `LeadCustomer.createdAt`.
- Updated date range: `LeadCustomer.updatedAt`.
- Source and industry: `LeadCustomer.source`, `LeadCustomer.industry`.

Visibility:

- `ADMIN` and `SALES` see all company lead/customer rows.
- Owner filters are reporting filters only.

Guardrails:

- Do not infer conversion from `LEAD` to `CUSTOMER` as opportunity conversion. CRM Core has no opportunity or order outcome model yet.
- Do not infer booked revenue from `LeadCustomer.state`.
- Count `LeadCustomer.id` once even when joining branches, contacts, or activities.

### New CRM Records

Definition:

- Count `LeadCustomer` rows created inside a reporting date range.
- Optional split by `state`, `source`, `industry`, or owner.

Source fields:

- `LeadCustomer.createdAt`
- `LeadCustomer.state`
- `LeadCustomer.source`
- `LeadCustomer.industry`
- `LeadCustomer.ownerId`

Filters:

- Date range: `LeadCustomer.createdAt`.
- Owner: `LeadCustomer.ownerId`.
- State, source, industry.

Visibility:

- Company-wide for `ADMIN` and `SALES`.

Guardrails:

- This is a CRM intake metric, not a sales performance or revenue metric.
- Avoid counting branches or contacts as new customers.

### Activity Volume

Definition:

- Count `Activity` rows by `type` and `status` inside a reporting date range.
- Use `occurredAt` for business occurrence when present; otherwise use `createdAt` as the fallback reporting timestamp.

Source fields:

- `Activity.type`
- `Activity.status`
- `Activity.occurredAt`
- `Activity.createdAt`
- `Activity.completedAt`
- `Activity.ownerId`
- `Activity.leadCustomerId`
- Optional display joins: `LeadCustomer.name`, `Contact.name`, `Branch.name`

Filters:

- Date range: `Activity.occurredAt` when set, otherwise `Activity.createdAt`.
- Owner: `Activity.ownerId`.
- Type: `Activity.type`.
- Status: `Activity.status`.
- Lead/customer, branch, and contact.

Visibility:

- Company-wide for `ADMIN` and `SALES`.

Guardrails:

- Do not collapse `CALL`, `EMAIL`, `MEETING`, `NOTE`, and `FOLLOW_UP` into a single engagement score unless the product defines weighting.
- Do not use `completedAt` as activity occurrence time for open activities.

### Contact Coverage

Definition:

- Count contacts and primary contacts per lead/customer.
- Count lead/customers with at least one contact.
- Count contacts missing both `email` and `phone` as contact-data gaps.

Source fields:

- `Contact.id`
- `Contact.leadCustomerId`
- `Contact.branchId`
- `Contact.email`
- `Contact.phone`
- `Contact.isPrimary`
- `Contact.createdAt`

Filters:

- Created date range: `Contact.createdAt`.
- Branch: `Contact.branchId`.
- Lead/customer state via `LeadCustomer.state`.
- Owner via `LeadCustomer.ownerId`.

Visibility:

- Company-wide for `ADMIN` and `SALES`.

Guardrails:

- A contact can be linked to a lead/customer without a branch. Treat `branchId = null` as unassigned to branch, not invalid.
- Do not assume `isPrimary = true` is unique per lead/customer unless the schema or validation later enforces it.

### Branch Coverage

Definition:

- Count branches per lead/customer and by location.
- Count lead/customers with at least one branch.

Source fields:

- `Branch.id`
- `Branch.leadCustomerId`
- `Branch.city`
- `Branch.region`
- `Branch.country`
- `Branch.createdAt`

Filters:

- City, region, country.
- Created date range: `Branch.createdAt`.
- Lead/customer state via `LeadCustomer.state`.
- Owner via `LeadCustomer.ownerId`.

Visibility:

- Company-wide for `ADMIN` and `SALES`.

Guardrails:

- Branches are child sales contexts, not separate customers.
- Do not double-count parent lead/customers when aggregating by branch.

### Owner Workload

Definition:

- Count lead/customers by `LeadCustomer.ownerId`.
- Count open follow-ups and activities by `Activity.ownerId`.
- Use both owner dimensions explicitly because a lead owner and an activity owner can differ.

Source fields:

- `LeadCustomer.ownerId`
- `Activity.ownerId`
- `Activity.status`
- `Activity.dueAt`
- `User.id`
- `User.name`
- `User.email`
- `User.role`
- `User.active`

Filters:

- Owner.
- Lead/customer state.
- Activity status and due-date bucket.

Visibility:

- Company-wide for `ADMIN` and `SALES`.

Guardrails:

- Owner options for new assignments should remain active users where `role in (ADMIN, SALES)`, matching CRM Core behavior.
- Historical reports should not drop records owned by inactive users unless the report is explicitly limited to current active owners.
- Never use owner as a security filter for Sales users.

### Ownership Reassignment Activity

Definition:

- Count `LeadOwnershipHistory` rows in a date range.
- Display recent ownership changes with from owner, to owner, changed by, reason, lead/customer, and timestamp.

Source fields:

- `LeadOwnershipHistory.leadCustomerId`
- `LeadOwnershipHistory.fromOwnerId`
- `LeadOwnershipHistory.toOwnerId`
- `LeadOwnershipHistory.changedById`
- `LeadOwnershipHistory.reason`
- `LeadOwnershipHistory.createdAt`

Filters:

- Date range: `LeadOwnershipHistory.createdAt`.
- From owner: `fromOwnerId`.
- To owner: `toOwnerId`.
- Changed by: `changedById`.
- Lead/customer state via `LeadCustomer.state`.

Visibility:

- Company-wide for `ADMIN` and `SALES` unless future product decisions make reassignment audit Admin-only.

Guardrails:

- `fromOwnerId` can be null for historical imports or future bootstrap scenarios. Treat that as no prior owner, not a broken record.
- Reassignment count is not a productivity metric by itself. It needs context.

## Blocked Future Metric Contracts

These cards should stay hidden, disabled, or explicitly marked unavailable until their source modules land. Do not keep hard-coded zero values on the dashboard and imply they are live.

### Opportunities Dependency

Unblocked after an Opportunity model and pipeline stage model land:

- Open opportunities.
- Pipeline by stage.
- Opportunity aging.
- Opportunity conversion by stage.
- Estimated pipeline value.
- Opportunity next follow-up if the follow-up source moves from CRM `Activity` to an opportunity-level field.

CRM Core can supply:

- Parent `LeadCustomer`.
- Optional `Branch`.
- Owner list through active `User` rows.
- Activity history and follow-up context.

Still missing:

- Opportunity identifier.
- Pipeline stage.
- Estimated value.
- Won/lost state.
- Product/service interest.
- Split owner semantics.

### Orders Dependency

Unblocked after Orders land:

- Booked order value.
- Quarterly and yearly booked value.
- Orders by customer.
- Orders by salesperson.
- Orders by product/service once product line items exist.
- Target achievement numerator.

CRM Core can supply:

- Customer context through `LeadCustomer`.
- Branch context through `Branch`.
- Primary owner candidate through `LeadCustomer.ownerId` or future order owner.

Still missing:

- Order record.
- PO/order dates.
- Booked value excluding GST.
- GST value and total value.
- Order owner and optional splits.
- Order line items.

### Payments Dependency

Unblocked after invoice and payment records land:

- Pending payments.
- Collected payments.
- Receivables aging.
- Collection rate.
- Payment completion by order.

CRM Core can supply:

- Customer, branch, contact, and owner context.

Still missing:

- Invoice amount, due date, and status.
- Payment amount, date, mode/reference, and allocation.
- Cumulative payment status.
- Rules for overpayment or partial payment.

### Costs And Incentives Dependency

Unblocked after cost components, gross margin, incentive splits, approval, and payment-completion dependencies land:

- Gross margin.
- Incentive amount.
- Incentives pending approval.
- Incentives payable.
- Incentives paid or closed.

CRM Core can supply:

- Owner context for default attribution.
- Ownership history for audit context.

Still missing:

- Order value excluding GST.
- Approved cost components.
- Payment completion.
- Incentive split recipients and percentages.
- Admin approval or override state.

### Production Dependency

Unblocked after production templates and production stage instances land:

- Production pending.
- Production progress by order line item.
- Delayed production stages.
- Production workload by product/service category.

CRM Core can supply:

- Customer and branch context.
- Contact context for coordination.

Still missing:

- Order line item.
- Product/service category.
- Production template.
- Stage instance.
- Stage status and due dates.

## Shared Filter Contract

Use filters only when the source field exists. Avoid UI filters that silently do nothing.

| Filter | CRM Core source today | Future source when downstream modules land |
| --- | --- | --- |
| Reporting date range | `LeadCustomer.createdAt`, `Branch.createdAt`, `Contact.createdAt`, `Activity.createdAt`, `Activity.occurredAt`, `Activity.dueAt`, `LeadOwnershipHistory.createdAt` | Opportunity dates, order dates, invoice due dates, payment dates, production stage dates, incentive approval dates |
| Owner | `LeadCustomer.ownerId`, `Activity.ownerId`, `LeadOwnershipHistory.toOwnerId` or `fromOwnerId` | Opportunity owner, order owner, incentive recipients |
| Lead/customer state | `LeadCustomer.state` | Same parent context |
| Activity status | `Activity.status` | Same until opportunity-specific tasking exists |
| Activity type | `Activity.type` | Same until opportunity-specific tasking exists |
| Branch/location | `Branch.city`, `Branch.region`, `Branch.country`; optional `branchId` on `Contact` and `Activity` | Order ship/bill location, production location if added |
| Source and industry | `LeadCustomer.source`, `LeadCustomer.industry` | Same parent context |
| Pipeline stage | Not available | Opportunity/pipeline stage |
| Product/service | Not available | Product/service catalog, order line item |
| Payment status | Not available | Invoice/payment/order payment rollup |
| Production status | Not available | Production stage instance |
| Incentive status | Not available | Incentive approval/payout state |

## Permissions Visibility Contract

Dashboard and reports must call server-side permission checks before reading data:

- Use `requireUser()` at protected app surfaces.
- Use `assertCanViewCrmRecords(user)` or the equivalent module-specific read guard for CRM Core metrics.
- Preserve company-wide visibility for both `ADMIN` and `SALES`.
- Treat owner filters as user-selected reporting filters, not implicit security filters.
- Do not create hidden per-owner Sales dashboards unless the product decision changes the current visibility model.

Future module visibility:

- Opportunities, orders, payment status, and production status are visible to Sales and Admin per the product design.
- Admin-only behavior applies to user management, global settings, finalizing costs, approving/overriding incentives, production template management, and destructive actions.
- Sales may view payment and production status, but should not gain Admin-only mutation rights from report drilldowns.

## Implementation Guardrails

- This artifact does not authorize changes to `prisma/**`, `src/**`, `tests/**`, package files, config files, seed data, or migrations.
- Do not implement report queries from this planning branch.
- Do not add speculative columns or placeholder tables for opportunities, orders, payments, costs, incentives, or production.
- Do not display hard-coded zeros for blocked metrics as if they are live data.
- A dashboard card is production-ready only when every field in its source contract has landed and the card uses live data.
- If a card cannot be backed by landed data, hide it, disable it with clear unavailable copy, or keep it out of the dashboard until its dependency lands.
- Keep CRM Core metrics separated from financial metrics. Lead/customer activity is not revenue.
- Use explicit metric names. For example, say "Open follow-ups" instead of "Sales pipeline" when the source is only `Activity`.
- Keep date bucket definitions stable across dashboard cards and reports.
- Avoid overcounting parent records when joining child tables. Count distinct parent identifiers when the metric is about parent records.
- Treat nullable `branchId`, `contactId`, `occurredAt`, `dueAt`, `completedAt`, and `fromOwnerId` as valid states.
- Use active owner lists for new assignments, but keep historical reports able to show inactive or former owners.
- Future report drilldowns must preserve the same permission model as their summary cards.

## Suggested Dashboard State Before Downstream Modules

If the dashboard is refreshed before Opportunities and Orders land, use an honest CRM Core dashboard:

| Suggested card | Source |
| --- | --- |
| Open follow-ups | `Activity.status = OPEN` with `dueAt` set |
| Due today | `Activity.status = OPEN` and today's `dueAt` bucket |
| Lead/customer records | `LeadCustomer.id` by `state` |
| New CRM records this period | `LeadCustomer.createdAt` |
| Activity volume | `Activity.type`, `Activity.status` |
| Contact coverage | `Contact.leadCustomerId`, `Contact.email`, `Contact.phone`, `Contact.isPrimary` |

Keep these out until their dependencies land:

- Open opportunities.
- Booked value.
- Target progress.
- Pending payments.
- Collected payments.
- Production pending.
- Incentives pending.

## Handoff For Future Reports Implementation

Before building reports/dashboard queries, future workers should:

1. Rebase from current `main`.
2. Confirm which downstream modules have landed.
3. Replace blocked rows in this plan only when the corresponding source models and fields exist.
4. Add focused tests for metric definitions before wiring dashboard cards.
5. Browser-smoke the dashboard with Admin and Sales users to confirm company-wide visibility and owner filters.
6. Remove or clearly label any card still waiting on future modules.
