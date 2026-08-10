# Shared Platform Versioned Records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the snapshot-only export approach with a versioned shared-record model that preserves current-state reads, records immutable history, and supports deterministic export for peer-app coexistence.

**Architecture:** Keep `SharedBusinessRecord` as the current-state projection, add an append-only `SharedBusinessRecordVersion` ledger, and switch export to read against a stable version watermark instead of materializing a full snapshot session. Shared mutations should write history and projection atomically so `eCRM` and `eMailVoice` can both consume the same shared platform without one app becoming the owner of truth.

**Tech Stack:** Next.js App Router, Prisma, PostgreSQL, Vitest, TypeScript

---

### Task 1: Add Shared Record Version Storage

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260708_add_shared_business_record_versions/migration.sql`
- Create: `src/server/shared-records/versioning.ts`
- Create: `src/server/shared-records/versioning.test.ts`

- [ ] **Step 1: Write the failing schema and service tests**

```ts
import { describe, expect, it } from "vitest";
import { buildVersionLedgerEntry, toVersionedSharedRecord } from "./versioning";

describe("shared record versioning", () => {
  it("maps a current shared record into a version ledger entry", () => {
    const result = buildVersionLedgerEntry({
      recordId: "rec_1",
      versionNumber: 3,
      entityType: "CONTACT",
      sourceApp: "ecrm",
      changeType: "UPDATE",
      snapshot: { id: "rec_1", displayName: "Ada Lovelace" },
      baseVersion: 2,
      idempotencyKey: "idem-123"
    });

    expect(result.recordId).toBe("rec_1");
    expect(result.versionNumber).toBe(3);
    expect(result.entityType).toBe("CONTACT");
  });

  it("creates a versioned projection from a current shared record", () => {
    const result = toVersionedSharedRecord({
      id: "rec_1",
      headVersion: 3,
      displayName: "Ada Lovelace"
    });

    expect(result.headVersion).toBe(3);
    expect(result.displayName).toBe("Ada Lovelace");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd "C:\My Workspace\eCRM"; npm test -- src/server/shared-records/versioning.test.ts`
Expected: FAIL because `versioning.ts` does not exist yet.

- [ ] **Step 3: Add the version model, helper functions, and migration**

```prisma
model SharedBusinessRecord {
  id                   String           @id @default(cuid())
  entityType           SharedRecordType
  displayName          String
  status               String
  ownerId              String?
  parentId             String?
  relatedLeadId        String?
  relatedCustomerId    String?
  relatedContactId     String?
  relatedOpportunityId String?
  sourceApp            String
  ecrmLegacyId         String?
  emailVoiceLegacyId   String?
  externalKey          String?
  email                String?
  phone                String?
  companyName          String?
  searchText           String
  headVersion          Int              @default(1)
  lastChangedByApp     String?
  lastChangeAt         DateTime?
  data                 Json
  archivedAt           DateTime?
  createdAt            DateTime         @default(now())
  updatedAt            DateTime         @updatedAt

  @@unique([entityType, ecrmLegacyId])
  @@unique([entityType, emailVoiceLegacyId])
  @@unique([entityType, externalKey])
  @@index([entityType, status])
  @@index([ownerId])
  @@index([parentId])
  @@index([relatedLeadId])
  @@index([relatedCustomerId])
  @@index([relatedContactId])
  @@index([relatedOpportunityId])
  @@index([email])
  @@index([phone])
  @@index([companyName])
  @@index([searchText])
  @@index([headVersion])
  @@index([updatedAt])
}

model SharedBusinessRecordVersion {
  id             String   @id @default(cuid())
  recordId       String
  versionNumber  Int
  entityType     SharedRecordType
  sourceApp      String
  changeType     String
  changedAt      DateTime @default(now())
  actorId        String?
  idempotencyKey String?
  baseVersion    Int?
  snapshot       Json
  changedFields   Json?

  record SharedBusinessRecord @relation(fields: [recordId], references: [id], onDelete: Cascade)

  @@unique([recordId, versionNumber])
  @@index([entityType, changedAt])
  @@index([sourceApp, changedAt])
  @@index([idempotencyKey])
}
```

```ts
export function buildVersionLedgerEntry(input: {
  recordId: string;
  versionNumber: number;
  entityType: "LEAD" | "CUSTOMER" | "CONTACT" | "ORDER";
  sourceApp: string;
  changeType: "CREATE" | "UPDATE" | "ARCHIVE";
  snapshot: Record<string, unknown>;
  baseVersion?: number | null;
  idempotencyKey?: string | null;
}) {
  return {
    recordId: input.recordId,
    versionNumber: input.versionNumber,
    entityType: input.entityType,
    sourceApp: input.sourceApp,
    changeType: input.changeType,
    baseVersion: input.baseVersion ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
    snapshot: input.snapshot,
    changedFields: {}
  };
}

export function toVersionedSharedRecord(input: {
  id: string;
  headVersion: number;
  displayName: string;
}) {
  return input;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd "C:\My Workspace\eCRM"; npm test -- src/server/shared-records/versioning.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260708_add_shared_business_record_versions/migration.sql src/server/shared-records/versioning.ts src/server/shared-records/versioning.test.ts
git commit -m "feat: add shared business record version storage"
```

### Task 2: Make Shared Mutations Write History And Current State Atomically

**Files:**
- Modify: `src/server/shared-records/mutations.ts`
- Modify: `src/server/shared-records/queries.ts`
- Modify: `src/server/shared-records/mappers.ts`
- Create: `src/server/shared-records/mutations.test.ts`

- [ ] **Step 1: Write failing mutation tests for version creation and concurrency**

```ts
import { describe, expect, it, vi } from "vitest";
import { upsertSharedRecord } from "./mutations";

describe("shared record mutations", () => {
  it("creates version 1 when inserting a new shared record", async () => {
    const db = {
      sharedBusinessRecord: { upsert: vi.fn() },
      sharedBusinessRecordVersion: { create: vi.fn() },
      $transaction: vi.fn(async (fn) => fn(db))
    };

    await upsertSharedRecord(
      {
        entityType: "CONTACT",
        sourceApp: "ecrm",
        displayName: "Ada Lovelace",
        status: "ACTIVE",
        idempotencyKey: "idem-1"
      },
      db as never
    );

    expect(db.sharedBusinessRecordVersion.create).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd "C:\My Workspace\eCRM"; npm test -- src/server/shared-records/mutations.test.ts`
Expected: FAIL because version-aware mutation logic is not implemented yet.

- [ ] **Step 3: Implement atomic write behavior**

```ts
export async function upsertSharedRecord(input: SharedRecordUpsertInput, database = db) {
  return database.$transaction(async (tx) => {
    const current = await tx.sharedBusinessRecord.findUnique({ where: { id: input.id } });
    const nextVersion = (current?.headVersion ?? 0) + 1;
    const record = current
      ? await tx.sharedBusinessRecord.update({
          where: { id: input.id },
          data: {
            ...input.fields,
            headVersion: nextVersion,
            lastChangedByApp: input.sourceApp,
            lastChangeAt: new Date()
          }
        })
      : await tx.sharedBusinessRecord.create({
          data: {
            ...input.fields,
            headVersion: 1,
            lastChangedByApp: input.sourceApp,
            lastChangeAt: new Date()
          }
        });

    await tx.sharedBusinessRecordVersion.create({
      data: {
        recordId: record.id,
        versionNumber: nextVersion,
        entityType: input.entityType,
        sourceApp: input.sourceApp,
        changeType: current ? "UPDATE" : "CREATE",
        baseVersion: current?.headVersion ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        snapshot: record,
        changedFields: input.fields
      }
    });

    return record;
  });
}
```

- [ ] **Step 4: Run the mutation test to verify it passes**

Run: `cd "C:\My Workspace\eCRM"; npm test -- src/server/shared-records/mutations.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/shared-records/mutations.ts src/server/shared-records/queries.ts src/server/shared-records/mappers.ts src/server/shared-records/mutations.test.ts
git commit -m "feat: version shared record mutations"
```

### Task 3: Replace Export Snapshot Materialization With Watermark Export

**Files:**
- Modify: `src/server/shared-records/export.ts`
- Modify: `src/app/api/shared-records/export/route.ts`
- Modify: `src/server/shared-records/export.test.ts`
- Modify: `src/app/api/shared-records/export/route.test.ts`

- [ ] **Step 1: Write failing export tests for watermark paging**

```ts
import { describe, expect, it } from "vitest";
import { buildSharedRecordExportPage } from "./export";

describe("shared record export", () => {
  it("returns a stable watermark and a page of rows without snapshot materialization", async () => {
    const result = await buildSharedRecordExportPage(
      { entityType: "CONTACT", limit: 2 },
      {
        sharedBusinessRecord: {
          findMany: async () => [
            { id: "rec_2", entityType: "CONTACT", updatedAt: new Date("2026-07-07T10:00:00Z") },
            { id: "rec_1", entityType: "CONTACT", updatedAt: new Date("2026-07-07T09:00:00Z") }
          ]
        }
      } as never
    );

    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd "C:\My Workspace\eCRM"; npm test -- src/server/shared-records/export.test.ts src/app/api/shared-records/export/route.test.ts`
Expected: FAIL because the current export path still depends on snapshot materialization.

- [ ] **Step 3: Implement version-watermark export and remove snapshot-session dependence**

```ts
export async function buildSharedRecordExportPage(
  filters: SharedRecordExportFilters = {},
  database: SharedRecordExportDb = prismaSharedRecordExportDb
): Promise<{ items: SharedBusinessRecordDto[]; nextCursor: string | null; asOfVersion: number }> {
  const limit = Math.min(Math.max(filters.limit ?? DEFAULT_SHARED_RECORD_EXPORT_PAGE_SIZE, 1), MAX_SHARED_RECORD_EXPORT_PAGE_SIZE);
  const entityType = normalizeEntityType(filters.entityType as ExportableSharedRecordType | "" | undefined);
  const cursor = decodeSharedRecordExportCursor(filters.cursor);
  ensureCursorMatchesRequestedStream(cursor, entityType);

  const watermark = cursor?.asOfVersion ?? (await database.getExportWatermark(entityType));
  const items = await database.getExportSnapshotItemsByWatermark(watermark, entityType, cursor?.offset ?? 0, limit);

  return {
    items,
    asOfVersion: watermark,
    nextCursor: buildNextCursor({ asOfVersion: watermark, entityType, itemCount: items.length }, (cursor?.offset ?? 0) + items.length)
  };
}
```

- [ ] **Step 4: Run the export tests to verify they pass**

Run: `cd "C:\My Workspace\eCRM"; npm test -- src/server/shared-records/export.test.ts src/app/api/shared-records/export/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/shared-records/export.ts src/app/api/shared-records/export/route.ts src/server/shared-records/export.test.ts src/app/api/shared-records/export/route.test.ts
git commit -m "feat: replace shared record export snapshots with watermark paging"
```

### Task 4: Validate Backfill, Route Behavior, And Migration Safety

**Files:**
- Modify: `src/server/shared-records/versioning.test.ts`
- Modify: `src/server/shared-records/export.test.ts`
- Modify: `src/app/api/shared-records/export/route.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Add tests for backfill-friendly version counts and cursor stability**

```ts
it("rejects export cursors from a different entity type", async () => {
  await expect(
    buildSharedRecordExportPage(
      { entityType: "CONTACT", cursor: "bad-cursor" },
      database as never
    )
  ).rejects.toThrow("Invalid export cursor.");
});
```

- [ ] **Step 2: Run the focused validation tests**

Run: `cd "C:\My Workspace\eCRM"; npm test -- src/server/shared-records/versioning.test.ts src/server/shared-records/export.test.ts src/app/api/shared-records/export/route.test.ts`
Expected: PASS.

- [ ] **Step 3: Update the repo note to describe the new versioned shared-platform contract**

```md
The shared-records area now keeps `SharedBusinessRecord` as the current-state read model and `SharedBusinessRecordVersion` as the append-only history ledger. Export uses a version watermark, not a snapshot materialization job.
```

- [ ] **Step 4: Commit**

```bash
git add README.md src/server/shared-records/versioning.test.ts src/server/shared-records/export.test.ts src/app/api/shared-records/export/route.test.ts
git commit -m "docs: record versioned shared platform export contract"
```

## Execution Order

1. Add version storage.
2. Make shared mutations write history and projection atomically.
3. Replace export snapshots with watermark paging.
4. Run validation and document the new contract.

## Done Criteria

- shared records keep fast current-state reads
- every shared mutation writes immutable history
- export is deterministic without full snapshot materialization
- the model supports peer-app coexistence instead of one app owning the platform truth
