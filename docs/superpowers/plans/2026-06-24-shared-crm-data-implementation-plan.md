# Shared CRM Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store leads, customers, contacts, opportunities, and orders in one canonical shared table that both eCRM and eMailVoice use while preserving separate UIs.

**Architecture:** eCRM owns the shared data API and the canonical PostgreSQL table. eMailVoice does not write directly to the shared table; it calls the eCRM shared-data API and keeps only campaign, channel, delivery, inbox, and analytics data locally. During migration, legacy eCRM/eMailVoice tables remain readable for backfill and fallback, but new shared-entity writes move through the shared API.

**Tech Stack:** eCRM Next.js 16 App Router, Prisma 6, PostgreSQL, Vitest, Playwright. eMailVoice FastAPI, SQLModel, Alembic, React/Vite, pytest, Playwright.

---

## Decision Summary

Use one canonical table: `shared_business_records`.

This table stores all shared business objects by `entityType`: `LEAD`, `CUSTOMER`, `CONTACT`, `OPPORTUNITY`, `ORDER`. Shared fields are first-class columns for search, filtering, ownership, status, relationships, and audit. Entity-specific data lives in `data Json`.

Do not let two ORMs mutate the table directly. eCRM owns the API because its current schema already contains the richer lead-to-cash model: `LeadCustomer`, `Contact`, `Opportunity`, `Order`, proposals, invoices, and production links. eMailVoice integrates through HTTP client calls.

## Parallel Streams

### Stream A: Canonical Schema and Contract

Owner: eCRM database/API worker.

Can start immediately.

Produces the shared table, TypeScript types, validators, and contract tests. Other streams depend on the contract names but can stub against the draft interface.

### Stream B: eCRM Shared API

Owner: eCRM backend worker.

Starts after Stream A types are drafted.

Produces list/detail/upsert endpoints and server functions for shared records. This becomes the only cross-app write path.

### Stream C: eCRM Migration and UI Adapter

Owner: eCRM migration/UI worker.

Starts after Stream B exposes create/list/upsert primitives.

Backfills current `LeadCustomer`, `Contact`, `Opportunity`, and `Order` rows into `shared_business_records`, then updates eCRM query paths to read from the shared table for the migrated screens.

### Stream D: eMailVoice Integration Adapter

Owner: eMailVoice backend/frontend worker.

Starts after Stream B publishes the API contract. It can use a mock client first.

Replaces eMailVoice account/contact CRUD surfaces with shared API calls while preserving campaign, sequence, call, email, chatbot, and timeline-specific local data.

### Stream E: Verification, Cutover, and Operations

Owner: cross-repo QA/ops worker.

Starts once Streams B-D have testable endpoints.

Adds integration checks proving the same shared record appears in both apps, documents local startup, and prepares rollback.

---

## File Structure

### eCRM

- Modify: `C:\My Workspace\eCRM\prisma\schema.prisma`
- Create: `C:\My Workspace\eCRM\src\server\shared-records\types.ts`
- Create: `C:\My Workspace\eCRM\src\server\shared-records\validators.ts`
- Create: `C:\My Workspace\eCRM\src\server\shared-records\mappers.ts`
- Create: `C:\My Workspace\eCRM\src\server\shared-records\queries.ts`
- Create: `C:\My Workspace\eCRM\src\server\shared-records\mutations.ts`
- Create: `C:\My Workspace\eCRM\src\app\api\shared-records\route.ts`
- Create: `C:\My Workspace\eCRM\src\app\api\shared-records\[recordId]\route.ts`
- Create: `C:\My Workspace\eCRM\src\server\shared-records\*.test.ts`
- Modify later: `C:\My Workspace\eCRM\src\server\crm\queries.ts`
- Modify later: `C:\My Workspace\eCRM\src\server\crm\mutations.ts`
- Modify later: `C:\My Workspace\eCRM\src\server\opportunities\queries.ts`
- Modify later: `C:\My Workspace\eCRM\src\server\orders\queries.ts`
- Create: `C:\My Workspace\eCRM\prisma\shared-record-backfill.ts`
- Create: `C:\My Workspace\eCRM\tests\e2e\shared-records.spec.ts`

### eMailVoice

- Create: `C:\Users\K.Ramachandran\eMailVoice\apps\api\app\integrations\ecrm_shared_records.py`
- Create: `C:\Users\K.Ramachandran\eMailVoice\apps\api\app\integrations\test_ecrm_shared_records.py`
- Modify: `C:\Users\K.Ramachandran\eMailVoice\apps\api\app\core\config.py`
- Modify: `C:\Users\K.Ramachandran\eMailVoice\apps\api\app\api\routes\contacts.py`
- Modify: `C:\Users\K.Ramachandran\eMailVoice\apps\api\app\api\routes\accounts.py`
- Modify: `C:\Users\K.Ramachandran\eMailVoice\apps\api\app\api\routes\customer_360.py`
- Add later migration: add `shared_record_id` references to local campaign/contact-event tables only where local channel data still needs a durable pointer.

---

## Canonical Table Shape

Add this Prisma model in eCRM:

```prisma
enum SharedRecordType {
  LEAD
  CUSTOMER
  CONTACT
  OPPORTUNITY
  ORDER
}

model SharedBusinessRecord {
  id                  String           @id @default(cuid())
  entityType          SharedRecordType
  displayName         String
  status              String
  ownerId             String?
  parentId            String?
  relatedLeadId       String?
  relatedCustomerId   String?
  relatedContactId    String?
  relatedOpportunityId String?
  sourceApp           String
  ecrmLegacyId        String?
  emailVoiceLegacyId  String?
  externalKey         String?
  email               String?
  phone               String?
  companyName         String?
  searchText          String
  data                Json
  archivedAt          DateTime?
  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt

  @@unique([entityType, ecrmLegacyId])
  @@unique([entityType, emailVoiceLegacyId])
  @@index([entityType, status])
  @@index([ownerId])
  @@index([parentId])
  @@index([relatedLeadId])
  @@index([relatedCustomerId])
  @@index([relatedOpportunityId])
  @@index([email])
  @@index([phone])
  @@index([companyName])
  @@index([updatedAt])
}
```

Notes:
- `parentId` stores hierarchy: contact under customer, opportunity under customer/lead, order under opportunity.
- `data` stores typed payload by record type.
- `searchText` stores normalized name/email/phone/company/order number for fast filtering.
- Legacy IDs stay in the row so both repos can migrate without lookup tables.

---

## Stream A Tasks: eCRM Canonical Schema

### Task A1: Add Schema and Prisma Migration

**Files:**
- Modify: `C:\My Workspace\eCRM\prisma\schema.prisma`
- Test: `C:\My Workspace\eCRM\src\server\shared-records\validators.test.ts`

- [ ] **Step 1: Add `SharedRecordType` and `SharedBusinessRecord` to Prisma schema**

Use the model in the Canonical Table Shape section.

- [ ] **Step 2: Run Prisma migration**

Run:

```powershell
cd "C:\My Workspace\eCRM"
npm run prisma:migrate -- --name add_shared_business_records
```

Expected: Prisma creates a migration under `prisma/migrations/*_add_shared_business_records`.

- [ ] **Step 3: Generate Prisma client**

Run:

```powershell
npm run prisma:generate
```

Expected: command exits 0.

### Task A2: Add Shared Types and Validators

**Files:**
- Create: `src/server/shared-records/types.ts`
- Create: `src/server/shared-records/validators.ts`
- Create: `src/server/shared-records/validators.test.ts`

- [ ] **Step 1: Add shared record payload types**

```ts
export type SharedRecordType = "LEAD" | "CUSTOMER" | "CONTACT" | "OPPORTUNITY" | "ORDER";

export type SharedRecordPayload =
  | { type: "LEAD"; industry?: string; source?: string; notes?: string }
  | { type: "CUSTOMER"; industry?: string; websiteUrl?: string; notes?: string }
  | { type: "CONTACT"; designation?: string; firstName?: string; lastName?: string; timezone?: string; tags?: string[] }
  | { type: "OPPORTUNITY"; title: string; productInterest?: string; estimatedValuePaisa?: number; probability?: number; nextFollowUpAt?: string }
  | { type: "ORDER"; orderNumber: string; currency: string; subtotalPaisa: number; gstPaisa: number; totalPaisa: number; bookedAt: string };
```

- [ ] **Step 2: Add zod validators**

```ts
import { z } from "zod";

export const sharedRecordTypeSchema = z.enum(["LEAD", "CUSTOMER", "CONTACT", "OPPORTUNITY", "ORDER"]);

export const sharedRecordUpsertSchema = z.object({
  entityType: sharedRecordTypeSchema,
  displayName: z.string().trim().min(1),
  status: z.string().trim().min(1),
  ownerId: z.string().trim().min(1).optional(),
  parentId: z.string().trim().min(1).optional(),
  relatedLeadId: z.string().trim().min(1).optional(),
  relatedCustomerId: z.string().trim().min(1).optional(),
  relatedContactId: z.string().trim().min(1).optional(),
  relatedOpportunityId: z.string().trim().min(1).optional(),
  sourceApp: z.enum(["ecrm", "emailvoice"]),
  ecrmLegacyId: z.string().trim().min(1).optional(),
  emailVoiceLegacyId: z.string().trim().min(1).optional(),
  externalKey: z.string().trim().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().trim().min(1).optional(),
  companyName: z.string().trim().min(1).optional(),
  data: z.record(z.string(), z.unknown()).default({})
});
```

- [ ] **Step 3: Test validation**

Run:

```powershell
npm test -- src/server/shared-records/validators.test.ts
```

Expected: valid records pass, blank display names fail, invalid entity types fail.

---

## Stream B Tasks: eCRM Shared API

### Task B1: Add Shared Record Query and Mutation Layer

**Files:**
- Create: `src/server/shared-records/mappers.ts`
- Create: `src/server/shared-records/queries.ts`
- Create: `src/server/shared-records/mutations.ts`
- Create: `src/server/shared-records/queries.test.ts`
- Create: `src/server/shared-records/mutations.test.ts`

- [ ] **Step 1: Add `buildSearchText` mapper**

```ts
export function buildSearchText(input: {
  displayName: string;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  externalKey?: string | null;
}) {
  return [input.displayName, input.email, input.phone, input.companyName, input.externalKey]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
```

- [ ] **Step 2: Add list and detail queries**

Implement:

```ts
export async function listSharedRecords(filters: {
  entityType?: SharedRecordType;
  q?: string;
  status?: string;
  parentId?: string;
  limit?: number;
}) {
  // Use db.sharedBusinessRecord.findMany with entityType/status/parentId/searchText filters.
}

export async function getSharedRecord(recordId: string) {
  // Use db.sharedBusinessRecord.findUnique({ where: { id: recordId } }).
}
```

- [ ] **Step 3: Add idempotent upsert**

Implement:

```ts
export async function upsertSharedRecord(input: SharedRecordUpsertInput) {
  // Prefer ecrmLegacyId or emailVoiceLegacyId when present.
  // Otherwise create a new shared record.
}
```

- [ ] **Step 4: Run focused tests**

Run:

```powershell
npm test -- src/server/shared-records/queries.test.ts src/server/shared-records/mutations.test.ts
```

Expected: list/detail/upsert behavior passes.

### Task B2: Add HTTP API Routes

**Files:**
- Create: `src/app/api/shared-records/route.ts`
- Create: `src/app/api/shared-records/[recordId]/route.ts`
- Create: `src/server/shared-records/api-auth.ts`
- Create: `src/server/shared-records/api-auth.test.ts`

- [ ] **Step 1: Add shared API token env var**

Add `SHARED_DATA_API_TOKEN` to eCRM env validation if env validation exists for API-only server config. For local development, use a 32+ character token.

- [ ] **Step 2: Add bearer-token check**

```ts
export function requireSharedDataApiToken(request: Request) {
  const expected = process.env.SHARED_DATA_API_TOKEN;
  const actual = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!expected || actual !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  return null;
}
```

- [ ] **Step 3: Add `GET /api/shared-records` and `POST /api/shared-records`**

`GET` supports `entityType`, `q`, `status`, `parentId`, `limit`.

`POST` validates with `sharedRecordUpsertSchema` and calls `upsertSharedRecord`.

- [ ] **Step 4: Add `GET /api/shared-records/:recordId`**

Return `404` when absent.

- [ ] **Step 5: Verify with curl**

Run:

```powershell
$env:SHARED_DATA_API_TOKEN="local-shared-data-token-1234567890"
npm run dev -- --port 5050
```

Then:

```powershell
Invoke-RestMethod -Headers @{ Authorization = "Bearer local-shared-data-token-1234567890" } -Uri "http://localhost:5050/api/shared-records?entityType=CONTACT"
```

Expected: JSON response with `data` and `count`.

---

## Stream C Tasks: eCRM Backfill and Adapter

### Task C1: Backfill Existing eCRM Records

**Files:**
- Create: `prisma/shared-record-backfill.ts`
- Add tests where current seed fixtures allow deterministic assertions.

- [ ] **Step 1: Backfill `LeadCustomer` as `LEAD` or `CUSTOMER`**

Map:
- `LeadCustomer.state === LEAD` -> `entityType=LEAD`
- `LeadCustomer.state === CUSTOMER` -> `entityType=CUSTOMER`
- `name` -> `displayName`
- `state` -> `status`
- `ownerId` -> `ownerId`
- `industry`, `source`, `notes` -> `data`
- `id` -> `ecrmLegacyId`

- [ ] **Step 2: Backfill `Contact` as `CONTACT`**

Map:
- `Contact.name` -> `displayName`
- `Contact.email` -> `email`
- `Contact.phone` -> `phone`
- `Contact.leadCustomerId` -> `parentId`
- `Contact.id` -> `ecrmLegacyId`
- `designation`, `isPrimary`, `notes` -> `data`

- [ ] **Step 3: Backfill `Opportunity` as `OPPORTUNITY`**

Map:
- `Opportunity.title` -> `displayName`
- pipeline stage name or kind -> `status`
- `Opportunity.leadCustomerId` -> `relatedLeadId` or `relatedCustomerId`
- `Opportunity.id` -> `ecrmLegacyId`
- value/probability/follow-up fields -> `data`

- [ ] **Step 4: Backfill `Order` as `ORDER`**

Map:
- `Order.orderNumber` -> `displayName` and `externalKey`
- `Order.status` -> `status`
- `Order.opportunityId` -> `relatedOpportunityId`
- `Order.leadCustomerId` -> `relatedCustomerId`
- `Order.id` -> `ecrmLegacyId`
- totals and PO fields -> `data`

- [ ] **Step 5: Run backfill locally**

Run:

```powershell
npx tsx prisma/shared-record-backfill.ts
```

Expected: output counts for leads/customers, contacts, opportunities, orders.

### Task C2: Switch eCRM Read Paths One Module at a Time

**Files:**
- Modify: `src/server/crm/queries.ts`
- Modify: `src/server/opportunities/queries.ts`
- Modify: `src/server/orders/queries.ts`
- Tests: existing query tests for each module.

- [ ] **Step 1: Contacts and customers read from `SharedBusinessRecord`**

Keep existing UI return shapes by mapping shared records into current component DTOs.

- [ ] **Step 2: Leads read from `SharedBusinessRecord`**

Use `entityType in ["LEAD", "CUSTOMER"]`.

- [ ] **Step 3: Opportunities read from `SharedBusinessRecord`**

Use `entityType="OPPORTUNITY"`.

- [ ] **Step 4: Orders read from `SharedBusinessRecord`**

Use `entityType="ORDER"` and `data` for totals.

- [ ] **Step 5: Run eCRM focused gates**

```powershell
npm run typecheck
npm test -- src/server/crm/queries.test.ts src/server/opportunities/queries.test.ts src/server/orders/queries.test.ts
npm run test:e2e -- tests/e2e/auth.spec.ts tests/e2e/crm-core.spec.ts tests/e2e/opportunities.spec.ts tests/e2e/orders-production.spec.ts
```

Expected: all pass.

---

## Stream D Tasks: eMailVoice Shared API Integration

### Task D1: Add eCRM Shared Records Client

**Files:**
- Modify: `apps/api/app/core/config.py`
- Create: `apps/api/app/integrations/ecrm_shared_records.py`
- Create: `apps/api/app/integrations/test_ecrm_shared_records.py`

- [ ] **Step 1: Add config**

Add:

```python
ECRM_SHARED_API_BASE_URL: str = "http://localhost:5050"
ECRM_SHARED_API_TOKEN: str = ""
```

- [ ] **Step 2: Add client functions**

```python
def list_shared_records(entity_type: str, q: str | None = None) -> dict:
    # GET /api/shared-records

def upsert_shared_record(payload: dict) -> dict:
    # POST /api/shared-records

def get_shared_record(record_id: str) -> dict:
    # GET /api/shared-records/{record_id}
```

- [ ] **Step 3: Add client tests with mocked HTTP**

Expected:
- sends bearer token
- maps 401 to integration error
- maps 404 to not found
- returns parsed JSON for success

### Task D2: Route eMailVoice Contacts and Accounts Through Shared API

**Files:**
- Modify: `apps/api/app/api/routes/contacts.py`
- Modify: `apps/api/app/api/routes/accounts.py`
- Modify: `apps/api/app/api/routes/customer_360.py`
- Tests: existing route tests plus new mocked integration tests.

- [ ] **Step 1: Contacts list reads shared `CONTACT` records**

Keep the current `ContactPublic` response shape.

- [ ] **Step 2: Contact import upserts shared `CONTACT` records**

Use email as a stable match key when present. Store old eMailVoice contact ID into `emailVoiceLegacyId`.

- [ ] **Step 3: Accounts list reads shared `CUSTOMER` records**

Map `AccountPublic` from shared `CUSTOMER` payload.

- [ ] **Step 4: Account assignment sets contact `parentId`**

When assigning contacts to accounts, update the shared contact record with `parentId=<customer shared record id>`.

- [ ] **Step 5: Customer 360 reads account/contact profile from shared API**

Keep channel summaries, next actions, inbox, email, voice, chatbot, and campaign events from local eMailVoice tables.

- [ ] **Step 6: Run focused eMailVoice tests**

```powershell
cd "C:\Users\K.Ramachandran\eMailVoice\apps\api"
uv run pytest tests/api/routes/test_contacts.py tests/api/routes/test_accounts.py tests/api/routes/test_customer_360.py tests/unit -q
```

Expected: all pass with mocked eCRM shared API.

---

## Stream E Tasks: Cross-App Verification and Cutover

### Task E1: Add Contract Smoke Test

**Files:**
- Create: `C:\My Workspace\eCRM\tests\e2e\shared-records.spec.ts`
- Add a matching eMailVoice smoke once API integration is in place.

- [ ] **Step 1: Create record through eCRM API**

Create a `CONTACT` with email `shared-smoke@example.com`.

- [ ] **Step 2: Read same record from eMailVoice contacts API**

Assert the email and display name match.

- [ ] **Step 3: Update record through eMailVoice API**

Change phone or company.

- [ ] **Step 4: Read same record from eCRM API**

Assert update is visible.

### Task E2: Cutover Checklist

- [ ] **Step 1: Back up both local databases**

Use `pg_dump` for eCRM and eMailVoice before migration.

- [ ] **Step 2: Run eCRM backfill**

Use `npx tsx prisma/shared-record-backfill.ts`.

- [ ] **Step 3: Enable eCRM shared API token**

Set matching `SHARED_DATA_API_TOKEN` in eCRM and `ECRM_SHARED_API_TOKEN` in eMailVoice.

- [ ] **Step 4: Switch eMailVoice routes to shared client**

Deploy route changes behind a config flag first:

```python
USE_ECRM_SHARED_RECORDS: bool = False
```

Then turn it on locally.

- [ ] **Step 5: Run full gates**

eCRM:

```powershell
cd "C:\My Workspace\eCRM"
npm run gate
npm run test:e2e
```

eMailVoice:

```powershell
cd "C:\Users\K.Ramachandran\eMailVoice"
uv run pytest
cd apps\web
npm run build
```

Expected: both repos pass.

---

## Execution Order

Fastest safe order:

1. Stream A: schema/types.
2. Stream B: API with tests.
3. Stream D: eMailVoice client using mocked API.
4. Stream C: eCRM backfill and read-path switch for contacts/customers.
5. Stream E: cross-app smoke for contacts/customers.
6. Stream C: leads/opportunities/orders read-path switch.
7. Stream D: Customer 360 and import flows point at shared API.
8. Stream E: full cutover tests and docs.

Contacts/customers should ship first. Leads/opportunities/orders follow after the shared model proves stable.

## Risks

- One-table design trades relational constraints for flexibility. The mitigation is strict validators, contract tests, typed payloads, and indexes on shared query columns.
- eMailVoice has channel-specific contact state. Keep that local and reference the shared contact ID instead of forcing channel state into the shared table.
- Orders contain money and workflow state. Migrate orders after contacts/customers and opportunities are stable.
- Dual direct database writes are not allowed. The shared API is the write boundary.

## Done Criteria

- A contact created in eCRM is visible in eMailVoice.
- A contact imported in eMailVoice is visible in eCRM.
- Customer 360 in both apps resolves the same customer/contact identity.
- Opportunities and orders use the same shared record IDs across both apps.
- No new shared business object write goes into separate duplicate tables.
- Both repo gates pass.

