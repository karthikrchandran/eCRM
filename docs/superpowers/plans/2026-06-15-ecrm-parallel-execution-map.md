# eCRM Parallel Execution Map After Foundation

Date: 2026-06-15
Status: Planning artifact only

## Purpose

Guide parallel execution after the completed foundation slice without creating Prisma migration conflicts or merging half-integrated feature work. This map assumes foundation is already on `main` with auth, users, roles, layout, Prisma, seed data, and the dashboard shell verified.

## Sequencing Rule

Prisma schema and migration ownership must be sequential. Only one code-owning slice should modify `prisma/schema.prisma`, create migrations, change seed data, or define shared data access contracts at a time.

The next schema owner is CRM Core:

- Leads/customers.
- Branches.
- Contacts.
- Activities and follow-ups.
- Ownership and reassignment.
- Company-wide Sales visibility.

CRM Core should land before later code slices start changing the database because most downstream modules attach to lead, branch, contact, opportunity, owner, and activity records.

## Must Run Sequentially

These slices should not run as database-owning implementations at the same time:

1. `crm-core`: owns lead/customer, branch, contact, activity, and ownership tables.
2. `opportunities-pipeline`: depends on CRM Core records and owns opportunity, pipeline stage, target, and split ownership tables.
3. `products-proposals`: depends on opportunities and owns product/service catalog, GST defaults, proposal records, and file metadata.
4. `orders-production`: depends on opportunities, proposals, and products; owns orders, line items, production templates, and stage instances.
5. `invoices-payments`: depends on orders; owns invoices, payments, receivable status, and cumulative payment completion.
6. `costs-incentives`: depends on orders and payments; owns costs, gross margin, incentive splits, approval, and override state.
7. `reports-dashboards`: depends on stable read models from the above slices.
8. `csv-import-hardening`: depends on CRM Core and should not redefine lead/contact validation after CRM Core has landed.
9. `responsive-polish`: depends on final route and component surfaces.

If two slices need Prisma changes, one waits. The waiting slice may still produce planning, test design, UX inventory, acceptance criteria, or API/read-model notes.

## Parallel During CRM Core Implementation

These can run while CRM Core is being implemented because they are planning-only or UI/readiness artifacts:

| Lane | Suggested branch/worktree | Artifact type | Allowed outputs | Must avoid |
| --- | --- | --- | --- | --- |
| CRM Core implementation | `feature/crm-core` / `.worktrees/crm-core` | Code-owning | Prisma schema, migration, CRM routes, tests, seed updates | Sharing Prisma ownership with any other lane |
| Opportunities planning | `plan/opportunities-pipeline` / `.worktrees/plan-opportunities-pipeline` | Planning-only | `docs/superpowers/plans/*opportunities*.md`, acceptance criteria, pipeline UX notes | Editing `prisma/`, `src/`, package files |
| Products and proposals planning | `plan/products-proposals` / `.worktrees/plan-products-proposals` | Planning-only | catalog/proposal workflow plan, file upload constraints, GST behavior notes | Adding upload code or product models |
| Orders and production planning | `plan/orders-production` / `.worktrees/plan-orders-production` | Planning-only | order lifecycle plan, production template defaults, status transition notes | Adding order or production tables |
| Finance planning | `plan/finance-payments` / `.worktrees/plan-finance-payments` | Planning-only | invoice/payment/cost/incentive dependency notes | Implementing payment or incentive schema |
| Reports inventory | `plan/reports-dashboard` / `.worktrees/plan-reports-dashboard` | Planning-only | report metric definitions and required source fields | Building report queries against unstable tables |
| QA strategy | `plan/qa-crm-core` / `.worktrees/plan-qa-crm-core` | Planning-only | smoke checklist, e2e scenarios, seed expectations | Editing test files until CRM Core routes exist |

CRM Core is the only lane above that should own code. All other lanes should write docs under `docs/superpowers/` and keep their changes mergeable independently.

## Parallel Immediately After CRM Core Lands

After CRM Core merges to `main`, run gates, then rebase or recreate worktrees from updated `main`. At that point these can proceed in parallel if their ownership is clear:

| Lane | Suggested branch/worktree | Can start when | Notes |
| --- | --- | --- | --- |
| Opportunities and pipeline implementation | `feature/opportunities-pipeline` / `.worktrees/opportunities-pipeline` | CRM Core migrations are merged and generated client is current | Owns opportunity, stage, target, and split structures. Should land before proposals/orders implementation. |
| CSV import planning or implementation | `feature/csv-import-leads` / `.worktrees/csv-import-leads` | CRM Core lead/contact validation is stable | Can implement fixed-template lead import if it only writes CRM Core entities and does not alter downstream schemas. |
| Responsive CRM Core polish | `feature/responsive-crm-core` / `.worktrees/responsive-crm-core` | CRM Core routes/components are merged | UI-only changes to CRM Core screens, quick notes, contact lookup, and mobile-friendly status surfaces. |
| Products/proposals detailed planning | `plan/products-proposals-after-crm` / `.worktrees/plan-products-proposals-after-crm` | CRM Core data names are final | Still planning-only until Opportunities lands. |
| Reports metric planning | `plan/reports-after-crm` / `.worktrees/plan-reports-after-crm` | CRM Core data names are final | Defines metric contracts and dashboard cards without implementing cross-module queries yet. |

Avoid running `opportunities-pipeline` and `products-proposals` as code-owning migrations in parallel. Proposals depend on opportunity identifiers, stage/won semantics, ownership/splits, and product interest shape.

## Planning-Only vs Code-Owning Artifacts

Planning-only artifacts:

- Files under `docs/superpowers/specs/`.
- Files under `docs/superpowers/plans/`.
- Files under `docs/superpowers/status/`.
- Test strategy documents, acceptance criteria, UX inventories, dependency maps, and execution handoffs.

Code-owning artifacts:

- `prisma/schema.prisma`.
- `prisma/migrations/**`.
- Prisma seed files.
- `src/**` application code.
- `tests/**` and Playwright specs once they assert implemented behavior.
- Package, build, lint, and environment configuration.

Planning branches may merge freely if they touch only their assigned docs. Code-owning branches require normal gates and a current rebase from `main`.

## Cleanup And Merge Pattern After Each Slice

Use the same pattern after every code-owning slice:

1. Rebase or recreate the slice worktree from current `main`.
2. Confirm scope with `git status --short --branch`.
3. Run schema checks: `npx prisma validate` and `npx prisma generate`.
4. Run the repo gate: `npm run gate`.
5. Run browser smoke where the slice affects real workflows: `npm run test:e2e`.
6. Run security check before calling the slice done: `npm audit --audit-level=low`.
7. Review diff for unrelated files: `git diff --stat` and `git diff --check`.
8. Merge the branch only after gates pass and the diff contains only the slice scope.
9. Delete or archive the worktree after merge so the next slice starts from fresh `main`.
10. Write a short status note under `docs/superpowers/status/` with branch, gates, known warnings, and next owner.

For planning-only branches:

1. Confirm only the assigned docs changed.
2. Run `git diff --check -- <changed-doc>`.
3. Merge after a quick content review.
4. Remove the worktree or mark it complete so later workers do not continue from stale plans.

## Guardrails Against Over-Parallelization

- Do not let more than one active branch modify Prisma schema or migrations.
- Do not create placeholder models for future modules in the current schema owner unless the current slice needs them to pass real workflows.
- Do not implement UI screens for entities whose data model is still unsettled; produce UX notes instead.
- Do not write tests against future routes or fake data as if they are implemented behavior.
- Do not merge planning docs that contradict already-merged code; refresh from `main` after each code slice lands.
- Keep each worker to an assigned file or clearly declared slice boundary.
- Treat shared helpers, auth, layout, and navigation as owned by the active code slice. Parallel lanes should request changes through notes, not edit them directly.
- Prefer short-lived worktrees. Long-running branches become risky once Prisma migrations advance.

## Suggested Cadence

Overnight:

- One implementation worker owns the next sequential code slice.
- Several planning workers prepare the following slices as docs only.
- QA prepares smoke scenarios and edge cases without adding tests for routes that do not exist yet.
- No parallel worker touches Prisma, seed data, app routes, or shared components unless they own the active code slice.

Morning cleanup:

- Active code worker reports gates, warnings, and exact changed files.
- Reviewer checks for schema ownership, fake/demo behavior, dead controls, and unrelated drift.
- If clean, merge the code slice to `main`.
- Delete the implementation worktree and recreate downstream implementation worktrees from fresh `main`.
- Merge planning-only docs that pass whitespace checks and do not conflict with the landed slice.

Daytime:

- Start the next schema-owning implementation slice from current `main`.
- Convert the most relevant overnight plan into an implementation plan only after its dependencies have landed.
- Keep new exploratory questions as planning docs rather than speculative code.

This cadence keeps momentum high while preserving one clean source of truth for the database and shared workflow contracts.
