# Client onboarding guide

This guide is for the platform/admin team that provisions a new eCRM client.

The operating rule is simple: one client, one isolated customer cell. Do not colocate business records, users, files, or integration state between clients.

Use the same process for ARA Global, HaloEHS, AI Consulting, and Qgira. The only thing that changes is the client-specific metadata, database, secrets, and deployment identity.

## Shared vs client-specific

Shared across all clients:

- the eCRM codebase
- the platform control plane
- the provisioning workflow
- the release process
- the deployment pipeline

Client-specific per deployment:

- `CELL_ID`
- `CELL_KEY`
- `APP_MODE=cell`
- `DATABASE_URL`
- application URL or subdomain
- object-storage namespace or bucket prefix
- `CELL_CONTROL_PROJECTION_SECRET`
- tenant seed users and passwords
- SignalLoop workspace binding

## Standard onboarding flow

1. Create the client record in the platform control plane.
2. Reserve the client key and client URL/subdomain.
3. Provision a dedicated database for the client.
4. Create the client deployment with cell-mode environment variables.
5. Bootstrap the customer-cell control projection.
6. Apply migrations to the client database only.
7. Seed the initial admin and sales users.
8. Verify login, module access, and isolation.
9. Record backup and restore evidence.
10. Hand the client to the admin team for ongoing user management.

## Example client matrix

| Client | Cell ID | Cell key | Database | Admin login | Sales login |
| --- | --- | --- | --- | --- | --- |
| ARA Global | `cell_ara_global` | `ara-global` | `ara_global` | `admin@ara-global.demo.local` | `sales@ara-global.demo.local` |
| AI Consulting | `cell_ai_consulting` | `ai-consulting` | `ai_consulting` | `admin@ai-consulting.demo.local` | `sales@ai-consulting.demo.local` |
| HaloEHS | `cell_haloehs` | `haloehs` | `haloehs` | client-specific | client-specific |
| Qgira | `cell_qgira` | `qgira` | `qgira` | client-specific | client-specific |

ARA Global and AI Consulting are the reference examples already modeled in the repo. HaloEHS and Qgira follow the same shape, but their exact login identities and passwords should come from the client onboarding record or secret store.

## What to do when onboarding a new client

Use this sequence for every new client:

1. Confirm the legal name, display name, client key, region, subdomain, and initial module scope.
2. Confirm the initial admin and sales identities.
3. Create the client record in the platform control plane.
4. Provision a dedicated database and dedicated secrets.
5. Create the client deployment with `APP_MODE=cell`, `CELL_ID`, and `CELL_KEY`.
6. Bootstrap the control projection and SignalLoop binding.
7. Run the client migrations.
8. Seed the first admin and sales users.
9. Validate the login flow and verify the client can only see its own cell data.
10. Save backup and restore evidence for the cell.

### Example: ARA Global

Provision the ARA Global client with:

- cell ID: `cell_ara_global`
- cell key: `ara-global`
- database: `ara_global`
- admin login: `admin@ara-global.demo.local`
- sales login: `sales@ara-global.demo.local`

### Example: AI Consulting

Provision the AI Consulting client with:

- cell ID: `cell_ai_consulting`
- cell key: `ai-consulting`
- database: `ai_consulting`
- admin login: `admin@ai-consulting.demo.local`
- sales login: `sales@ai-consulting.demo.local`

## Provision the customer cell

Use the platform control plane to create the cell. The platform creates the customer-specific infrastructure and records durable provisioning evidence.

Required inputs:

- client key
- display name
- region
- base URL
- plan and module limits
- initial admin identity
- SignalLoop workspace binding

The platform must create:

- a dedicated database
- a dedicated deployment
- a dedicated storage namespace or prefix
- a dedicated secret set
- a control projection bootstrap record

## Bootstrap the cell

The cell becomes usable only after the deployment identity has been bootstrapped and the control projection is ACTIVE.

The bootstrap sequence must be explicit and idempotent:

- `APP_MODE=cell`
- `CELL_ID` matches the provisioned client
- `CELL_KEY` matches the provisioned client
- the control-projection signature is valid
- the cell database already exists

## Apply migrations

Run the tenant migrations against the client database only.

Do not run the root demo reset script against a client database.

## Seed the first users

Use the tenant seed command for exactly one client database at a time.

For ARA Global:

```powershell
$env:APP_MODE = "cell"
$env:CELL_ID = "cell_ara_global"
$env:CELL_KEY = "ara-global"
$env:TENANT_SEED = "ara-global"
$env:TENANT_SEED_ADMIN_PASSWORD = "<secret-store value>"
$env:TENANT_SEED_SALES_PASSWORD = "<secret-store value>"
$env:DATABASE_URL = "postgresql://<user>:<password>@<host>:5432/ara_global"
npm run prisma:seed:tenant
```

For AI Consulting:

```powershell
$env:APP_MODE = "cell"
$env:CELL_ID = "cell_ai_consulting"
$env:CELL_KEY = "ai-consulting"
$env:TENANT_SEED = "ai-consulting"
$env:TENANT_SEED_ADMIN_PASSWORD = "<secret-store value>"
$env:TENANT_SEED_SALES_PASSWORD = "<secret-store value>"
$env:DATABASE_URL = "postgresql://<user>:<password>@<host>:5432/ai_consulting"
npm run prisma:seed:tenant
```

For HaloEHS and Qgira, repeat the same pattern with their own cell identifiers, databases, and secrets.

## Verify access

Confirm all of the following:

- the client admin can sign in
- the client sales user can sign in
- the client can only see its own cell data
- the platform control plane can still see provisioning metadata
- no other client can read the new cell's data
- backups and restore evidence are recorded

## Add later users

After onboarding, add new users through that client's Admin Settings page.

Do not add client users through the platform database.

## Operational rule for later changes

- Password resets happen in the client cell only.
- Module changes happen in the client cell only.
- Branding changes happen in the client cell only.
- Plan and lifecycle changes happen in the platform control plane.

## Example onboarding sequence for Qgira

1. Reserve `cell_qgira` and `qgira`.
2. Create `qgira` as a dedicated database.
3. Create a separate deployment for Qgira.
4. Set `APP_MODE=cell`, `CELL_ID=cell_qgira`, and `CELL_KEY=qgira`.
5. Bootstrap the control projection.
6. Apply migrations.
7. Seed the client admin and sales users.
8. Test admin login and sales login.
9. Confirm ARA Global, AI Consulting, and HaloEHS cannot see Qgira data.
10. Record the backup and restore baseline.
