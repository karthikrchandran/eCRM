# Demo-Ready Vercel and Supabase Customer Cells Design

## Goal

Make ARA Global and AI Consulting demo cells safe to run on the current Vercel and Supabase path. Each demo cell must have its own Vercel deployment, Supabase database, runtime identity, seed path, storage configuration, and SignalLoop integration credentials. Customer identity is deployment-derived from `APP_MODE=cell`, `CELL_ID`, and `CELL_KEY`; it is never selected by the browser, URL, or request headers.

## Boundaries

- AWS, ECS, RDS, S3, and Amazon Transcribe are planning artifacts only for this phase.
- This phase does not convert eCRM to a pooled multi-tenant database model.
- ARA Global and AI Consulting remain separate dedicated cells, not filtered views over one shared production database.
- `npm run prisma:seed` remains local/demo-development only and must not be used for customer cells.
- `npm run prisma:seed:tenant` is the only approved demo-cell seed path, and it must fail before Prisma construction when the cell environment is missing or inconsistent.
- SignalLoop integration stays API/event based through authenticated credentials. There are no cross-database writes.

## Demo Cell Contract

Each demo cell requires a complete, unique deployment contract:

| Contract field | ARA Global | AI Consulting |
| --- | --- | --- |
| Vercel deployment | ARA-only app deployment | AI Consulting-only app deployment |
| Supabase database | ARA-only database/project | AI Consulting-only database/project |
| `APP_MODE` | `cell` | `cell` |
| `CELL_ID` | `cell_ara_global` | `cell_ai_consulting` |
| `CELL_KEY` | `ara-global` | `ai-consulting` |
| `APP_BASE_URL` | ARA Vercel URL | AI Consulting Vercel URL |
| Storage | Vercel Blob token or explicit local-dev-only fallback | Vercel Blob token or explicit local-dev-only fallback |
| SignalLoop binding | ARA workspace and credential | AI Consulting workspace and credential |

The runbook should make it hard to mix any value across cells. Copy/paste examples must group environment values per cell and call out the database, app URL, and credential boundary.

## Components

1. Deployment/runbook documentation verifies the current Vercel plus Supabase path and removes ambiguity introduced by the AWS planning document.
2. Environment validation confirms production-like cell deployments fail closed when `APP_MODE`, `CELL_ID`, `CELL_KEY`, `DATABASE_URL`, `AUTH_SECRET`, or `APP_BASE_URL` are missing or invalid.
3. Tenant seed validation remains additive/upsert-only and proves each fixture matches the deployment cell identity.
4. Demo smoke checks verify login, dashboard access, seeded user availability, storage mode, shared-record API authentication, workflow-event authentication, and integration credential issuance.
5. SignalLoop integration guidance verifies cell-scoped credentials, destination installation identity, idempotency, retry behavior, and ownership checks without coupling to SignalLoop's database.

## Data Flow

1. Operator creates one Supabase project/database per demo cell.
2. Operator applies Prisma migrations against exactly one target database.
3. Operator runs `npm run prisma:seed:tenant` with `APP_MODE=cell`, matching `CELL_ID`, matching `CELL_KEY`, and a matching `TENANT_SEED`.
4. Operator deploys one Vercel project per cell with the same runtime identity and database URL.
5. Tenant Admin signs in to the cell and issues a capability-scoped integration credential.
6. SignalLoop uses the credential to call `/api/shared-records` and `/api/workflow-events`, and eCRM outbound delivery uses the configured SignalLoop destination.

## Failure Handling

- Missing or inconsistent cell identity fails with a clear configuration error before customer data is read or written.
- A seed command pointed at the wrong fixture/cell fails before writing users or configuration.
- Legacy shared-data token access remains development-only and is rejected in production.
- Integration delivery records only non-secret audit metadata and leaves failed deliveries replayable with an operator reason.
- If Vercel Blob is not configured in a deployed cell, the operator-facing smoke result must call out that durable voice-note audio is not proven.

## Verification

Focused verification should cover:

- `npm run gate`
- `npm run test:e2e`
- tenant seed unit tests
- customer-cell isolation tests
- shared-record and workflow-event API auth tests
- integration-delivery credential and worker tests
- a documented deployed smoke checklist for each demo cell

The phase is complete when a developer or operator can provision or verify ARA Global and AI Consulting as separate Vercel and Supabase cells without sharing database state, runtime identity, seed data, storage, or SignalLoop credentials.
