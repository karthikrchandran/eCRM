# Customer-cell onboarding

This runbook creates one dedicated eCRM deployment identity. Customer identity is deployment-derived from `APP_MODE=cell`, `CELL_ID`, and `CELL_KEY`; never accept it from a browser, URL parameter, or ordinary request header.

## Preflight

1. Allocate unique `cellId`, `cellKey`, database/database schema, storage prefix, secret reference, application origin, backup policy, SignalLoop workspace binding, and initial Admin email.
2. Confirm the plan and allowed modules were commercially approved.
3. Confirm provider adapters declare idempotency, fencing, cancellation, and health-check support. Production configuration must include database, storage, secret, backup, application, and SignalLoop endpoints plus credential references.
4. Use only synthetic data in rehearsal. Do not copy customer CRM records into the platform database or logs.

## Provision and verify

Platform administrators can use `/platform/cells` to submit the durable provisioning contract. Enter the platform bearer token at runtime; it is held in browser state and sent only in the `Authorization` header to `/api/platform/cells`. The page does not create tenant passwords or bypass the platform authorization boundary. Keep idempotency and correlation IDs stable when retrying a request.

Submit one platform provisioning request with stable idempotency and correlation IDs. Do not retry with a new idempotency ID. Activation is valid only after database, storage, secret reference, backup, application, cell initialization, SignalLoop binding, and health checks have durable success evidence.

Verify the returned cell is `ACTIVE`; references belong to the expected `cellKey`; the base URL resolves only that deployment; the initial Admin can sign in; excluded modules are denied; health/readiness is green; and audit entries contain references and safe result codes, never plaintext secrets.

`npm run prisma:seed` executes `prisma/seed.ts`, which resets/rebuilds demo data. It is destructive and is not a customer onboarding command. Never run it against a customer cell.

## Seed the approved local demo tenants

After a cell database has been provisioned and migrations have been applied, seed exactly one cell database at a time. The command is additive/upsert-only: it updates the named demo users and the default `CellConfiguration` row and does not delete unrelated business data.

PowerShell example for ARA Global:

```powershell
$env:APP_MODE = "cell"
$env:CELL_ID = "cell_ara_global"
$env:CELL_KEY = "ara-global"
$env:TENANT_SEED = "ara-global"
$env:DATABASE_URL = "postgresql://<user>:<password>@<host>:5432/ara_global"
npm run prisma:seed:tenant
```

Use the equivalent values for AI Consulting, in a separate shell or deployment step:

```powershell
$env:APP_MODE = "cell"
$env:CELL_ID = "cell_ai_consulting"
$env:CELL_KEY = "ai-consulting"
$env:TENANT_SEED = "ai-consulting"
$env:DATABASE_URL = "postgresql://<user>:<password>@<host>:5432/ai_consulting"
npm run prisma:seed:tenant
```

The command fails before constructing Prisma unless `APP_MODE=cell`, `CELL_ID`, `CELL_KEY`, `TENANT_SEED`, and `DATABASE_URL` are present and consistent. Never point the command at the platform database or a different tenant cell.

The seeded demo identities are:

| Tenant | Admin | Sales |
| --- | --- | --- |
| ARA Global | `admin@ara-global.demo.local` | `sales@ara-global.demo.local` |
| AI Consulting | `admin@ai-consulting.demo.local` | `sales@ai-consulting.demo.local` |

The fixture passwords are safe local-demo defaults only. Treat them as temporary credentials, rotate them before any shared or production use, and do not put passwords in source control, tickets, logs, or deployment manifests. Add subsequent users from that tenant's **Admin Settings** page; tenant users remain local to that cell and are never inserted into the platform database.

## External activation boundary

The deterministic `LocalCellProvider` is test-only. Real database/storage/secret/backup/application provider activation and real API credentials were not exercised by synthetic acceptance. Missing production provider configuration must fail closed before resource creation.
