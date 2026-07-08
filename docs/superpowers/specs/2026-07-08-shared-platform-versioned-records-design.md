# Shared Platform Versioned Records Design

## Context

`eCRM` currently exposes shared business entities through `SharedBusinessRecord` and a read-only export route. The latest Task 4 redesign introduced `SharedRecordExportSnapshot` and `SharedRecordExportSnapshotItem` so export pagination is consistent across pages, but page 1 still materializes the full export synchronously before responding.

That solves cursor drift but not the deeper platform problem:

- export still depends on a heavy point-in-time copy job
- the shared table still behaves like a mutable current-state store with weak history
- peer-app coexistence is still unclear because the model implicitly favors whichever app owns the mutable row logic

The target direction has changed. `eCRM` and `eMailVoice` must coexist as peer applications over shared business data. Neither app should become the boss of the other. Shared entities such as leads, customers, contacts, and orders must be usable by both apps while keeping app-specific workflows separate.

## Decision

Adopt `3A`:

- keep `SharedBusinessRecord` as the current-state read model
- add an append-only `SharedBusinessRecordVersion` history table
- make every shared-entity mutation create an immutable version row and advance the current-state row atomically
- replace export snapshots with version-watermark export based on immutable history

This keeps fast reads for application screens while giving the platform a real historical ledger, deterministic export boundaries, and a neutral foundation for peer-app writes.

## Why This Option

### Rejected: snapshot-session export only

This fixes pagination consistency but keeps the system centered on mutable current rows and expensive snapshot creation. It is a delivery patch, not a durable platform model.

### Rejected: event-log only with no current-state table

This is clean architecturally but too disruptive for the existing code in both repos. Most current reads expect a simple queryable head row. Rebuilding everything around replay would slow delivery and increase migration risk.

### Chosen: version ledger plus current-state read model

This gives:

- immutable history for reconciliation, replay, and audit
- deterministic export boundaries without full-copy snapshot tables
- minimal disruption to existing query surfaces
- a neutral platform contract where both apps interact with the same shared model

## Core Model

### Current-state table

`SharedBusinessRecord` remains the main read model for list/detail screens and direct lookups.

Its role changes:

- it is no longer the full source of truth for history
- it represents the latest accepted version of the shared entity
- it stores the active projection used for fast reads

Add these platform fields:

- `headVersion`
- `lastChangedByApp`
- `lastChangeAt`
- optional optimistic-concurrency marker if `headVersion` is not sufficient in the ORM layer

### Version table

Add `SharedBusinessRecordVersion` as an append-only ledger.

Recommended shape:

```prisma
model SharedBusinessRecordVersion {
  id              String   @id @default(cuid())
  recordId        String
  versionNumber   Int
  entityType      SharedRecordType
  sourceApp       String
  changeType      String
  changedAt       DateTime @default(now())
  actorId         String?
  idempotencyKey  String?
  baseVersion     Int?
  snapshot        Json
  changedFields   Json?

  record SharedBusinessRecord @relation(fields: [recordId], references: [id], onDelete: Cascade)

  @@unique([recordId, versionNumber])
  @@index([entityType, changedAt])
  @@index([sourceApp, changedAt])
  @@index([idempotencyKey])
}
```

Meaning:

- `snapshot` stores the full accepted state for that version
- `changedFields` stores a compact diff or field list for audit/debugging
- `baseVersion` records what version the writer believed it was updating
- `idempotencyKey` supports safe retries across app boundaries

## Write Contract

Both apps are peers, but they do not write the shared tables arbitrarily.

The neutral rule is:

- both apps may submit shared-record mutations
- all shared-record mutations go through one platform mutation contract
- the platform mutation contract performs validation, idempotency checks, version increment, and current-row projection

This means the platform is the boss of consistency, not either app.

### Mutation semantics

Each mutation must include:

- record identity or creation key
- `entityType`
- full intended state or merge payload
- `sourceApp`
- `baseVersion` for existing records
- `idempotencyKey`

Recommended behavior:

- create: insert current row at `headVersion=1`, insert version `1`
- update: reject when `baseVersion` does not match current `headVersion`
- retry: if `idempotencyKey` already succeeded, return the existing result

Use optimistic concurrency. Do not default to silent last-write-wins for overlapping edits.

That is the safety mechanism that lets both apps coexist without hidden data loss.

## Export Contract

The export route must stop building snapshot sessions.

Instead it should export against a stable version watermark.

### New export idea

First request returns:

- page items
- `asOfVersion` watermark
- cursor containing `entityType`, `asOfVersion`, and page position

Subsequent pages:

- read only versions or current rows at or below the same `asOfVersion`
- never include later writes

Two viable implementations exist:

### Recommended export implementation

Use a monotonically increasing export watermark derived from version history.

Preferred contract:

- `SharedBusinessRecordVersion.id` or a dedicated numeric sequence acts as global ordering
- export request captures `asOfVersion`
- rows are selected from `SharedBusinessRecord` where `headVersionChangeSequence <= asOfVersion`
- cursor advances by stable sort keys such as `updatedAt desc, id desc`

This keeps export cheap for current-state sync use cases.

### Fallback if global version ordering is awkward in Prisma

Use `changedAt` plus `id` as the stable watermark pair. This is weaker than a true global sequence but still better than materialized export snapshots if enforced consistently.

## Peer-App Ownership Boundaries

Shared entities:

- `LEAD`
- `CUSTOMER`
- `CONTACT`
- `ORDER`

stay in the shared platform model.

App-specific entities stay local:

- eCRM: opportunities, proposals, production, incentives, sales tasks
- eMailVoice: campaigns, sequences, call sessions, messaging, bot runtime, delivery analytics

Cross-app linking must happen through shared IDs, not duplicate customer/contact tables.

## Migration Strategy

### Phase 1: introduce versioning without changing consumers

- add `SharedBusinessRecordVersion`
- backfill version `1` from each active `SharedBusinessRecord`
- write all new shared-record mutations to both current row and version row atomically
- keep existing list/detail APIs stable

### Phase 2: replace export snapshot logic

- remove `SharedRecordExportSnapshot` from the live path
- add watermark-based export cursor
- keep route shape compatible where practical
- prove deterministic pagination through tests

### Phase 3: move both apps onto the same write contract

- `eCRM` shared writes stop bypassing version logic
- `eMailVoice` shared writes use the same contract
- add idempotent cross-app reconciliation checks

### Phase 4: tighten conflict handling

- require `baseVersion` on shared updates
- surface conflict responses explicitly
- add retry or refresh behavior in each app where needed

## Consequences

### Benefits

- deterministic export without long-lived full-copy snapshot sessions
- audit trail for every shared-entity change
- safer coexistence when both apps touch shared entities
- lower migration risk because existing reads can stay on `SharedBusinessRecord`

### Costs

- every shared write becomes more structured
- mutation code grows more complex because history and projection must stay atomic
- backfill and test matrix expand

## Risks

### Risk 1: hidden dual-write logic remains

If either repo keeps mutating `SharedBusinessRecord` directly outside the version contract, history becomes unreliable.

Mitigation:

- centralize shared-record mutation helpers
- add tests that prove direct updates are not used in shared paths

### Risk 2: conflict handling slows UI work

Optimistic concurrency may introduce `409` style conflicts where current flows assumed blind overwrite.

Mitigation:

- start with shared admin/integration paths first
- add explicit refresh-and-retry handling only where real collisions happen

### Risk 3: export query complexity rises

If watermark selection is poorly indexed, export can still become slow.

Mitigation:

- add indexes for version ordering and head version markers
- validate with focused export tests before removing old snapshot code

## Validation

The redesign is correct when all of the following are true:

- a shared record mutation always creates a version row
- current-state reads still work from `SharedBusinessRecord`
- export page 1 no longer materializes the entire dataset before responding
- paging remains deterministic even while new writes happen
- the same shared entity can be updated by either app through the same contract with conflict detection

## Smallest Safe First Slice

Implement in this order:

1. Add `SharedBusinessRecordVersion` and backfill version `1` for existing shared rows.
2. Change shared-record mutation paths to append versions and update `SharedBusinessRecord.headVersion`.
3. Redesign export around `asOfVersion` watermark and remove snapshot materialization from page 1.
4. Only after that, update cross-app write callers to require idempotency keys and `baseVersion`.

## Non-Goals

Not part of this slice:

- migrating opportunities or proposals into the shared entity model
- redesigning UI screens in either app
- introducing a separate new service/repo before the data model is proven
- forcing full event sourcing for every business domain
