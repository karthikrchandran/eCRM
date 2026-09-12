# Client onboarding and customer-cell operations

This guide is for the platform administrator who creates and operates an eCRM customer cell. Follow it for every new customer; do not create a new branch, copy of the application, or shared tenant database.

## Operating model

eCRM has one codebase and a small platform control plane. Each customer gets a separate **customer cell**: its own runtime, PostgreSQL database, secrets, storage namespace, backup evidence, and SignalLoop binding. The control plane stores only provisioning and lifecycle metadata; it never becomes a second place to store customer CRM data.

A role prevents a user from seeing a screen. A customer cell prevents another customer, an operator error, and a database query from reaching the data at all.

## Commercial lanes

| Lane | Customers | Commercial purpose | Hosting position |
| --- | --- | --- | --- |
| Internal/reference | ARA Global, AI Consulting | Product development, demonstrations, reference workflows and training | Platform-owned, credit-funded where available; no expected customer payment |
| Customer-hosted | HaloEHS, Qgira | First paid deployments and proof that the product can operate on customer infrastructure | Customer cloud account or server; customer pays its cloud bill directly |
| Managed cell | Later customers that do not bring infrastructure | Recurring platform and operations service | Platform-owned isolated cloud account/project and cell |

ARA Global is an India-based parent/reference company and AI Consulting is an offspring/demo layer. Give each the same isolation and release discipline as a paying customer, but classify them as `internal/reference` in the control plane. That lets the team demonstrate real customer-cell behaviour without pretending that either is a billable production contract.

For HaloEHS and Qgira, offer **bring-your-own-cloud/server (BYOC/BYOH)** as the default first commercial option. They own their cloud account, virtual machine or container platform, database, storage, backups and cloud invoice. We supply the signed application release, setup, upgrades, support and product license. Charge a modest implementation and annual platform/support fee; do not make cloud margin the primary product. Put the exact fee, SLA, support hours, responsibility split and upgrade window in the order form rather than hard-code prices in this guide.

## Client matrix

| Client | Cell ID | Cell key | Recommended first environment | Billing classification |
| --- | --- | --- | --- | --- |
| ARA Global | `cell_ara_global` | `ara-global` | Platform GCP internal/reference cell | Internal/reference, no expected payment |
| AI Consulting | `cell_ai_consulting` | `ai-consulting` | Platform GCP internal/reference cell | Internal/reference, no expected payment |
| HaloEHS | `cell_haloehs` | `haloehs` | Customer-owned cloud/server | Customer-hosted paid deployment |
| Qgira | `cell_qgira` | `qgira` | Customer-owned cloud/server | Customer-hosted paid deployment |

Use separate cloud projects/accounts and separate databases for ARA Global and AI Consulting too. They can share the platform billing account and source repository, but must not share a database, runtime identity, object-storage namespace, secrets, users, or SignalLoop workspace.

## Before provisioning

Collect and approve these inputs in the customer onboarding record:

- legal name, display name, cell key, country/region and data-residency needs
- hostname and DNS owner
- commercial lane and support tier
- cloud owner, billing owner and emergency technical contact
- whether the customer supplies the cloud account, server, database and storage
- first tenant administrator and sales/operations users
- enabled product modules and SignalLoop workspace binding
- backup retention, recovery objective, change window and acceptance owner
- the tenant admin's written acceptance of the responsibility matrix

For a customer-hosted cell, do not accept a shared administrator password or a personal cloud account. Require a customer-controlled service account/role, least-privilege deployment access, a named backup location and an agreed escalation contact.

## Provision a cell

1. Create the client record in the platform control plane and classify the lane as `internal/reference`, `customer-hosted`, or `managed`.
2. Reserve the cell ID, cell key and hostname. A key is permanent; changing it later is a migration, not a rename.
3. Create a separate cloud project/account boundary for the cell. In a customer-hosted deployment, create it in the customer's organisation.
4. Provision a dedicated PostgreSQL database, object-storage namespace, secrets and runtime service account/identity.
5. Deploy the approved application artifact in cell mode. Set only this cell's `APP_MODE=cell`, `CELL_ID`, `CELL_KEY`, `DATABASE_URL`, storage variables and `CELL_CONTROL_PROJECTION_SECRET`.
6. Bootstrap and verify the signed control projection, then create the tenant-to-SignalLoop workspace binding.
7. Apply migrations to this database only.
8. Seed the initial users once, using passwords from the customer/corporate secret manager. Never put production passwords in a runbook or Git.
9. Verify admin and sales login, cross-cell isolation, background-worker health, backups and restore evidence.
10. Obtain the customer/admin acceptance and record the deployment version, recovery test, support contacts and handover date.

The cell is not ready merely because the browser loads. It is ready only when the control projection, health/readiness endpoint, backup evidence and named administrator are all present.

## Internal/reference examples

### ARA Global

Provision a GCP project such as `ecrm-ara-global-prod` under the platform organisation/billing account. It contains only the ARA Global runtime, `ara_global` database, `ara-global` storage namespace, ARA Global secrets and SignalLoop binding.

- `CELL_ID=cell_ara_global`
- `CELL_KEY=ara-global`
- initial admin: `admin@ara-global.demo.local`
- initial sales user: `sales@ara-global.demo.local`

### AI Consulting

Provision a different GCP project, such as `ecrm-ai-consulting-prod`, and a different database/runtime identity. Do not reuse ARA Global's database URL, storage prefix, user accounts or SignalLoop workspace.

- `CELL_ID=cell_ai_consulting`
- `CELL_KEY=ai-consulting`
- initial admin: `admin@ai-consulting.demo.local`
- initial sales user: `sales@ai-consulting.demo.local`

For either reference cell, use the additive tenant-seed command only after confirming its target identity:

```powershell
$env:APP_MODE = "cell"
$env:CELL_ID = "cell_ara_global" # use the target cell only
$env:CELL_KEY = "ara-global"
$env:TENANT_SEED = "ara-global"
$env:TENANT_SEED_ADMIN_PASSWORD = "<secret-manager value>"
$env:TENANT_SEED_SALES_PASSWORD = "<secret-manager value>"
$env:DATABASE_URL = "postgresql://<user>:<password>@<host>:5432/ara_global"
npm run prisma:seed:tenant
```

Never run `npm run prisma:seed` against a customer cell: it is a demo-reset operation, not a safe onboarding operation.

## Customer-hosted example: HaloEHS or Qgira

1. Agree that the customer owns the cloud account or server and the cloud bill.
2. Create a customer project/account, dedicated database, bucket/namespace, secret manager entries and a least-privilege deployment role.
3. Give the platform release pipeline that role, or have the customer run the signed deployment package under an observed change window.
4. Configure the customer hostname, TLS, backup schedule, log retention and alert contact in their environment.
5. Deploy the same approved Git release used by the reference cells, with only cell-specific configuration changed.
6. Run the acceptance checklist and hand the customer their cell URL, tenant admin account, support route and recovery responsibilities.

The customer should never receive another customer's configuration, data, database dump or deployment credential. Conversely, platform staff should not retain standing broad access to a customer environment; use time-bounded, audited support access where the contract allows it.

## Release and ongoing operations

All cells consume the same source commit and release artifact. A release does not create per-client branches.

1. Build, test and approve one commit on `main`.
2. Publish one versioned container/package and a migration plan.
3. Roll it through an internal/reference cell first.
4. Schedule and deploy it to each customer cell under its own change window.
5. Record version, migration, health, reconciliation and rollback evidence per cell.

Changes to users, branding and operational settings belong in the relevant customer cell. Plan, lifecycle and support-access decisions belong in the platform control plane. Do not add users or CRM records directly to the platform database.

## Acceptance checklist

- [ ] Dedicated cloud/account/project boundary is recorded.
- [ ] Dedicated database, storage namespace, secret set and runtime identity exist.
- [ ] `APP_MODE`, `CELL_ID` and `CELL_KEY` match the control-plane record.
- [ ] Control projection and SignalLoop workspace binding are ACTIVE.
- [ ] Tenant admin and sales/operations login works.
- [ ] A user from another cell cannot authenticate to or read this cell.
- [ ] Worker, projection, retry/DLQ and readiness checks are healthy.
- [ ] Backup was created and an isolated restore rehearsal is evidenced.
- [ ] Support, change and recovery ownership has been accepted in writing.
