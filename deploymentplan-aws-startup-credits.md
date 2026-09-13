# AWS Startup-Credit Deployment Plan: eCRM + SignalLoop

**Date:** 2026-09-12
**Goal:** Deploy eCRM and SignalLoop on AWS with startup credits, strict budget controls, separate customer-cell boundaries, and Amazon Transcribe for voice-to-text.
**Source reviewed:** Existing `deploymentplan.md` plus current eCRM and SignalLoop repository surfaces.

## 1. Review of the Existing Plan

The existing `deploymentplan.md` is a near-zero-cost plan built around:

| Area | Existing plan | Keep | Change for AWS |
| --- | --- | --- | --- |
| eCRM app | Vercel | Keep the separate app-per-cell idea | Move runtime to ECS/Fargate or EC2 |
| eCRM database | Supabase PostgreSQL | Keep one database per customer cell | Use one RDS PostgreSQL database or schema boundary per customer cell |
| SignalLoop API/workers | Railway | Keep API plus worker split | Move to ECS services/tasks or EC2 systemd/docker compose |
| SignalLoop database/cache | Railway PostgreSQL + Redis | Keep separate SignalLoop data plane | Use RDS PostgreSQL and ElastiCache Redis, or Redis container for pilot |
| Storage | Vercel Blob/local files | Keep tenant-scoped object keys | Use S3 buckets/prefixes with KMS and lifecycle rules |
| Voice transcription | Deepgram/local faster-whisper in SignalLoop, browser transcript in eCRM | Keep provider-adapter pattern | Add Amazon Transcribe as the AWS STT provider |
| Cost model | Free SaaS tiers | Keep budget discipline | Use AWS Activate credits, Free Tier where applicable, budgets, and auto-shutdown for non-prod |

Key correction: the old plan is not an AWS deployment plan. It also assumes Vercel Blob for eCRM voice-note storage and Deepgram/local Whisper for SignalLoop STT. Amazon Transcribe must be added as an implementation item; it is not currently wired as a provider in either repo.

## 2. Current Repo Facts That Drive the AWS Shape

- eCRM is a Next.js application with Prisma/PostgreSQL, cookie sessions, separate control-plane and tenant database URLs, and cell identity from `APP_MODE`, `CELL_ID`, and `CELL_KEY`.
- eCRM has no root application `Dockerfile` today; it only has `docker-compose.yml` for local PostgreSQL.
- eCRM voice notes store audio locally or in Vercel Blob today. Browser-provided transcript text can be saved, summarized, and turned into suggested actions.
- SignalLoop is a separate monorepo with a Vite/Nginx web container, FastAPI API container, PostgreSQL, Redis, and worker processes in `compose.yml`.
- SignalLoop provider routing supports STT providers today, but the registered STT providers are Deepgram and local faster-whisper. Amazon Transcribe needs a new adapter and provider enum/catalog entry.
- The product boundary stays intact: eCRM owns CRM, lead-to-cash, proposals, orders, finance, targets, and incentives; SignalLoop owns campaigns, email/voice outreach, ChatHub, agents, scheduling, and post-call work. Integration remains API/event based, not cross-database writes.

## 3. Recommended AWS Target Architecture

Use one AWS account for the startup initially, then isolate production customer cells by account or by tightly separated VPC/resource boundaries as soon as customer data is real.

```text
AWS Organizations
|-- shared-tooling
|   |-- ECR repositories
|   |-- CI/CD role
|   `-- central billing/budget alerts
|-- ecrm-ara-global-cell
|   |-- ECS/Fargate or EC2 runtime
|   |-- RDS PostgreSQL tenant DB
|   |-- S3 cell bucket/prefix
|   |-- Secrets Manager
|   `-- CloudWatch logs/alarms
|-- signalloop-ara-global-cell
|   |-- ECS/Fargate API, web, and workers
|   |-- RDS PostgreSQL
|   |-- ElastiCache Redis or pilot Redis task
|   |-- S3 call/audio bucket
|   |-- Amazon Transcribe
|   `-- CloudWatch logs/alarms
```

For the first AWS pilot, deploy ARA Global only. Add AI Consulting after the backup, restore, Transcribe, and integration smoke tests pass.

## 4. Credit and Cost Guardrails

Before deploying:

1. Apply for AWS Activate credits using the startup/product entity.
2. Create AWS Budgets alerts at 50%, 80%, and 100% of the monthly credit-backed budget.
3. Enable Cost Anomaly Detection.
4. Tag every resource with `Product`, `Cell`, `Environment`, `Owner`, and `CostCenter`.
5. Keep non-prod services manually or automatically stopped outside demos.
6. Do not use NAT Gateway for the first pilot unless absolutely required; it can quietly become a material baseline cost.
7. Prefer one region for the pilot. Suggested default: `ap-south-1` if India residency and latency matter; `us-east-1` if lowest service availability friction matters.

AWS Activate currently advertises startup credits up to $200,000 for eligible startups, with terms and eligibility checked at application time. Amazon Transcribe has a 12-month Free Tier of 60 minutes per month after first use, then pay-as-you-go billing by audio seconds. RDS Free Tier availability depends on account plan and signup timing. Treat credits as a subsidy, not permission to run unbounded infrastructure.

Official references:

- AWS Activate credits: https://aws.amazon.com/startups/credits
- Amazon Transcribe pricing: https://aws.amazon.com/transcribe/pricing/
- Amazon Transcribe developer guide: https://docs.aws.amazon.com/transcribe/latest/dg/what-is.html
- RDS PostgreSQL pricing and Free Tier notes: https://aws.amazon.com/rds/postgresql/pricing/
- ECS pricing: https://aws.amazon.com/ecs/pricing/
- Fargate pricing: https://aws.amazon.com/fargate/pricing/

## 5. Deployment Option A: ECS/Fargate Managed Cell

Use this if AWS credits are approved or very likely.

### Shared AWS Setup

1. Create a dedicated AWS account or environment boundary for the pilot.
2. Create ECR repositories:
   - `ecrm-web`
   - `signalloop-api`
   - `signalloop-web`
   - `signalloop-worker`
3. Create a VPC with public ALB subnets and private service/database subnets.
4. Add VPC endpoints for ECR, CloudWatch Logs, S3, Secrets Manager, and Transcribe where practical to reduce NAT dependency.
5. Create KMS keys for RDS, S3, Secrets Manager, and Transcribe output objects.

### eCRM Services

1. Add a production eCRM Dockerfile for Next.js.
2. Build and push the image to ECR.
3. Provision RDS PostgreSQL for the control plane and tenant database. For a tiny pilot, these may be separate databases on one small RDS instance; for customer production, use stronger separation.
4. Provision S3 for voice-note audio and proposal artifacts.
5. Store secrets in Secrets Manager:
   - `CONTROL_PLANE_DATABASE_URL`
   - `TENANT_DATABASE_URL`
   - `AUTH_SECRET`
   - `AUTH_MODE`
   - OIDC settings when production auth is enabled
   - `APP_BASE_URL`
   - `APP_MODE=cell`
   - `CELL_ID`
   - `CELL_KEY`
   - storage and integration secrets
6. Run Prisma migrations as one-off ECS tasks:
   - `npm run prisma:platform:migrate`
   - `npx prisma migrate deploy`
7. Seed a customer cell only with `npm run prisma:seed:tenant`, never with the destructive demo seed.
8. Deploy the eCRM ECS service behind an ALB or CloudFront plus ALB.
9. Run the eCRM workers as separate ECS services or scheduled tasks:
   - `npm run worker:control-projections`
   - `npm run worker:integration-delivery`
   - `npm run reconcile:integration-delivery`

### SignalLoop Services

1. Reuse the existing `apps/api/Dockerfile` for API and workers.
2. Reuse the existing `apps/web/Dockerfile` for the SPA/Nginx web service.
3. Build and push SignalLoop API, web, and worker images to ECR.
4. Provision RDS PostgreSQL for SignalLoop.
5. Provision ElastiCache Redis for production. For the first demo-only pilot, a Redis ECS task may be acceptable with clear data-loss limits.
6. Store SignalLoop secrets in Secrets Manager:
   - `SECRET_KEY`
   - `FIRST_SUPERUSER`
   - `FIRST_SUPERUSER_PASSWORD`
   - `POSTGRES_SERVER`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
   - `REDIS_URL`
   - `FRONTEND_HOST`
   - `SERVER_HOST`
   - `BACKEND_CORS_ORIGINS`
   - `ECRM_SHARED_API_BASE_URL`
   - `ECRM_SHARED_API_TOKEN`
   - provider keys and webhook secrets
   - new AWS Transcribe variables after adapter implementation
7. Run Alembic migrations from a one-off ECS task in `apps/api`.
8. Deploy ECS services:
   - `signalloop-api`
   - `signalloop-web`
   - `sequence-worker`
   - `call-worker`
   - `postcall-worker`
   - `ecrm-installation-projection-worker`
9. Configure Twilio webhooks to the public API URLs:
   - `/api/v1/voice/twiml`
   - `/api/v1/voice/status`
   - `/api/v1/voice/recording`
   - `wss://.../api/v1/voice/media-stream`

## 6. Deployment Option B: Lowest-Cost EC2 Pilot

Use this if AWS credits are pending and the goal is a controlled demo, not production resilience.

1. Create one small EC2 instance for eCRM and one small EC2 instance for SignalLoop, or one larger instance if this is strictly a private demo.
2. Use Docker Compose on the instance for app containers.
3. Use RDS PostgreSQL if credits allow. If not, run PostgreSQL locally only for a throwaway demo and document that backups/HA are not production-grade.
4. Use S3 for audio and artifacts even in the pilot, because it proves the production storage path.
5. Stop EC2 outside working hours.
6. Keep Route 53/CloudFront optional until a customer-facing demo needs stable DNS and TLS.

This option is cheaper to reason about, but it creates more manual operational work. Do not present it as the paid-customer target.

## 7. Amazon Transcribe Implementation Plan

### eCRM Voice Notes

Current behavior:

- Audio upload is accepted and saved.
- A browser-provided transcript can be passed with the upload.
- Transcript text is normalized and used for summary, customer ask, next step, and suggested actions.

AWS target behavior:

1. Store uploaded voice-note audio in S3 using tenant-scoped keys:
   - `organizations/{organizationId}/sales-voice-notes/{ownerId}/{yyyy-mm}/{voiceNoteId}.webm`
2. Add an async transcription worker:
   - mark note `TRANSCRIBING`
   - call Amazon Transcribe batch transcription
   - store Transcribe JSON output in S3 under the same organization prefix
   - save transcript through `saveVoiceNoteTranscript`
   - create suggested actions through `createSuggestedActionsForVoiceNote`
   - mark `FAILED` with a safe error on timeout/provider failure
3. Add environment variables:
   - `AWS_REGION`
   - `ECRM_AUDIO_BUCKET`
   - `ECRM_TRANSCRIBE_OUTPUT_BUCKET`
   - `ECRM_TRANSCRIBE_LANGUAGE_CODE`
   - `ECRM_TRANSCRIBE_KMS_KEY_ID`
4. IAM policy should allow only cell-scoped S3 prefixes and Transcribe jobs for that cell.
5. Do not send one customer's audio to another customer's bucket, prefix, Transcribe output location, or KMS key.

### SignalLoop STT

Current behavior:

- Provider registry supports STT adapters.
- Registered STT providers are Deepgram and local faster-whisper.
- Live voice currently expects streaming STT behavior.

AWS target behavior:

1. Add `amazon_transcribe` to the provider enum and provider catalog for STT.
2. Add an `AmazonTranscribeSTTAdapter`.
3. Support two modes:
   - **Batch post-call transcription:** use Amazon Transcribe batch jobs for recordings. This is the safest first AWS step.
   - **Live call transcription:** use Amazon Transcribe Streaming only after validating Twilio media stream encoding, latency, partial transcripts, reconnect behavior, and barge-in expectations.
4. Keep Deepgram as a fallback provider until Amazon Transcribe proves latency and accuracy for live calls.
5. Add provider credentials/config:
   - `AWS_REGION`
   - `AWS_TRANSCRIBE_LANGUAGE_CODE`
   - `AWS_TRANSCRIBE_MEDIA_ENCODING`
   - `AWS_TRANSCRIBE_SAMPLE_RATE_HZ`
   - `AWS_TRANSCRIBE_OUTPUT_BUCKET`
   - `AWS_TRANSCRIBE_KMS_KEY_ID`
6. Route post-call worker first; route live `/api/v1/voice/media-stream` only after a focused load/latency test.

## 8. Security and Isolation Controls

1. Use `APP_MODE=cell` for customer eCRM runtimes.
2. Keep one cell identity per runtime: `CELL_ID` and `CELL_KEY` must never be browser-selected.
3. Keep eCRM and SignalLoop databases separate.
4. Integrate through authenticated APIs and workflow events only.
5. Store all secrets in Secrets Manager, never in container images or committed `.env` files.
6. Use least-privilege task roles for S3, Transcribe, RDS, Redis, and Secrets Manager.
7. Enable S3 block public access.
8. Enable RDS encryption, automated backups, and deletion protection for production cells.
9. Use CloudWatch log retention to control cost.
10. Add alarms for failed workers, growing queues, Transcribe failures, 5xx rates, RDS CPU/storage, Redis memory, and budget anomalies.

## 9. Step-by-Step First AWS Pilot

1. Confirm AWS Activate application status and expected credit amount.
2. Create AWS budget alerts and mandatory tags before app deployment.
3. Build SignalLoop images from the existing Dockerfiles.
4. Add and test an eCRM production Dockerfile.
5. Push images to ECR.
6. Provision the smallest acceptable RDS PostgreSQL instance for the pilot.
7. Provision S3 buckets/prefixes and KMS keys.
8. Provision Redis using ElastiCache if credits allow; otherwise use a clearly marked demo Redis container.
9. Deploy eCRM API/web runtime.
10. Deploy SignalLoop API, web, and workers.
11. Run database migrations.
12. Seed only the chosen pilot customer cell.
13. Configure eCRM and SignalLoop integration credentials.
14. Add Amazon Transcribe batch transcription for eCRM voice notes.
15. Add Amazon Transcribe batch transcription for SignalLoop post-call processing.
16. Keep live SignalLoop STT on the existing provider until Amazon Transcribe Streaming passes latency tests.
17. Run smoke tests:
    - eCRM login
    - eCRM dashboard
    - eCRM voice-note upload
    - eCRM Transcribe job completion
    - SignalLoop login
    - SignalLoop API health
    - SignalLoop worker health
    - SignalLoop post-call Transcribe job completion
    - eCRM shared-record API auth
    - SignalLoop to eCRM workflow event delivery
18. Snapshot cost after 24 hours and shut down nonessential demo capacity.

## 10. Acceptance Gates

The AWS deployment is ready for a real customer demo only when:

- AWS credits or an approved customer/BYOC budget is active.
- Budget alarms are verified by email.
- Each app has a stable HTTPS URL.
- eCRM and SignalLoop each have their own database and secrets.
- The selected customer cell has a backup and restore rehearsal record.
- eCRM migrations and SignalLoop Alembic migrations have run successfully.
- No destructive demo seed has been run against a customer cell.
- S3 audio storage is private, encrypted, and tenant-scoped.
- Amazon Transcribe batch output is private, encrypted, and tenant-scoped.
- Transcribe errors fail closed without losing the original audio.
- eCRM to SignalLoop integration uses configured secrets and idempotent workflow events.
- CloudWatch shows clean API health, worker heartbeats, and no repeated dead-letter growth.

## 11. Open Questions

- Which AWS region is preferred for the first pilot: `ap-south-1`, `us-east-1`, or customer-specific?
- Is this pilot for ARA Global first, AI Consulting first, or a new paid customer?
- Should the first AWS runtime be ECS/Fargate or the cheaper EC2 demo path while credits are pending?
- Will SignalLoop live voice remain Twilio plus Deepgram during the first AWS deployment, or should Amazon Transcribe Streaming be included in the first engineering sprint?
- What production auth provider should eCRM use when `AUTH_MODE=oidc` is enabled?
