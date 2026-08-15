# eCRM client deployment and stack decision

This note explains how eCRM should be deployed for multiple clients and why the platform should stay isolated per client.

## Decision

Use one eCRM codebase, one platform control plane, and one dedicated customer cell per client.

Do not colocate ARA Global, HaloEHS, AI Consulting, and Qgira in the same business-data database.

## What runs where

### Shared platform

The shared platform is only for control-plane metadata and orchestration:

- client registry
- provisioning state
- lifecycle state
- plan/module limits
- support access records
- control-projection evidence

It does not store client CRM records, contacts, opportunities, invoices, voice notes, or workflow events.

### Customer cell

Each client cell contains:

- the same eCRM application artifact
- one client database
- one client storage namespace
- one client secret set
- one client SignalLoop binding
- one client login namespace

That means ARA Global and AI Consulting are different deployments of the same product, not rows in a shared tenant table.

## Platform recommendation

For this architecture, the platform should be deployed on infrastructure that supports:

- always-on web processes
- separate background workers
- scheduled reconciliation
- per-client databases
- per-client secrets
- per-client storage

That makes a container or VM platform a better fit than a function-only platform.

### Recommended AWS shape

Use one of these:

- ECS/Fargate for the web app plus background workers
- EC2 if you want the simplest first cut
- managed RDS Postgres for the client databases
- S3 or equivalent object storage with per-client prefixes or buckets

### Why not Lambda-only

Lambda is a poor primary fit for this repo because the product needs:

- long-lived workers
- reconciliation loops
- bounded retry and dead-letter handling
- explicit provisioning and recovery workflows
- predictable cell lifecycle boundaries

Lambda can still be used for small glue tasks, but not as the whole runtime for client cells and control-plane workflows.

### Why Netlify or Vercel alone is not enough

They are fine for a thin frontend, but this product needs stronger isolation around:

- separate databases per client
- background workers
- scheduled reconciliation
- backup and restore evidence
- tenant provisioning and lifecycle controls

The repo already documents Vercel as a deployment option for the main app, but the enterprise cell model requires more than a serverless web deploy. The web tier can be hosted there, but the full cell architecture still needs isolated databases and worker infrastructure.

### Why Supabase/Postgres-as-a-service alone is not enough

Managed Postgres is useful. A shared Postgres backend is not.

Use Postgres as the database engine, but keep the data model and operational boundary per client:

- one database per client
- one storage namespace per client
- one worker/runtime boundary per client
- one SignalLoop binding per client

## GCP option

Yes, GCP can work well for this architecture if you prefer its managed stack.

Good GCP-shaped choices:

- Cloud Run or Compute Engine for the app and worker services
- Cloud SQL for the per-client Postgres databases
- Cloud Storage for client file storage
- Secret Manager for secrets
- Cloud Scheduler or a worker service for reconciliation

Google currently offers startup credits through the Google for Startups Cloud Program. If your company qualifies, that can offset early infrastructure cost, but it should not drive the architecture by itself.

### Startup credit options

If startup credits matter, both major clouds have programs:

- Google for Startups Cloud Program
- AWS Activate Credits

Use the credits as cost offset, not as the design decision.

## Deployment model

The clean deployment model is:

1. One platform/control-plane deployment.
2. One deployment per client cell.
3. One database per client cell.
4. One storage namespace per client cell.
5. One SignalLoop workspace binding per client cell.

So for the examples in this repo:

- ARA Global gets its own deployment and its own database.
- AI Consulting gets its own deployment and its own database.
- HaloEHS gets its own deployment and its own database.
- Qgira gets its own deployment and its own database.

That is the model you want if the goal is clean client separation.

## Git and release flow

Keep one repository and one main branch.

The flow should be:

1. Make a change once in Git.
2. Merge it to `main`.
3. Build the same commit for every client cell.
4. Roll out the same artifact with client-specific environment variables.

Client-specific behavior should come from:

- deployment env vars
- client seed/config data
- platform provisioning records

It should not come from separate source branches for each client.

## How to move Git updates to each client

Use the same commit and the same build artifact everywhere.

What changes per client is only:

- database connection string
- cell identity variables
- secrets
- storage namespace
- SignalLoop binding
- client seed data

For example, one release commit can be deployed to:

- the ARA Global cell
- the AI Consulting cell
- the HaloEHS cell
- the Qgira cell

without changing the source branch or producing client-specific code branches.

## Suggested production stack

If the goal is enterprise isolation without unnecessary complexity, a practical stack is:

- GitHub for source control
- CI for build/test/release
- AWS ECS/Fargate or EC2 for app and workers
- or GCP Cloud Run/Compute Engine for app and workers
- Postgres per client
- Object storage per client
- Secret manager per client
- Platform control plane for provisioning and lifecycle

If you want the shortest answer:

- Use AWS EC2 or ECS/Fargate, not Lambda-only.
- Use GCP if the startup credits help and you prefer Cloud Run/Cloud SQL.
- Do not use a single shared Postgres for all clients.
- Do not use Netlify/Vercel as the only runtime for the full enterprise cell architecture.
