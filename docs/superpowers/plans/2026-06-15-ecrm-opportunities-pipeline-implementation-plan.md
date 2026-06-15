# Opportunities Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the opportunities and pipeline slice after CRM Core: opportunity records, configurable stages, ownership splits, target setup, list/board views, and smoke coverage.

**Architecture:** This slice is the only active schema owner. It adds opportunity-specific Prisma models linked to the landed CRM Core `LeadCustomer`, `Branch`, and `User` models, then follows the existing CRM module pattern with validators, dependency-injected service functions, server actions, and App Router pages under `/opportunities`. It intentionally keeps product catalog, proposals, orders, invoices, payments, production, costs, incentives, and reports out of code.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma/Postgres, Zod, Vitest, Testing Library, Playwright, Tailwind CSS.

---

## Scope Boundaries

Included:

- Opportunity records attached to `LeadCustomer` and optionally `Branch`.
- Configurable pipeline stages seeded with Lead, Qualified, Proposal Sent, Negotiation, Won, Lost, Dormant.
- Opportunity owner and optional split percentages.
- Product/service interest as free text until the product catalog slice lands.
- Estimated value stored as INR decimal text input and Prisma `Decimal`.
- Last reach and next follow-up dates stored on the opportunity for pipeline scanning.
- Sales target records by owner, financial year, quarter, and target amount.
- List and board views under `/opportunities`.

Excluded:

- Product/service catalog tables.
- Proposal records or Canva PDF metadata.
- Order creation from won opportunities.
- Invoice, payment, cost, incentive, production, and report implementation.
- CSV import.
- Destructive deletes.

## File Structure

- Modify `prisma/schema.prisma`: add opportunity enums/models and relations to `User`, `LeadCustomer`, and `Branch`.
- Modify `prisma/seed.ts`: seed stages, one sample opportunity, one split, and one target.
- Create `src/server/opportunities/types.ts`: shared action, input, filter, and view types.
- Create `src/server/opportunities/validators.ts`: Zod schemas and form normalizers.
- Create `src/server/opportunities/validators.test.ts`: validation coverage.
- Create `src/server/opportunities/permissions.ts`: role assertions reusing CRM permissions.
- Create `src/server/opportunities/queries.ts`: list, board, detail, option, and target read functions.
- Create `src/server/opportunities/queries.test.ts`: visibility/filter/stage grouping coverage.
- Create `src/server/opportunities/mutations.ts`: create/update/stage/split/target service functions.
- Create `src/server/opportunities/mutations.test.ts`: owner/stage/branch/split/target behavior.
- Create `src/server/opportunities/actions.ts`: server actions and form parsing helpers.
- Create `src/server/opportunities/actions.test.ts`: action parsing and validation errors.
- Create `src/components/opportunities/opportunity-list.tsx`: dense list and filters.
- Create `src/components/opportunities/opportunity-board.tsx`: grouped board view.
- Create `src/components/opportunities/opportunity-form.tsx`: create/edit form.
- Create `src/components/opportunities/stage-form.tsx`: Admin stage form.
- Create `src/components/opportunities/target-form.tsx`: target setup form.
- Create `src/app/(app)/opportunities/page.tsx`: list/board route.
- Create `src/app/(app)/opportunities/new/page.tsx`: create route.
- Create `src/app/(app)/opportunities/[opportunityId]/page.tsx`: detail route.
- Create `src/app/(app)/opportunities/[opportunityId]/edit/page.tsx`: edit route.
- Create `src/app/(app)/opportunities/stages/page.tsx`: Admin stage management route.
- Create `src/app/(app)/opportunities/targets/page.tsx`: target setup route.
- Create `tests/e2e/opportunities.spec.ts`: browser smoke.

---

### Task 1: Prisma Opportunity Schema

**Files:**
- Modify: `prisma/schema.prisma`
- Verify: `npx prisma validate`

- [ ] **Step 1: Add enums after `ActivityStatus`**

```prisma
enum PipelineStageKind {
  OPEN
  WON
  LOST
  DORMANT
}
```

- [ ] **Step 2: Add relations to existing models**

Add these fields to `User`:

```prisma
  ownedOpportunities       Opportunity[]          @relation("OpportunityOwner")
  createdOpportunities     Opportunity[]          @relation("OpportunityCreatedBy")
  updatedOpportunities     Opportunity[]          @relation("OpportunityUpdatedBy")
  opportunitySplits        OpportunityOwnerSplit[]
  salesTargets             SalesTarget[]          @relation("SalesTargetOwner")
  salesTargetsCreated      SalesTarget[]          @relation("SalesTargetCreatedBy")
```

Add this field to `LeadCustomer`:

```prisma
  opportunities Opportunity[]
```

Add this field to `Branch`:

```prisma
  opportunities Opportunity[]
```

- [ ] **Step 3: Add opportunity models after `LeadOwnershipHistory`**

```prisma
model PipelineStage {
  id        String            @id @default(cuid())
  name      String            @unique
  sortOrder Int
  kind      PipelineStageKind @default(OPEN)
  active    Boolean           @default(true)
  createdAt DateTime          @default(now())
  updatedAt DateTime          @updatedAt

  opportunities Opportunity[]

  @@index([sortOrder])
  @@index([kind])
}

model Opportunity {
  id                String   @id @default(cuid())
  leadCustomerId    String
  branchId          String?
  stageId           String
  ownerId           String
  title             String
  productInterest   String?
  estimatedValueInr Decimal? @db.Decimal(14, 2)
  probability       Int?
  lastReachAt       DateTime?
  nextFollowUpAt    DateTime?
  notes             String?
  createdById       String
  updatedById       String
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  leadCustomer LeadCustomer            @relation(fields: [leadCustomerId], references: [id], onDelete: Cascade)
  branch       Branch?                 @relation(fields: [branchId], references: [id], onDelete: SetNull)
  stage        PipelineStage           @relation(fields: [stageId], references: [id])
  owner        User                    @relation("OpportunityOwner", fields: [ownerId], references: [id])
  createdBy    User                    @relation("OpportunityCreatedBy", fields: [createdById], references: [id])
  updatedBy    User                    @relation("OpportunityUpdatedBy", fields: [updatedById], references: [id])
  splits       OpportunityOwnerSplit[]

  @@index([leadCustomerId])
  @@index([branchId])
  @@index([stageId])
  @@index([ownerId])
  @@index([nextFollowUpAt])
  @@index([updatedAt])
}

model OpportunityOwnerSplit {
  opportunityId String
  userId        String
  percent       Int

  opportunity Opportunity @relation(fields: [opportunityId], references: [id], onDelete: Cascade)
  user        User        @relation(fields: [userId], references: [id])

  @@id([opportunityId, userId])
  @@index([userId])
}

model SalesTarget {
  id             String   @id @default(cuid())
  ownerId        String
  financialYear  Int
  quarter        Int
  targetValueInr Decimal  @db.Decimal(14, 2)
  createdById    String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  owner     User @relation("SalesTargetOwner", fields: [ownerId], references: [id])
  createdBy User @relation("SalesTargetCreatedBy", fields: [createdById], references: [id])

  @@unique([ownerId, financialYear, quarter])
  @@index([financialYear, quarter])
}
```

- [ ] **Step 4: Validate schema**

Run:

```powershell
npx prisma validate
```

Expected:

```text
The schema at prisma\schema.prisma is valid
```

- [ ] **Step 5: Create and apply migration**

Run:

```powershell
npm run prisma:migrate -- --name add_opportunities_pipeline
npm run prisma:generate
```

Expected:

```text
Applying migration `..._add_opportunities_pipeline`
Generated Prisma Client
```

- [ ] **Step 6: Commit schema**

```powershell
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add opportunities schema"
```

---

### Task 2: Validation Contracts

**Files:**
- Create: `src/server/opportunities/types.ts`
- Create: `src/server/opportunities/validators.ts`
- Create: `src/server/opportunities/validators.test.ts`

- [ ] **Step 1: Write failing validator tests**

Create `src/server/opportunities/validators.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  opportunityFilterSchema,
  opportunityInputSchema,
  pipelineStageInputSchema,
  salesTargetInputSchema
} from "./validators";

describe("opportunity validators", () => {
  it("normalizes opportunity input", () => {
    const parsed = opportunityInputSchema.parse({
      leadCustomerId: "lead_1",
      branchId: "",
      stageId: "stage_qualified",
      ownerId: "user_sales",
      title: "  eLearning rollout  ",
      productInterest: " Custom LMS ",
      estimatedValueInr: "125000.50",
      probability: "60",
      lastReachAt: "2026-06-14T10:00",
      nextFollowUpAt: "2026-06-20T10:00",
      notes: " Needs proposal "
    });

    expect(parsed).toMatchObject({
      leadCustomerId: "lead_1",
      branchId: undefined,
      title: "eLearning rollout",
      productInterest: "Custom LMS",
      estimatedValueInr: "125000.50",
      probability: 60,
      notes: "Needs proposal"
    });
  });

  it("requires title, lead/customer, stage, and owner", () => {
    const result = opportunityInputSchema.safeParse({
      leadCustomerId: "",
      stageId: "",
      ownerId: "",
      title: " "
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.leadCustomerId).toContain("Choose a lead or customer.");
      expect(errors.stageId).toContain("Choose a pipeline stage.");
      expect(errors.ownerId).toContain("Choose an owner.");
      expect(errors.title).toContain("Enter an opportunity title.");
    }
  });

  it("rejects invalid probability and amount", () => {
    const result = opportunityInputSchema.safeParse({
      leadCustomerId: "lead_1",
      stageId: "stage_1",
      ownerId: "user_sales",
      title: "VR training",
      estimatedValueInr: "-1",
      probability: "101"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.estimatedValueInr).toContain("Enter a non-negative estimated value.");
      expect(errors.probability).toContain("Enter probability from 0 to 100.");
    }
  });

  it("normalizes stage and target input", () => {
    expect(
      pipelineStageInputSchema.parse({ name: " Proposal Sent ", sortOrder: "30", kind: "OPEN", active: "on" })
    ).toEqual({ name: "Proposal Sent", sortOrder: 30, kind: "OPEN", active: true });

    expect(
      salesTargetInputSchema.parse({
        ownerId: "user_sales",
        financialYear: "2026",
        quarter: "1",
        targetValueInr: "500000"
      })
    ).toEqual({ ownerId: "user_sales", financialYear: 2026, quarter: 1, targetValueInr: "500000.00" });
  });

  it("parses list filters", () => {
    expect(
      opportunityFilterSchema.parse({
        q: " acme ",
        ownerId: "user_sales",
        stageId: "stage_1",
        followUp: "upcoming",
        view: "board"
      })
    ).toEqual({
      q: "acme",
      ownerId: "user_sales",
      stageId: "stage_1",
      followUp: "upcoming",
      view: "board"
    });
  });
});
```

- [ ] **Step 2: Verify failing test**

Run:

```powershell
npm run test -- src/server/opportunities/validators.test.ts
```

Expected:

```text
Cannot find module './validators'
```

- [ ] **Step 3: Create types and validators**

Create `src/server/opportunities/types.ts`:

```ts
import type { PipelineStageKind } from "@prisma/client";

export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export type OpportunityInput = {
  leadCustomerId: string;
  branchId?: string;
  stageId: string;
  ownerId: string;
  title: string;
  productInterest?: string;
  estimatedValueInr?: string;
  probability?: number;
  lastReachAt?: Date;
  nextFollowUpAt?: Date;
  notes?: string;
};

export type PipelineStageInput = {
  name: string;
  sortOrder: number;
  kind: PipelineStageKind;
  active: boolean;
};

export type SalesTargetInput = {
  ownerId: string;
  financialYear: number;
  quarter: number;
  targetValueInr: string;
};

export type OpportunityFilters = {
  q?: string;
  ownerId?: string;
  stageId?: string;
  followUp?: "overdue" | "today" | "upcoming";
  view?: "list" | "board";
};
```

Create `src/server/opportunities/validators.ts` with these schemas:

```ts
import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (value === null) return undefined;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const requiredTrimmedString = (message: string) => z.string({ error: message }).trim().min(1, message);
const optionalTrimmedString = z.preprocess(emptyToUndefined, z.string().trim().optional());

const optionalDate = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed ? new Date(trimmed) : undefined;
}, z.date("Enter a valid date.").optional());

const optionalAmount = z.preprocess((value) => {
  const normalized = emptyToUndefined(value);
  if (normalized === undefined) return undefined;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return normalized;
  return amount.toFixed(2);
}, z.string().regex(/^\d+(\.\d{2})$/, "Enter a non-negative estimated value.").optional());

const requiredAmount = z.preprocess((value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return value;
  return amount.toFixed(2);
}, z.string().regex(/^\d+(\.\d{2})$/, "Enter a non-negative target amount."));

const optionalProbability = z.preprocess((value) => {
  const normalized = emptyToUndefined(value);
  if (normalized === undefined) return undefined;
  return Number(normalized);
}, z.number("Enter probability from 0 to 100.").int("Enter probability from 0 to 100.").min(0, "Enter probability from 0 to 100.").max(100, "Enter probability from 0 to 100.").optional());

const checkboxBoolean = z.preprocess((value) => value === true || value === "on", z.boolean());

export const opportunityInputSchema = z.object({
  leadCustomerId: requiredTrimmedString("Choose a lead or customer."),
  branchId: optionalTrimmedString,
  stageId: requiredTrimmedString("Choose a pipeline stage."),
  ownerId: requiredTrimmedString("Choose an owner."),
  title: requiredTrimmedString("Enter an opportunity title."),
  productInterest: optionalTrimmedString,
  estimatedValueInr: optionalAmount,
  probability: optionalProbability,
  lastReachAt: optionalDate,
  nextFollowUpAt: optionalDate,
  notes: optionalTrimmedString
});

export const pipelineStageInputSchema = z.object({
  name: requiredTrimmedString("Enter a stage name."),
  sortOrder: z.coerce.number().int().min(0),
  kind: z.enum(["OPEN", "WON", "LOST", "DORMANT"]),
  active: checkboxBoolean.default(false)
});

export const salesTargetInputSchema = z.object({
  ownerId: requiredTrimmedString("Choose an owner."),
  financialYear: z.coerce.number().int().min(2020).max(2100),
  quarter: z.coerce.number().int().min(1).max(4),
  targetValueInr: requiredAmount
});

export const opportunityFilterSchema = z.object({
  q: optionalTrimmedString,
  ownerId: optionalTrimmedString,
  stageId: optionalTrimmedString,
  followUp: z.preprocess(emptyToUndefined, z.enum(["overdue", "today", "upcoming"]).optional()),
  view: z.preprocess(emptyToUndefined, z.enum(["list", "board"]).default("list"))
});
```

- [ ] **Step 4: Verify validators pass**

Run:

```powershell
npm run test -- src/server/opportunities/validators.test.ts
```

Expected:

```text
PASS src/server/opportunities/validators.test.ts
```

- [ ] **Step 5: Commit validators**

```powershell
git add src/server/opportunities/types.ts src/server/opportunities/validators.ts src/server/opportunities/validators.test.ts
git commit -m "feat: add opportunity validation contracts"
```

---

### Task 3: Query Layer

**Files:**
- Create: `src/server/opportunities/permissions.ts`
- Create: `src/server/opportunities/queries.ts`
- Create: `src/server/opportunities/queries.test.ts`

- [ ] **Step 1: Write failing query tests**

Create tests that prove Sales visibility is company-wide and explicit owner/stage filters only narrow results. Use dependency injection like `src/server/crm/queries.test.ts`.

Run:

```powershell
npm run test -- src/server/opportunities/queries.test.ts
```

Expected:

```text
Cannot find module './queries'
```

- [ ] **Step 2: Implement permissions and queries**

Create `src/server/opportunities/permissions.ts`:

```ts
import { canViewCompanyRecords } from "@/server/auth/permissions";

export type OpportunityUser = {
  id: string;
  role: "ADMIN" | "SALES";
};

export function assertCanViewOpportunities(user: OpportunityUser) {
  if (!canViewCompanyRecords(user.role)) {
    throw new Error("You do not have permission to view opportunities.");
  }
}

export function assertCanWriteOpportunities(user: OpportunityUser) {
  if (!canViewCompanyRecords(user.role)) {
    throw new Error("You do not have permission to manage opportunities.");
  }
}
```

Create `queries.ts` with:

- `listOpportunities(user, filters, database = db)`
- `listPipelineBoard(user, filters, database = db)`
- `getOpportunityDetail(user, opportunityId)`
- `listOpportunityFormOptions()` returning leads, stages, owners
- `listSalesTargets(user, filters?)`

The list query must include lead/customer, branch, stage, owner, and splits. It must not add owner restriction unless `filters.ownerId` is present.

- [ ] **Step 3: Verify queries**

Run:

```powershell
npm run test -- src/server/opportunities/queries.test.ts
```

Expected:

```text
PASS src/server/opportunities/queries.test.ts
```

- [ ] **Step 4: Commit queries**

```powershell
git add src/server/opportunities/permissions.ts src/server/opportunities/queries.ts src/server/opportunities/queries.test.ts
git commit -m "feat: add opportunity query layer"
```

---

### Task 4: Mutation Services

**Files:**
- Create: `src/server/opportunities/mutations.ts`
- Create: `src/server/opportunities/mutations.test.ts`

- [ ] **Step 1: Write failing mutation tests**

Cover:

- Active Admin/Sales owner required.
- Existing lead/customer required.
- Optional branch must belong to selected lead/customer.
- Stage must exist and be active for create/update.
- Split percentages must total 100 when splits are supplied.
- Target upsert is unique by owner, financial year, and quarter.

Run:

```powershell
npm run test -- src/server/opportunities/mutations.test.ts
```

Expected:

```text
Cannot find module './mutations'
```

- [ ] **Step 2: Implement mutations**

Create service functions:

- `createOpportunity(user, input, splits, database = db)`
- `updateOpportunity(user, opportunityId, input, splits, database = db)`
- `moveOpportunityStage(user, opportunityId, stageId, database = db)`
- `upsertSalesTarget(user, input, database = db)`

Use `$transaction` for opportunity plus split writes.

- [ ] **Step 3: Verify mutations**

Run:

```powershell
npm run test -- src/server/opportunities/mutations.test.ts
```

Expected:

```text
PASS src/server/opportunities/mutations.test.ts
```

- [ ] **Step 4: Commit mutations**

```powershell
git add src/server/opportunities/mutations.ts src/server/opportunities/mutations.test.ts
git commit -m "feat: add opportunity mutation services"
```

---

### Task 5: Server Actions

**Files:**
- Create: `src/server/opportunities/actions.ts`
- Create: `src/server/opportunities/actions.test.ts`

- [ ] **Step 1: Write failing action tests**

Cover form parsing for opportunity, validation errors, target parsing, and stage parsing. Follow the exported parse helper pattern from `src/server/crm/actions.ts`.

Run:

```powershell
npm run test -- src/server/opportunities/actions.test.ts
```

Expected:

```text
Cannot find module './actions'
```

- [ ] **Step 2: Implement actions**

Create:

- `parseOpportunityFormForTest(formData)`
- `createOpportunityAction`
- `updateOpportunityAction`
- `moveOpportunityStageAction`
- `upsertSalesTargetAction`
- `upsertPipelineStageAction`

Each server action must call `requireUser()`, return field errors on validation failure, call the mutation service, revalidate `/opportunities`, and redirect to the correct opportunity or management route.

- [ ] **Step 3: Verify actions**

Run:

```powershell
npm run test -- src/server/opportunities/actions.test.ts
```

Expected:

```text
PASS src/server/opportunities/actions.test.ts
```

- [ ] **Step 4: Commit actions**

```powershell
git add src/server/opportunities/actions.ts src/server/opportunities/actions.test.ts
git commit -m "feat: add opportunity server actions"
```

---

### Task 6: Opportunity Routes And Components

**Files:**
- Create: `src/components/opportunities/opportunity-list.tsx`
- Create: `src/components/opportunities/opportunity-board.tsx`
- Create: `src/components/opportunities/opportunity-form.tsx`
- Create: `src/components/opportunities/stage-form.tsx`
- Create: `src/components/opportunities/target-form.tsx`
- Create routes under `src/app/(app)/opportunities/**`

- [ ] **Step 1: Write component tests**

Create focused component tests for list filtering links and board stage rendering if the implementation keeps components pure enough for Testing Library.

Run:

```powershell
npm run test -- src/components/opportunities
```

Expected:

```text
No matching files or failing missing component import
```

- [ ] **Step 2: Implement list and board components**

The list must show opportunity title, lead/customer, branch when present, stage, owner, estimated value, probability, next follow-up, and product interest.

The board must group opportunities by active stage sorted by `sortOrder`.

- [ ] **Step 3: Implement create/edit/detail/management routes**

Routes:

- `/opportunities`
- `/opportunities/new`
- `/opportunities/[opportunityId]`
- `/opportunities/[opportunityId]/edit`
- `/opportunities/stages`
- `/opportunities/targets`

Do not create proposal, order, product, payment, production, incentive, or report routes.

- [ ] **Step 4: Verify UI build**

Run:

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
```

Expected:

```text
all commands exit 0
```

- [ ] **Step 5: Commit UI**

```powershell
git add src/components/opportunities src/app/(app)/opportunities
git commit -m "feat: add opportunity pipeline UI"
```

---

### Task 7: Seed Data

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Seed stages and sample data**

Seed stable stage IDs:

- `seed_stage_lead`
- `seed_stage_qualified`
- `seed_stage_proposal_sent`
- `seed_stage_negotiation`
- `seed_stage_won`
- `seed_stage_lost`
- `seed_stage_dormant`

Seed one opportunity under `seed_lead_acme_learning` owned by Sales with one Admin/Sales split only if both seeded users exist.

- [ ] **Step 2: Run seed**

```powershell
npm run prisma:seed
```

Expected:

```text
tsx prisma/seed.ts exits 0
```

- [ ] **Step 3: Commit seed data**

```powershell
git add prisma/seed.ts
git commit -m "feat: seed opportunity pipeline data"
```

---

### Task 8: Browser Smoke And Final Verification

**Files:**
- Create: `tests/e2e/opportunities.spec.ts`

- [ ] **Step 1: Write Playwright smoke**

Cover:

- Admin signs in and creates an opportunity from Acme Learning.
- Admin switches `/opportunities` between list and board.
- Sales signs in and sees the Admin-created opportunity company-wide.
- Sales owner filtering narrows but does not authorize.
- Admin can view target setup route.

- [ ] **Step 2: Run targeted e2e**

```powershell
npm run test:e2e -- tests/e2e/opportunities.spec.ts
```

Expected:

```text
passed
```

- [ ] **Step 3: Run full verification**

```powershell
git status --short --branch
npx prisma validate
npm run prisma:generate
npm run test
npm run gate
npm run test:e2e
npm audit --audit-level=low
git diff --check
```

Expected:

- Branch is `feature/opportunities-pipeline`.
- Prisma validates and client generation succeeds.
- Unit/component tests pass.
- `npm run gate` exits 0.
- Auth, CRM Core, and opportunities browser smoke pass.
- Audit reports 0 vulnerabilities or only documented non-blocking advisories.
- `git diff --check` prints no errors.

- [ ] **Step 4: Final commit if hardening changed files**

```powershell
git add prisma src tests
git commit -m "fix: harden opportunities pipeline verification"
```

Skip this commit if final verification required no fixes.

## Handoff Notes

- Products/proposals remain blocked until this branch lands and opportunity IDs, won/lost semantics, and product-interest shape are stable.
- Orders remain blocked until proposals/products land.
- Reports can use opportunity read models only after this branch lands.
- CSV import should not write opportunities in this slice.

