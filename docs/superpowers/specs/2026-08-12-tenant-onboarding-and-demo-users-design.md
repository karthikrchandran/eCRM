# Tenant Onboarding and Demo Users Design

## Goal

Provide a repeatable, non-destructive way to bootstrap tenant-local demo users for ARA Global and AI Consulting, while giving the platform administrator a UI action for onboarding future customer cells.

## Boundaries

- The overall platform administrator remains outside all customer cells and authenticates only through the existing platform-admin API boundary.
- Each customer cell keeps its own database and `User` table. ARA Global and AI Consulting users are never inserted into the platform database or another tenant database.
- The tenant seed command is idempotent and additive/upsert-only. It does not reset business data and requires explicit cell runtime identity.
- The platform onboarding UI submits the existing durable provisioning contract. It does not receive or persist tenant passwords.
- OIDC and external CRM connectors remain deferred.

## Components

1. `prisma/tenant-seed-fixtures.ts` defines the approved ARA Global and AI Consulting admin/sales demo identities and safe default modules.
2. `prisma/tenant-seed.ts` validates `TENANT_SEED`, `APP_MODE=cell`, `CELL_ID`, `CELL_KEY`, and `DATABASE_URL`, then upserts the selected tenant's local users and cell configuration.
3. `src/components/platform/customer-cell-onboarding-panel.tsx` provides a client-side platform-admin console. The bearer token is entered at runtime and held only in component state; the server API remains the authorization boundary.
4. `src/app/platform/cells/page.tsx` hosts the console outside the cell-authenticated app layout.
5. `docs/operations/customer-cell-onboarding.md` documents first-time provisioning, tenant seeding, adding users later, and the separation between the constant overall admin and tenant admins/sales users.

## Failure handling and tests

- Invalid tenant name, missing cell identity, platform mode, or missing database URL fails before Prisma is constructed.
- Re-running a tenant seed updates the named demo users without deleting unrelated rows.
- The onboarding panel reports API errors and never embeds a platform token in rendered markup.
- Focused Vitest tests cover fixture isolation, seed validation, and onboarding form submission/error handling.
