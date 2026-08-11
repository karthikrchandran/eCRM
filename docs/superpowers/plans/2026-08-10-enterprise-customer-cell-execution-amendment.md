# Enterprise Customer-Cell Execution Amendment

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` task-by-task. Every task starts with a failing test, receives specification and quality reviews, and commits only its named files.

**Goal:** Deliver a production-grade eCRM, SignalLoop, and RevenueOS installation model: isolated customer cells, durable lifecycle and installation records, authenticated cross-product projection, failure recovery, reconciliation, auditability, and adversarial isolation proof.

**Architecture:** eCRM runs as either a control-plane or one immutable customer cell. The control plane persists installation metadata, lifecycle attempts, audit evidence, connection references, and delivery/reconciliation state; it never holds customer CRM records. SignalLoop binds its authenticated workspace to one eCRM installation and publishes durable, idempotent installation events. RevenueOS consumes those events through tenant-scoped projectors with retry, dead-letter, replay, and reconciliation controls. Customer identity is deployment/workspace derived, never request selected.

**Tech Stack:** Next.js/TypeScript/Prisma/PostgreSQL/Vitest/Playwright; SignalLoop and RevenueOS FastAPI/SQLModel/Alembic/Redis workers/Pytest.

**Explicit scope:** Secure local authentication remains in place. OIDC and non-eCRM CRM connectors are deferred, but their connection and projection interfaces remain provider-neutral. Provider boundaries, durable persistence, retry/dead-letter handling, reconciliation, audit, tenant isolation, operational controls, and cross-product recovery tests are required now.

---

### Task 2: Persist the control plane and enforce production-provider contracts

**Files:** `prisma/platform.schema.prisma`, `src/server/platform/db.ts`, `src/server/platform/types.ts`, `src/server/platform/provisioning.ts`, `src/server/platform/providers/types.ts`, `src/server/platform/providers/local-driver.ts`, `src/server/platform/providers/production-driver.ts`, and focused Vitest tests.

- [ ] Write failing tests for one idempotency key yielding one `CustomerCell`, a failed health check ending in `PROVISIONING_FAILED`, and a production driver rejecting missing database/storage/secret/backup configuration before resource creation.
- [ ] Persist `CustomerCell`, `InstallationConnection`, `ProvisioningAttempt`, `ControlPlaneAuditEvent`, and `SupportGrant`; all carry immutable cell identity, lifecycle status, correlation/idempotency data, and timestamps. Store only secret references, never plaintext credentials.
- [ ] Implement a transactionally reserved provisioning attempt. `ACTIVE` is written only after database, storage, secret reference, backup policy, SignalLoop installation binding, and health checks succeed. Every failed action appends a durable attempt/audit result.
- [ ] Implement `ProductionCellProvider` with explicit operations for database, storage prefix, secret reference, backup policy, application deployment, and destroy/restore validation. It is fail-closed when its configured provider endpoint/credentials are absent; do not simulate a successful cloud installation. The local provider is deterministic only for tests.
- [ ] Verify `npm run prisma:platform:generate`, focused tests, typecheck, and full eCRM test suite; commit `feat: persist customer-cell lifecycle control plane`.

### Task 3: Add platform administration, customer-cell administration, and operational audit

**Files:** platform authorization/routes/support grants, cell-local configuration/user services/routes/UI, Prisma migration, audit tests, and operations documentation.

- [ ] Require a constant-time platform-admin credential only in control-plane mode; a cell-mode platform request returns 404.
- [ ] Permit explicit lifecycle transitions only: `PROVISIONING -> ACTIVE`, `ACTIVE <-> SUSPENDED`, `ACTIVE|SUSPENDED -> OFFBOARDING`, and terminal deletion only after retention/backup evidence. Every transition, support grant, credential rotation, and admin change writes append-only audit evidence with actor, tenant, correlation, reason, and result.
- [ ] In cell mode, local Admin can configure neutral branding/modules within persisted plan entitlements and manage local Admin/Sales users. Reject Sales user administration, excluded modules, and removal of the last active local Admin.
- [ ] Verify wrong-mode, wrong-role, expired support-grant, suspension, audit, branding, module, and last-admin negative cases; commit independently from Task 2.

### Task 4: Implement eCRM installation outbox, per-cell credentials, and projection status

**Files:** eCRM integration credential service/schema, shared-record and workflow-event auth, installation outbox/projector status/reconciliation services, API routes/tests, and migration.

- [ ] Replace a global shared-data token with one hashed, capability-scoped, expiring, rotatable cell credential. The request header authenticates a cell endpoint but cannot select a cell.
- [ ] Write every eCRM installation event and projection intent to a transactional outbox with `cellId`, event type, payload version, correlation ID, idempotency key, retry count, next-attempt time, and terminal error.
- [ ] Provide an authenticated worker-safe claim/ack/fail API: exponential bounded retry, terminal dead-letter after the configured maximum, explicit replay with an operator reason, and append-only audit entries. No event is marked delivered before the remote acknowledgement is durable.
- [ ] Add status/readiness and reconciliation endpoints that expose counts/checkpoints without business payloads or secrets; negative tests prove credentials/cells cannot cross.

### Task 5: Bind SignalLoop installations and publish durable tenant-scoped events

**Repository:** `C:\Users\K.Ramachandran\eMailVoice`.

- [ ] Add an `EcrmInstallationBinding` keyed by authenticated workspace ID with eCRM cell key, base URL, secret reference, capability set, status, and last verification. Tests prove request body/header/query data cannot override the binding.
- [ ] Replace direct global eCRM client configuration with a binding-derived client that sends correlation and idempotency identifiers, rejects unconfigured/suspended installations, and never logs secret values.
- [ ] Extend the existing durable outbox worker to deliver installation events with bounded retry, backoff, dead-letter records, explicit replay, and tenant-scoped audit evidence. A delivery for workspace A must not claim or retry workspace B's record.
- [ ] Add reconciliation job/checkpoint comparing eCRM projection status to SignalLoop source state. Mismatches create a visible, auditable repair candidate rather than silently rewriting data.

### Task 6: Project installations into RevenueOS with recovery controls

**Repository:** `C:\Users\K.Ramachandran\eMailVoice`.

- [ ] Add a tenant-scoped installation projection model containing source event ID/version, workspace ID, cell ID, state, checkpoint, attempt count, last error, and dead-letter/replay linkage.
- [ ] Implement an idempotent projector: same source event/version is a no-op; newer version advances; an out-of-order/gap event is held for reconciliation. Projectors derive tenant context from their job/record, never a client header.
- [ ] Use the existing worker and audit-domain seams to persist retry decisions, dead letters, replays, circuit-open/degraded status, and reconciliation outcomes. RevenueOS entitlement gates reading/projecting without losing recovery evidence.
- [ ] Add retry-exhaustion, worker crash-after-side-effect, duplicate, out-of-order, cross-workspace, suspended-installation, replay, and reconciliation tests.

### Task 7: Prove two-customer isolation, installation recovery, and operations

**Files:** eCRM Playwright/Vitest acceptance suite; SignalLoop/RevenueOS Pytest acceptance suite; customer-cell onboarding, backup/restore, incident/replay, suspension/support, and reconciliation runbooks.

- [ ] Provision synthetic `ara-global` and `ai-consulting` installations with distinct database names, storage prefixes, secret references, credentials, workspace IDs, and audit trails.
- [ ] Verify direct URL/API, credential, shared-record, outbox claim, worker projection, dead-letter replay, export, audit search, and support-grant attempts cannot cross cells/workspaces.
- [ ] Force provider health failure, delivery timeout, retry exhaustion, projector crash, reconciliation mismatch, suspension, credential rotation, and restore. Verify recovery restores only the intended cell and preserves audit/checkpoint history.
- [ ] Run eCRM gate plus targeted E2E and SignalLoop/RevenueOS focused API/worker tests. Report actual external-provider verification separately: provider actions require selected vendor endpoint, credentials, and deployment authority; absence must fail closed rather than appear successful.

## Required review and acceptance

- [ ] Every task has TDD red/green evidence, specification review, code-quality review, and a scoped commit.
- [ ] Platform, cell, workspace, worker, and projection contexts are all server-derived and immutable for the request/job lifetime.
- [ ] No plaintext cross-product secret, customer CRM record, or request-selectable tenant identity appears in control-plane/audit logs.
- [ ] A provider setup missing required production configuration fails before creating resources; a real selected provider endpoint is exercised only after the necessary cloud authority is supplied.
