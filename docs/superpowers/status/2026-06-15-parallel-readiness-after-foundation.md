# Parallel Readiness After Foundation

Date: 2026-06-15
Status: Docs-only execution during CRM Core implementation

## Current State

Foundation is complete according to `docs/superpowers/status/2026-06-15-foundation-status.md`.

CRM Core is the active code-owning slice. The current checkout is on `feature/crm-core`, and `prisma/schema.prisma` already has uncommitted CRM Core model work. Treat that file as owned by the CRM Core worker until the slice lands.

## Decision

During CRM Core implementation, no other lane should modify:

- `prisma/schema.prisma`
- `prisma/migrations/**`
- `prisma/seed.ts`
- `src/**`
- `tests/**`
- package, build, lint, or runtime configuration

The only safe work now is planning, acceptance criteria, metric inventory, and test strategy under `docs/superpowers/`.

## Completed Safe Parallel Outputs

- `docs/superpowers/qa/2026-06-15-crm-core-acceptance-checklist.md`
- `docs/superpowers/qa/2026-06-15-finance-incentive-test-matrix.md`
- `docs/superpowers/plans/2026-06-15-ecrm-opportunities-pipeline-planning-notes.md`
- `docs/superpowers/plans/2026-06-15-ecrm-products-proposals-planning-notes.md`
- `docs/superpowers/plans/2026-06-15-ecrm-orders-production-planning-notes.md`
- `docs/superpowers/plans/2026-06-15-ecrm-reports-metric-inventory.md`

## Blocked Until CRM Core Lands

- Opportunity implementation.
- CSV import implementation.
- Responsive CRM Core polish.
- Proposal/product implementation.
- Order/production implementation.
- Finance/payment/cost/incentive implementation.
- Reports implementation.

## Handoff Required From CRM Core

Before the next code-owning slice starts, confirm the landed CRM Core branch provides:

- Stable lead/customer, branch, contact, activity, owner, and reassignment model names.
- Stable `/leads` route and detail route shape.
- Owner list/read helpers or a documented replacement.
- Activity/follow-up semantics, especially due dates and completed state.
- Sales company-wide visibility behavior verified in tests.
- Seed data usable by downstream smoke tests.

## Next Code Owner

After CRM Core merges to `main`, the next schema-owning implementation should be Opportunities and Pipeline. Products/proposals, orders/production, finance, and reports should stay planning-only until their upstream data contracts land.

