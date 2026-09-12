# Deployment, commercial model and competitive-position decision

**Audience:** product owner, technical lead and the person approving cloud spend.
**Decision:** operate one product codebase and control plane, but deploy a separate customer cell for every client. Start with GCP for the two internal reference cells if startup credits are available; support customer-owned cloud or servers for the first paid cells.

## Executive decision

ARA Global and AI Consulting are not expected to fund the product. Treat them as internal/reference cells that demonstrate the full enterprise deployment model at near-zero incremental cost. HaloEHS and Qgira are the early commercial opportunity: they may pay their own hosting bill and bring their own cloud or servers, while eCRM charges a small implementation plus platform/support fee.

The goal is not to beat HubSpot, Salesforce or Zoho as a generic, per-seat CRM on day one. The goal is to sell a controlled, isolated and deployable operating system for a customer's sales workflow—especially where customer data location, ownership, custom workflow and deployment control matter.

## Architecture that supports the business model

| Layer | Shared once | Separate for every customer cell |
| --- | --- | --- |
| Product | Git repository, CI, versioned build artifact, platform control plane | Application deployment, cell identity and release evidence |
| Data | No business CRM data | PostgreSQL database, object storage, backups and restore evidence |
| Security | Release signing and platform operator controls | Secrets, service identity, users, network boundary and SignalLoop binding |
| Operations | Provisioning templates and observability standard | Change window, alerts, workers, dead-letter/reconciliation evidence and support access |

There is no browser-selected tenant. A cell's identity comes from its deployment configuration (`APP_MODE=cell`, `CELL_ID`, `CELL_KEY`). ARA Global, AI Consulting, HaloEHS and Qgira therefore receive different runtimes and databases, not different views into a shared production database.

## Competitive analysis

This is a positioning analysis, not a claim that eCRM currently matches every feature of the established CRM suites.

| Alternative | What it does well | Commercial signal | Our practical response |
| --- | --- | --- | --- |
| HubSpot | Low-friction SaaS adoption and a free entry tier | Free tools exist; paid CRM tiers are priced per seat, with Enterprise currently advertised from $75/user/month | Do not compete on generic free CRM. Offer a customer cell, workflow ownership and optional customer-hosted deployment where those are valued. |
| Zoho CRM | Price-sensitive CRM buying, particularly relevant to India | Its free edition supports up to three users; published India pricing starts at ₹800/user/month for Standard | ARA Global is a reference/development case, not a Zoho replacement pitch. For paid customers, sell a controlled workflow and deployment fit rather than a lower per-seat price. |
| Salesforce Sales Cloud | Broad enterprise suite, ecosystem and extensive capability | Official list pricing ranges from $25/user/month Starter to $175/user/month Enterprise | Avoid head-to-head feature checklists. Target teams that need faster tailoring, clearer data ownership or a contained deployment. |
| Odoo | Broad business application suite and a credible self-hosting option | Its Custom plan explicitly supports on-premise/self-hosting | Customer-hosted eCRM must be operationally disciplined: repeatable deployment, migrations, backups, monitoring and support boundaries—not an informal source-code handoff. |

The market takeaway is simple: commodity CRM is already inexpensive or free. The sellable differentiation is **customer-owned deployment choice plus enterprise operating discipline**: distinct data boundary, audited release path, durable background processing, recovery evidence, and the ability to run in a customer's cloud/server without a fork of the product.

Source snapshots: [HubSpot CRM pricing](https://www.hubspot.com/products/crm), [Zoho CRM pricing](https://www.zoho.com/crm/zohocrm-pricing.html), [Salesforce Sales pricing](https://www.salesforce.com/sales/pricing/), and [Odoo pricing](https://www.odoo.com/pricing/). Prices, packaging and offers change; use these sources when preparing a commercial quote.

## Recommended first platform: GCP, with a hard boundary per cell

Use GCP for the platform-owned ARA Global and AI Consulting reference cells if the product company qualifies for credits. Create a separate GCP project for each cell, even if the projects share one billing account and organisation:

```text
Platform organisation / billing account
├── ecrm-control-plane
├── ecrm-ara-global-prod          -> Cloud Run + Cloud SQL + Cloud Storage
└── ecrm-ai-consulting-prod       -> Cloud Run + Cloud SQL + Cloud Storage
```

For each cell use:

- Cloud Run service(s) for the web/API container
- a separate worker service or scheduled Cloud Run Job for projections, reconciliation and maintenance work
- Cloud SQL PostgreSQL for that cell only
- Cloud Storage bucket or dedicated prefix with separate IAM and retention
- Secret Manager entries scoped to that cell/project
- Cloud Monitoring, logging, budget alerts and a distinct runtime service account

Cloud Run is useful for low-traffic reference cells because it can scale to zero. It is not permission to rely on a web request to run background work: Cloud Run documents that scale-from-zero is request-triggered. Schedule jobs or keep the necessary worker capacity available for the durable queues, reconciliation and recovery behaviour in this product. [Cloud Run autoscaling](https://cloud.google.com/run/docs/about-instance-autoscaling)

The Google for Startups Cloud Program currently advertises up to $200,000 in credits over two years, or up to $350,000 for qualifying AI startups. Acceptance and eligibility are discretionary; its published criteria may exclude consultancies/agencies. Apply under the product company if eligible, and keep a cash budget for Cloud SQL, storage, egress and monitoring after credits end. [Program benefits](https://cloud.google.com/startup/benefits)

## AWS remains a valid equivalent

AWS is a good alternative if an early customer already uses AWS or AWS Activate is more accessible. Use ECS/Fargate (or EC2 for a deliberately simple first installation), RDS PostgreSQL, S3, Secrets Manager and CloudWatch. Fargate has no separate ECS management fee and bills requested vCPU/memory/storage while a task runs; it is a better primary shape than Lambda-only for durable workers. [ECS pricing](https://aws.amazon.com/ecs/pricing/)

Lambda can still run small, bounded glue tasks. It is not the primary runtime for a cell that needs durable dispatch, leases, retries, dead-letter handling, reconciliation and controlled recovery. AWS Activate currently advertises startup promotional-credit programmes, but eligibility and amount must be checked at application time. [AWS Activate](https://aws.amazon.com/startups/credits/)

## Why Vercel, Netlify and a shared Supabase are not the core answer

Vercel or Netlify can serve a thin public frontend, but neither should be the sole production architecture for this product. The cell model also needs worker execution, controlled long-running recovery, per-customer secrets, backup/restore proof and a predictable database lifecycle.

Supabase or another managed PostgreSQL service can be used *inside a cell* if it meets the customer and operational requirements. A single shared database for all customers is not acceptable for this model. The same rule applies to any hosted database: one customer database and storage boundary per cell.

## Customer-hosted path for HaloEHS and Qgira

Offer two patterns, with the customer choosing one in the contract:

| Pattern | Who owns cloud/server and data-plane bill | Who operates the platform | Good fit |
| --- | --- | --- | --- |
| BYOC/BYOH | Customer | Customer with our deployment support; we provide updates and product support | HaloEHS/Qgira want control, have IT capability, or require data to remain in their environment |
| Managed cell | Us | Us | Customer wants an outcome, not infrastructure ownership |

For BYOC/BYOH, deliver a versioned container/package and infrastructure requirements, not a repository fork. The customer creates a dedicated cloud project/account or server boundary. We receive only the least-privilege, time-bounded access needed for installation and support. The contract assigns:

- hosting, backup and cloud-billing ownership
- patching and operating-system responsibility for customer servers
- application upgrade cadence and supported versions
- incident response, recovery objective and escalation contacts
- data export/exit and secret rotation responsibilities

The commercial offer should therefore be simple:

1. a one-time implementation/onboarding fee;
2. a modest recurring product, update and support fee; and
3. cloud/hosting paid directly by the customer in BYOC/BYOH, or pass-through in a managed-cell arrangement.

Do not sell a low licence price while silently absorbing indefinite 24x7 operations. A small recurring fee must cover release management, security patches, backup/recovery exercises, support and the operational tooling that makes customer-hosted deployment credible.

## One Git flow, many clean deployments

Keep one repository and one protected `main` branch. Build one versioned artifact from a reviewed commit. Promote that exact artifact through a reference cell and then through each customer cell under its own maintenance window.

```text
reviewed commit -> signed/versioned artifact -> ARA reference cell
                                      |-> AI Consulting reference cell
                                      |-> HaloEHS customer cell
                                      `-> Qgira customer cell
```

Only configuration differs by cell: database connection, cell identity, secrets, hostname, storage namespace, SignalLoop binding and seed/config data. Never create a source branch per customer. Never copy data or credentials from one cell to another to make a release easier.

## Decision checkpoints before the first paid installation

1. Choose GCP or AWS as the internal/reference platform based on credit eligibility, India-region/data needs and the team's operating skill—not only the headline credit amount.
2. Package the application as a versioned container and document the minimum customer-hosted infrastructure contract.
3. Automate cell provisioning, migrations, health/readiness checks and backup evidence so a new customer does not require bespoke database work.
4. Publish a BYOC/BYOH responsibility matrix and a modest pricing proposal for HaloEHS/Qgira.
5. Run an isolated restore rehearsal and an upgrade rehearsal in ARA Global or AI Consulting before promising the same motion to a paying customer.

This gives ARA Global and AI Consulting near-free, credible reference environments while keeping HaloEHS and Qgira commercially clean: their data and infrastructure can remain theirs, and the value purchased from eCRM is the product and its accountable operation.
