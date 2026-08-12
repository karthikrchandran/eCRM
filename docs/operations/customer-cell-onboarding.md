# Customer-cell onboarding

This runbook creates one dedicated eCRM deployment identity. Customer identity is deployment-derived from `APP_MODE=cell`, `CELL_ID`, and `CELL_KEY`; never accept it from a browser, URL parameter, or ordinary request header.

## Preflight

1. Allocate unique `cellId`, `cellKey`, database/database schema, storage prefix, secret reference, application origin, backup policy, SignalLoop workspace binding, and initial Admin email.
2. Confirm the plan and allowed modules were commercially approved.
3. Confirm provider adapters declare idempotency, fencing, cancellation, and health-check support. Production configuration must include database, storage, secret, backup, application, and SignalLoop endpoints plus credential references.
4. Use only synthetic data in rehearsal. Do not copy customer CRM records into the platform database or logs.

## Provision and verify

Submit one platform provisioning request with stable idempotency and correlation IDs. Do not retry with a new idempotency ID. Activation is valid only after database, storage, secret reference, backup, application, cell initialization, SignalLoop binding, and health checks have durable success evidence.

Verify the returned cell is `ACTIVE`; references belong to the expected `cellKey`; the base URL resolves only that deployment; the initial Admin can sign in; excluded modules are denied; health/readiness is green; and audit entries contain references and safe result codes, never plaintext secrets.

`npm run prisma:seed` executes `prisma/seed.ts`, which resets/rebuilds demo data. It is destructive and is not a customer onboarding command. Never run it against a customer cell.

## External activation boundary

The deterministic `LocalCellProvider` is test-only. Real database/storage/secret/backup/application provider activation and real API credentials were not exercised by synthetic acceptance. Missing production provider configuration must fail closed before resource creation.
