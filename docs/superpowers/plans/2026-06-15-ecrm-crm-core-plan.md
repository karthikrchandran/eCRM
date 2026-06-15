# CRM Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the CRM core slice after foundation: leads/customers, branches, contacts, activities/follow-ups, ownership, reassignment history, and company-wide Sales visibility.

**Architecture:** Extend the existing modular monolith with a focused `crm` server module, Prisma models for customer records and their children, and App Router pages under `/leads`. Server actions handle writes after reusing Zod validation and service functions so unit tests can cover business behavior without rendering pages. Sales and Admin both keep company-wide visibility; owner assignment drives responsibility and filtering only.

**Tech Stack:** Next.js 16.2.9 App Router, React 19.2.7, TypeScript 6.0.3, Prisma 6.19.3, Postgres, Zod 4.4.3, Vitest 4.1.8, Testing Library, Playwright 1.60.0, Tailwind CSS 4.3.1.

---

## Scope Boundaries

This plan implements slice 2 from `docs/superpowers/specs/2026-06-15-ecrm-design.md`.

Included:

- Lead/customer records with state, industry, source, owner, and notes.
- Branch records attached to a lead/customer.
- Contact records attached to a lead/customer and optionally a branch.
- Activity and follow-up records for calls, emails, meetings, notes, and scheduled follow-ups.
- Owner assignment and reassignment audit history.
- Company-wide visibility for Sales and Admin.
- Filtering by owner, state, branch, and next follow-up date on `/leads`.

Excluded from this plan:

- Opportunities and pipeline stages.
- Proposals, Canva PDF metadata, products, and GST commercial summaries.
- Orders, production, invoices, payments, costs, incentives, and reports.
- CSV import.
- Destructive delete workflows.

## Current Foundation

The foundation status says the app already has:

- Next.js App Router with TypeScript, ESLint, Vitest, Playwright, and Tailwind.
- Prisma/Postgres with one existing model: `User`.
- `UserRole` enum with `ADMIN` and `SALES`.
- Seeded Admin and Sales users.
- Internal email/password login.
- Signed session cookie.
- `requireUser()` in `src/server/auth/current-user.ts`.
- Permission helpers in `src/server/auth/permissions.ts`.
- Protected app layout in `src/app/(app)/layout.tsx`.
- Dashboard at `/dashboard`.
- Existing nav item for `/leads` in `src/components/app-shell.tsx`.

Do not change the app into a multi-tenant system. Do not add new roles.

## CRM Core File Structure

Create or modify these files only when implementing this plan:

- Modify: `prisma/schema.prisma`
  Add CRM core enums and models, add relation fields to `User`, and keep the existing `User` fields intact.
- Modify: `prisma/seed.ts`
  Add deterministic sample leads, branches, contacts, activities, and one ownership reassignment for local smoke tests.
- Create: `src/server/crm/types.ts`
  Define shared CRM payload/result types used by validators, services, actions, and tests.
- Create: `src/server/crm/validators.ts`
  Define Zod schemas and normalizers for lead/customer, branch, contact, activity, filters, and reassignment forms.
- Create: `src/server/crm/validators.test.ts`
  Cover required fields, normalization, date validation, duplicate-safe optional fields, and follow-up rules.
- Create: `src/server/crm/permissions.ts`
  Define CRM-specific role assertions that reuse `canViewCompanyRecords()`.
- Create: `src/server/crm/queries.ts`
  Define read functions for lead list, lead detail, owner options, branch options, and dashboard follow-up counts.
- Create: `src/server/crm/queries.test.ts`
  Cover company-wide visibility and owner filtering with mocked repository dependencies.
- Create: `src/server/crm/mutations.ts`
  Define service-level create/update/reassign functions with dependency injection for tests.
- Create: `src/server/crm/mutations.test.ts`
  Cover owner rules, branch/contact attachment rules, follow-up completion, and reassignment audit behavior.
- Create: `src/server/crm/actions.ts`
  Define server actions that call validators and mutations, then revalidate `/leads` and `/leads/[leadId]`.
- Create: `src/server/crm/actions.test.ts`
  Cover server action form parsing and returned validation errors with mocked service dependencies.
- Create: `src/components/crm/lead-list.tsx`
  Render dense searchable/filterable lead rows for `/leads`.
- Create: `src/components/crm/lead-form.tsx`
  Render create/edit fields for lead/customer records.
- Create: `src/components/crm/branch-form.tsx`
  Render branch create/edit fields.
- Create: `src/components/crm/contact-form.tsx`
  Render contact create/edit fields.
- Create: `src/components/crm/activity-form.tsx`
  Render activity/follow-up create fields and completion controls.
- Create: `src/components/crm/reassign-owner-form.tsx`
  Render owner reassignment controls and reason field.
- Create: `src/app/(app)/leads/page.tsx`
  Company-wide CRM core list route with filters.
- Create: `src/app/(app)/leads/new/page.tsx`
  Lead/customer creation route.
- Create: `src/app/(app)/leads/[leadId]/page.tsx`
  Lead detail route with branches, contacts, activities, and reassignment history.
- Create: `src/app/(app)/leads/[leadId]/edit/page.tsx`
  Lead/customer edit route.
- Create: `src/app/(app)/leads/[leadId]/branches/new/page.tsx`
  Branch creation route for a lead/customer.
- Create: `src/app/(app)/leads/[leadId]/contacts/new/page.tsx`
  Contact creation route for a lead/customer.
- Create: `src/app/(app)/leads/[leadId]/activities/new/page.tsx`
  Activity/follow-up creation route for a lead/customer.
- Create: `tests/e2e/crm-core.spec.ts`
  Browser smoke tests for Admin creation, Sales company-wide visibility, follow-up display, and reassignment.

---

### Task 1: Prisma CRM Core Schema

**Files:**

- Modify: `prisma/schema.prisma`
- Test through command: `npx prisma validate`

- [ ] **Step 1: Add the CRM core enums and model relations to `prisma/schema.prisma`**

Add these enums after `UserRole`:

```prisma
enum LeadState {
  LEAD
  CUSTOMER
  DORMANT
}

enum ActivityType {
  CALL
  EMAIL
  MEETING
  NOTE
  FOLLOW_UP
}

enum ActivityStatus {
  OPEN
  COMPLETED
  CANCELLED
}
```

Replace the existing `User` model with this version, preserving the existing fields:

```prisma
model User {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  passwordHash String
  role         UserRole @default(SALES)
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  ownedLeadCustomers       LeadCustomer[]          @relation("LeadOwner")
  createdLeadCustomers     LeadCustomer[]          @relation("LeadCreatedBy")
  updatedLeadCustomers     LeadCustomer[]          @relation("LeadUpdatedBy")
  ownedActivities          Activity[]              @relation("ActivityOwner")
  createdActivities        Activity[]              @relation("ActivityCreatedBy")
  completedActivities      Activity[]              @relation("ActivityCompletedBy")
  ownershipChangesFrom     LeadOwnershipHistory[]  @relation("LeadOwnershipFrom")
  ownershipChangesTo       LeadOwnershipHistory[]  @relation("LeadOwnershipTo")
  ownershipChangesChanged  LeadOwnershipHistory[]  @relation("LeadOwnershipChangedBy")
}
```

Add these models after `User`:

```prisma
model LeadCustomer {
  id          String    @id @default(cuid())
  name        String
  state       LeadState @default(LEAD)
  industry    String?
  source      String?
  ownerId     String
  notes       String?
  createdById String
  updatedById String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  owner      User @relation("LeadOwner", fields: [ownerId], references: [id])
  createdBy  User @relation("LeadCreatedBy", fields: [createdById], references: [id])
  updatedBy  User @relation("LeadUpdatedBy", fields: [updatedById], references: [id])
  branches   Branch[]
  contacts   Contact[]
  activities Activity[]
  ownershipHistory LeadOwnershipHistory[]

  @@index([ownerId])
  @@index([state])
  @@index([name])
  @@index([createdAt])
}

model Branch {
  id             String   @id @default(cuid())
  leadCustomerId String
  name           String
  addressLine1   String?
  addressLine2   String?
  city           String?
  region         String?
  postalCode     String?
  country        String   @default("India")
  gstin          String?
  locationHint   String?
  salesContext   String?
  notes          String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  leadCustomer LeadCustomer @relation(fields: [leadCustomerId], references: [id], onDelete: Cascade)
  contacts     Contact[]
  activities   Activity[]

  @@index([leadCustomerId])
  @@index([city])
}

model Contact {
  id             String   @id @default(cuid())
  leadCustomerId String
  branchId       String?
  name           String
  designation    String?
  email          String?
  phone          String?
  isPrimary      Boolean  @default(false)
  notes          String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  leadCustomer LeadCustomer @relation(fields: [leadCustomerId], references: [id], onDelete: Cascade)
  branch       Branch?      @relation(fields: [branchId], references: [id], onDelete: SetNull)
  activities   Activity[]

  @@index([leadCustomerId])
  @@index([branchId])
  @@index([email])
  @@index([phone])
}

model Activity {
  id             String         @id @default(cuid())
  leadCustomerId String
  branchId       String?
  contactId      String?
  ownerId        String
  createdById    String
  completedById  String?
  type           ActivityType
  status         ActivityStatus @default(OPEN)
  subject        String
  body           String?
  occurredAt     DateTime?
  dueAt          DateTime?
  completedAt    DateTime?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  leadCustomer LeadCustomer @relation(fields: [leadCustomerId], references: [id], onDelete: Cascade)
  branch       Branch?      @relation(fields: [branchId], references: [id], onDelete: SetNull)
  contact      Contact?     @relation(fields: [contactId], references: [id], onDelete: SetNull)
  owner        User         @relation("ActivityOwner", fields: [ownerId], references: [id])
  createdBy    User         @relation("ActivityCreatedBy", fields: [createdById], references: [id])
  completedBy  User?        @relation("ActivityCompletedBy", fields: [completedById], references: [id])

  @@index([leadCustomerId])
  @@index([ownerId])
  @@index([status])
  @@index([dueAt])
  @@index([type])
}

model LeadOwnershipHistory {
  id             String   @id @default(cuid())
  leadCustomerId String
  fromOwnerId    String?
  toOwnerId      String
  changedById    String
  reason         String
  createdAt      DateTime @default(now())

  leadCustomer LeadCustomer @relation(fields: [leadCustomerId], references: [id], onDelete: Cascade)
  fromOwner    User?        @relation("LeadOwnershipFrom", fields: [fromOwnerId], references: [id])
  toOwner      User         @relation("LeadOwnershipTo", fields: [toOwnerId], references: [id])
  changedBy    User         @relation("LeadOwnershipChangedBy", fields: [changedById], references: [id])

  @@index([leadCustomerId])
  @@index([toOwnerId])
  @@index([createdAt])
}
```

- [ ] **Step 2: Validate the Prisma schema**

Run:

```powershell
npx prisma validate
```

Expected:

```text
The schema at prisma\schema.prisma is valid
```

- [ ] **Step 3: Create and apply the migration**

Run:

```powershell
npm run prisma:migrate -- --name add_crm_core
```

Expected:

```text
Applying migration `..._add_crm_core`
Your database is now in sync with your schema.
```

- [ ] **Step 4: Regenerate Prisma client**

Run:

```powershell
npm run prisma:generate
```

Expected:

```text
Generated Prisma Client
```

- [ ] **Step 5: Commit schema changes**

Run:

```powershell
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add crm core schema"
```

Expected:

```text
[feature/crm-core ...] feat: add crm core schema
```

---

### Task 2: CRM Validation Contracts

**Files:**

- Create: `src/server/crm/types.ts`
- Create: `src/server/crm/validators.ts`
- Create: `src/server/crm/validators.test.ts`

- [ ] **Step 1: Write failing validation tests**

Create `src/server/crm/validators.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  activityInputSchema,
  branchInputSchema,
  contactInputSchema,
  leadCustomerInputSchema,
  leadFilterSchema,
  reassignmentInputSchema
} from "./validators";

describe("crm validators", () => {
  it("normalizes lead/customer input", () => {
    const parsed = leadCustomerInputSchema.parse({
      name: "  Acme Learning Pvt Ltd  ",
      state: "CUSTOMER",
      industry: "  eLearning  ",
      source: " Referral ",
      ownerId: "user_sales",
      notes: "  Repeat customer  "
    });

    expect(parsed).toEqual({
      name: "Acme Learning Pvt Ltd",
      state: "CUSTOMER",
      industry: "eLearning",
      source: "Referral",
      ownerId: "user_sales",
      notes: "Repeat customer"
    });
  });

  it("requires a lead/customer name and owner", () => {
    const result = leadCustomerInputSchema.safeParse({
      name: " ",
      state: "LEAD",
      ownerId: ""
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain("Enter a lead or customer name.");
      expect(result.error.flatten().fieldErrors.ownerId).toContain("Choose an owner.");
    }
  });

  it("validates branch and contact attachment input", () => {
    expect(
      branchInputSchema.parse({
        leadCustomerId: "lead_1",
        name: " Bengaluru Branch ",
        city: " Bengaluru ",
        country: ""
      })
    ).toMatchObject({
      leadCustomerId: "lead_1",
      name: "Bengaluru Branch",
      city: "Bengaluru",
      country: "India"
    });

    expect(
      contactInputSchema.parse({
        leadCustomerId: "lead_1",
        branchId: "branch_1",
        name: " Anita Rao ",
        email: " ANITA@EXAMPLE.COM ",
        phone: " +91 98765 43210 ",
        isPrimary: "on"
      })
    ).toMatchObject({
      name: "Anita Rao",
      email: "anita@example.com",
      phone: "+91 98765 43210",
      isPrimary: true
    });
  });

  it("requires activity due date for open follow-ups", () => {
    const result = activityInputSchema.safeParse({
      leadCustomerId: "lead_1",
      ownerId: "user_sales",
      type: "FOLLOW_UP",
      status: "OPEN",
      subject: "Send revised brochure"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.dueAt).toContain("Choose a follow-up date.");
    }
  });

  it("accepts list filters without hiding company records by role", () => {
    const parsed = leadFilterSchema.parse({
      q: " acme ",
      ownerId: "user_sales",
      state: "LEAD",
      followUp: "overdue"
    });

    expect(parsed).toEqual({
      q: "acme",
      ownerId: "user_sales",
      state: "LEAD",
      followUp: "overdue"
    });
  });

  it("requires reassignment reason when owner changes", () => {
    const result = reassignmentInputSchema.safeParse({
      leadCustomerId: "lead_1",
      toOwnerId: "user_admin",
      reason: " "
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.reason).toContain("Enter a reassignment reason.");
    }
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail because validators do not exist**

Run:

```powershell
npm run test -- src/server/crm/validators.test.ts
```

Expected:

```text
FAIL  src/server/crm/validators.test.ts
Cannot find module './validators'
```

- [ ] **Step 3: Create `src/server/crm/types.ts`**

```ts
import type { ActivityStatus, ActivityType, LeadState } from "@prisma/client";

export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export type LeadCustomerInput = {
  name: string;
  state: LeadState;
  industry?: string;
  source?: string;
  ownerId: string;
  notes?: string;
};

export type BranchInput = {
  leadCustomerId: string;
  name: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country: string;
  gstin?: string;
  locationHint?: string;
  salesContext?: string;
  notes?: string;
};

export type ContactInput = {
  leadCustomerId: string;
  branchId?: string;
  name: string;
  designation?: string;
  email?: string;
  phone?: string;
  isPrimary: boolean;
  notes?: string;
};

export type ActivityInput = {
  leadCustomerId: string;
  branchId?: string;
  contactId?: string;
  ownerId: string;
  type: ActivityType;
  status: ActivityStatus;
  subject: string;
  body?: string;
  occurredAt?: Date;
  dueAt?: Date;
};

export type LeadFilters = {
  q?: string;
  ownerId?: string;
  state?: LeadState;
  followUp?: "overdue" | "today" | "upcoming";
};

export type ReassignmentInput = {
  leadCustomerId: string;
  toOwnerId: string;
  reason: string;
};
```

- [ ] **Step 4: Create `src/server/crm/validators.ts`**

```ts
import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const requiredTrimmedString = (message: string) =>
  z
    .string({ error: message })
    .trim()
    .min(1, message);

const optionalTrimmedString = z.preprocess(emptyToUndefined, z.string().trim().optional());

const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.string().trim().toLowerCase().email("Enter a valid email address.").optional()
);

const optionalDate = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return new Date(trimmed);
}, z.date("Enter a valid date.").optional());

const checkboxBoolean = z.preprocess((value) => value === true || value === "on", z.boolean());

export const leadCustomerInputSchema = z.object({
  name: requiredTrimmedString("Enter a lead or customer name."),
  state: z.enum(["LEAD", "CUSTOMER", "DORMANT"]).default("LEAD"),
  industry: optionalTrimmedString,
  source: optionalTrimmedString,
  ownerId: requiredTrimmedString("Choose an owner."),
  notes: optionalTrimmedString
});

export const branchInputSchema = z.object({
  leadCustomerId: requiredTrimmedString("Choose a lead or customer."),
  name: requiredTrimmedString("Enter a branch name."),
  addressLine1: optionalTrimmedString,
  addressLine2: optionalTrimmedString,
  city: optionalTrimmedString,
  region: optionalTrimmedString,
  postalCode: optionalTrimmedString,
  country: z.preprocess((value) => {
    if (typeof value !== "string" || value.trim().length === 0) {
      return "India";
    }
    return value.trim();
  }, z.string().min(1)),
  gstin: optionalTrimmedString,
  locationHint: optionalTrimmedString,
  salesContext: optionalTrimmedString,
  notes: optionalTrimmedString
});

export const contactInputSchema = z.object({
  leadCustomerId: requiredTrimmedString("Choose a lead or customer."),
  branchId: optionalTrimmedString,
  name: requiredTrimmedString("Enter a contact name."),
  designation: optionalTrimmedString,
  email: optionalEmail,
  phone: optionalTrimmedString,
  isPrimary: checkboxBoolean.default(false),
  notes: optionalTrimmedString
});

export const activityInputSchema = z
  .object({
    leadCustomerId: requiredTrimmedString("Choose a lead or customer."),
    branchId: optionalTrimmedString,
    contactId: optionalTrimmedString,
    ownerId: requiredTrimmedString("Choose an owner."),
    type: z.enum(["CALL", "EMAIL", "MEETING", "NOTE", "FOLLOW_UP"]),
    status: z.enum(["OPEN", "COMPLETED", "CANCELLED"]).default("OPEN"),
    subject: requiredTrimmedString("Enter an activity subject."),
    body: optionalTrimmedString,
    occurredAt: optionalDate,
    dueAt: optionalDate
  })
  .superRefine((value, context) => {
    if (value.type === "FOLLOW_UP" && value.status === "OPEN" && !value.dueAt) {
      context.addIssue({
        code: "custom",
        path: ["dueAt"],
        message: "Choose a follow-up date."
      });
    }
  });

export const leadFilterSchema = z.object({
  q: optionalTrimmedString,
  ownerId: optionalTrimmedString,
  state: z.enum(["LEAD", "CUSTOMER", "DORMANT"]).optional(),
  followUp: z.enum(["overdue", "today", "upcoming"]).optional()
});

export const reassignmentInputSchema = z.object({
  leadCustomerId: requiredTrimmedString("Choose a lead or customer."),
  toOwnerId: requiredTrimmedString("Choose the new owner."),
  reason: requiredTrimmedString("Enter a reassignment reason.")
});
```

- [ ] **Step 5: Run validation tests and commit**

Run:

```powershell
npm run test -- src/server/crm/validators.test.ts
```

Expected:

```text
PASS  src/server/crm/validators.test.ts
```

Commit:

```powershell
git add src/server/crm/types.ts src/server/crm/validators.ts src/server/crm/validators.test.ts
git commit -m "feat: add crm validation contracts"
```

---

### Task 3: CRM Permissions, Queries, and Company-Wide Visibility

**Files:**

- Create: `src/server/crm/permissions.ts`
- Create: `src/server/crm/queries.ts`
- Create: `src/server/crm/queries.test.ts`

- [ ] **Step 1: Write failing query tests**

Create `src/server/crm/queries.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { listLeadCustomers } from "./queries";

const requester = {
  id: "user_sales",
  name: "Sales User",
  email: "sales@example.com",
  role: "SALES" as const,
  active: true
};

describe("crm queries", () => {
  it("does not restrict Sales visibility to owned leads", async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    await listLeadCustomers(
      requester,
      {},
      {
        leadCustomer: {
          findMany,
          count: vi.fn().mockResolvedValue(0)
        },
        user: {
          findMany: vi.fn().mockResolvedValue([])
        }
      }
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {}
      })
    );
  });

  it("applies explicit owner filters only when the user asks for them", async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    await listLeadCustomers(
      requester,
      { ownerId: "user_admin", state: "LEAD", q: "acme" },
      {
        leadCustomer: {
          findMany,
          count: vi.fn().mockResolvedValue(0)
        },
        user: {
          findMany: vi.fn().mockResolvedValue([])
        }
      }
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ownerId: "user_admin",
          state: "LEAD",
          OR: [
            { name: { contains: "acme", mode: "insensitive" } },
            { industry: { contains: "acme", mode: "insensitive" } },
            { source: { contains: "acme", mode: "insensitive" } },
            { contacts: { some: { name: { contains: "acme", mode: "insensitive" } } } },
            { branches: { some: { name: { contains: "acme", mode: "insensitive" } } } }
          ]
        }
      })
    );
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail because queries do not exist**

Run:

```powershell
npm run test -- src/server/crm/queries.test.ts
```

Expected:

```text
FAIL  src/server/crm/queries.test.ts
Cannot find module './queries'
```

- [ ] **Step 3: Create `src/server/crm/permissions.ts`**

```ts
import type { UserRole } from "@prisma/client";
import { canViewCompanyRecords } from "@/server/auth/permissions";

export type CrmUser = {
  id: string;
  role: UserRole;
};

export function assertCanViewCrmRecords(user: CrmUser) {
  if (!canViewCompanyRecords(user.role)) {
    throw new Error("You do not have access to CRM records.");
  }
}

export function assertCanWriteCrmRecords(user: CrmUser) {
  if (user.role !== "ADMIN" && user.role !== "SALES") {
    throw new Error("You do not have permission to change CRM records.");
  }
}
```

- [ ] **Step 4: Create `src/server/crm/queries.ts`**

```ts
import type { Prisma, User } from "@prisma/client";
import { db } from "@/server/db";
import { assertCanViewCrmRecords, type CrmUser } from "./permissions";
import type { LeadFilters } from "./types";

type QueryDb = Pick<typeof db, "leadCustomer" | "user">;

function buildLeadWhere(filters: LeadFilters): Prisma.LeadCustomerWhereInput {
  const where: Prisma.LeadCustomerWhereInput = {};

  if (filters.ownerId) {
    where.ownerId = filters.ownerId;
  }

  if (filters.state) {
    where.state = filters.state;
  }

  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { industry: { contains: filters.q, mode: "insensitive" } },
      { source: { contains: filters.q, mode: "insensitive" } },
      { contacts: { some: { name: { contains: filters.q, mode: "insensitive" } } } },
      { branches: { some: { name: { contains: filters.q, mode: "insensitive" } } } }
    ];
  }

  if (filters.followUp) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    where.activities = {
      some: {
        status: "OPEN",
        dueAt:
          filters.followUp === "overdue"
            ? { lt: startOfToday }
            : filters.followUp === "today"
              ? { gte: startOfToday, lt: startOfTomorrow }
              : { gte: startOfTomorrow }
      }
    };
  }

  return where;
}

export async function listLeadCustomers(user: CrmUser, filters: LeadFilters, database: QueryDb = db) {
  assertCanViewCrmRecords(user);
  const where = buildLeadWhere(filters);

  const [records, owners] = await Promise.all([
    database.leadCustomer.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      include: {
        owner: { select: { id: true, name: true, email: true, role: true } },
        branches: { orderBy: { name: "asc" }, take: 3 },
        contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }], take: 3 },
        activities: {
          where: { status: "OPEN", dueAt: { not: null } },
          orderBy: { dueAt: "asc" },
          take: 1
        },
        _count: { select: { branches: true, contacts: true, activities: true } }
      }
    }),
    database.user.findMany({
      where: { active: true, role: { in: ["ADMIN", "SALES"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true }
    })
  ]);

  return { records, owners };
}

export async function getLeadCustomerDetail(user: CrmUser, leadCustomerId: string) {
  assertCanViewCrmRecords(user);

  return db.leadCustomer.findUnique({
    where: { id: leadCustomerId },
    include: {
      owner: { select: { id: true, name: true, email: true, role: true } },
      branches: { orderBy: { name: "asc" } },
      contacts: {
        orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
        include: { branch: { select: { id: true, name: true, city: true } } }
      },
      activities: {
        orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
        include: {
          owner: { select: { id: true, name: true } },
          contact: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } }
        }
      },
      ownershipHistory: {
        orderBy: { createdAt: "desc" },
        include: {
          fromOwner: { select: { id: true, name: true } },
          toOwner: { select: { id: true, name: true } },
          changedBy: { select: { id: true, name: true } }
        }
      }
    }
  });
}

export async function listCrmOwners(): Promise<Pick<User, "id" | "name" | "email" | "role">[]> {
  return db.user.findMany({
    where: { active: true, role: { in: ["ADMIN", "SALES"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true }
  });
}
```

- [ ] **Step 5: Run query tests and commit**

Run:

```powershell
npm run test -- src/server/crm/queries.test.ts
```

Expected:

```text
PASS  src/server/crm/queries.test.ts
```

Commit:

```powershell
git add src/server/crm/permissions.ts src/server/crm/queries.ts src/server/crm/queries.test.ts
git commit -m "feat: add crm query layer"
```

---

### Task 4: CRM Mutations and Reassignment Audit

**Files:**

- Create: `src/server/crm/mutations.ts`
- Create: `src/server/crm/mutations.test.ts`

- [ ] **Step 1: Write failing mutation tests**

Create `src/server/crm/mutations.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  completeActivity,
  createActivity,
  createBranch,
  createContact,
  createLeadCustomer,
  reassignLeadOwner
} from "./mutations";

const actor = { id: "user_sales", role: "SALES" as const };

describe("crm mutations", () => {
  it("creates a lead/customer with created and updated actor metadata", async () => {
    const create = vi.fn().mockResolvedValue({ id: "lead_1" });

    await createLeadCustomer(
      actor,
      {
        name: "Acme Learning Pvt Ltd",
        state: "LEAD",
        ownerId: "user_sales",
        industry: "Education",
        source: "Referral"
      },
      {
        leadCustomer: { create },
        user: { findFirst: vi.fn().mockResolvedValue({ id: "user_sales" }) }
      }
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        name: "Acme Learning Pvt Ltd",
        state: "LEAD",
        ownerId: "user_sales",
        industry: "Education",
        source: "Referral",
        notes: undefined,
        createdById: "user_sales",
        updatedById: "user_sales"
      }
    });
  });

  it("creates child records under an existing lead/customer", async () => {
    const branchCreate = vi.fn().mockResolvedValue({ id: "branch_1" });
    const contactCreate = vi.fn().mockResolvedValue({ id: "contact_1" });
    const findLead = vi.fn().mockResolvedValue({ id: "lead_1" });

    await createBranch(
      actor,
      { leadCustomerId: "lead_1", name: "Bengaluru Branch", country: "India" },
      {
        leadCustomer: { findUnique: findLead },
        branch: { create: branchCreate }
      }
    );

    await createContact(
      actor,
      {
        leadCustomerId: "lead_1",
        branchId: "branch_1",
        name: "Anita Rao",
        email: "anita@example.com",
        isPrimary: true
      },
      {
        leadCustomer: { findUnique: findLead },
        branch: { findFirst: vi.fn().mockResolvedValue({ id: "branch_1" }) },
        contact: { create: contactCreate }
      }
    );

    expect(branchCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ leadCustomerId: "lead_1" }) }));
    expect(contactCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ branchId: "branch_1" }) }));
  });

  it("creates an open follow-up activity owned by the selected salesperson", async () => {
    const create = vi.fn().mockResolvedValue({ id: "activity_1" });
    const dueAt = new Date("2026-06-20T10:00:00.000Z");

    await createActivity(
      actor,
      {
        leadCustomerId: "lead_1",
        ownerId: "user_admin",
        type: "FOLLOW_UP",
        status: "OPEN",
        subject: "Call procurement team",
        dueAt
      },
      {
        leadCustomer: { findUnique: vi.fn().mockResolvedValue({ id: "lead_1" }) },
        user: { findFirst: vi.fn().mockResolvedValue({ id: "user_admin" }) },
        activity: { create }
      }
    );

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: "user_admin",
        createdById: "user_sales",
        status: "OPEN",
        dueAt
      })
    });
  });

  it("marks an activity complete with completion metadata", async () => {
    const update = vi.fn().mockResolvedValue({ id: "activity_1", status: "COMPLETED" });

    await completeActivity(actor, "activity_1", {
      activity: {
        findUnique: vi.fn().mockResolvedValue({ id: "activity_1" }),
        update
      }
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: "activity_1" },
      data: {
        status: "COMPLETED",
        completedAt: expect.any(Date),
        completedById: "user_sales"
      }
    });
  });

  it("reassigns ownership and writes audit history in one transaction", async () => {
    const update = vi.fn().mockResolvedValue({ id: "lead_1", ownerId: "user_admin" });
    const createHistory = vi.fn().mockResolvedValue({ id: "history_1" });

    await reassignLeadOwner(
      actor,
      {
        leadCustomerId: "lead_1",
        toOwnerId: "user_admin",
        reason: "Account handoff after territory review"
      },
      {
        leadCustomer: {
          findUnique: vi.fn().mockResolvedValue({ id: "lead_1", ownerId: "user_sales" }),
          update
        },
        user: { findFirst: vi.fn().mockResolvedValue({ id: "user_admin" }) },
        leadOwnershipHistory: { create: createHistory },
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            leadCustomer: { update },
            leadOwnershipHistory: { create: createHistory }
          })
      }
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: "lead_1" },
      data: { ownerId: "user_admin", updatedById: "user_sales" }
    });
    expect(createHistory).toHaveBeenCalledWith({
      data: {
        leadCustomerId: "lead_1",
        fromOwnerId: "user_sales",
        toOwnerId: "user_admin",
        changedById: "user_sales",
        reason: "Account handoff after territory review"
      }
    });
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail because mutations do not exist**

Run:

```powershell
npm run test -- src/server/crm/mutations.test.ts
```

Expected:

```text
FAIL  src/server/crm/mutations.test.ts
Cannot find module './mutations'
```

- [ ] **Step 3: Create `src/server/crm/mutations.ts`**

Implement these exported functions:

```ts
import { db } from "@/server/db";
import { assertCanWriteCrmRecords, type CrmUser } from "./permissions";
import type { ActivityInput, BranchInput, ContactInput, LeadCustomerInput, ReassignmentInput } from "./types";

type MutationDb = typeof db;

async function assertActiveOwner(database: Pick<MutationDb, "user">, ownerId: string) {
  const owner = await database.user.findFirst({
    where: { id: ownerId, active: true, role: { in: ["ADMIN", "SALES"] } },
    select: { id: true }
  });

  if (!owner) {
    throw new Error("Choose an active Admin or Sales owner.");
  }
}

async function assertLeadExists(database: Pick<MutationDb, "leadCustomer">, leadCustomerId: string) {
  const lead = await database.leadCustomer.findUnique({
    where: { id: leadCustomerId },
    select: { id: true }
  });

  if (!lead) {
    throw new Error("Lead or customer was not found.");
  }
}

export async function createLeadCustomer(user: CrmUser, input: LeadCustomerInput, database: MutationDb = db) {
  assertCanWriteCrmRecords(user);
  await assertActiveOwner(database, input.ownerId);

  return database.leadCustomer.create({
    data: {
      name: input.name,
      state: input.state,
      industry: input.industry,
      source: input.source,
      ownerId: input.ownerId,
      notes: input.notes,
      createdById: user.id,
      updatedById: user.id
    }
  });
}

export async function updateLeadCustomer(
  user: CrmUser,
  leadCustomerId: string,
  input: LeadCustomerInput,
  database: MutationDb = db
) {
  assertCanWriteCrmRecords(user);
  await assertLeadExists(database, leadCustomerId);
  await assertActiveOwner(database, input.ownerId);

  return database.leadCustomer.update({
    where: { id: leadCustomerId },
    data: {
      name: input.name,
      state: input.state,
      industry: input.industry,
      source: input.source,
      ownerId: input.ownerId,
      notes: input.notes,
      updatedById: user.id
    }
  });
}

export async function createBranch(user: CrmUser, input: BranchInput, database: MutationDb = db) {
  assertCanWriteCrmRecords(user);
  await assertLeadExists(database, input.leadCustomerId);

  return database.branch.create({ data: input });
}

export async function createContact(user: CrmUser, input: ContactInput, database: MutationDb = db) {
  assertCanWriteCrmRecords(user);
  await assertLeadExists(database, input.leadCustomerId);

  if (input.branchId) {
    const branch = await database.branch.findFirst({
      where: { id: input.branchId, leadCustomerId: input.leadCustomerId },
      select: { id: true }
    });

    if (!branch) {
      throw new Error("Choose a branch that belongs to this lead or customer.");
    }
  }

  return database.contact.create({ data: input });
}

export async function createActivity(user: CrmUser, input: ActivityInput, database: MutationDb = db) {
  assertCanWriteCrmRecords(user);
  await assertLeadExists(database, input.leadCustomerId);
  await assertActiveOwner(database, input.ownerId);

  return database.activity.create({
    data: {
      ...input,
      createdById: user.id
    }
  });
}

export async function completeActivity(user: CrmUser, activityId: string, database: MutationDb = db) {
  assertCanWriteCrmRecords(user);
  const activity = await database.activity.findUnique({
    where: { id: activityId },
    select: { id: true }
  });

  if (!activity) {
    throw new Error("Activity was not found.");
  }

  return database.activity.update({
    where: { id: activityId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      completedById: user.id
    }
  });
}

export async function reassignLeadOwner(user: CrmUser, input: ReassignmentInput, database: MutationDb = db) {
  assertCanWriteCrmRecords(user);
  await assertActiveOwner(database, input.toOwnerId);

  const lead = await database.leadCustomer.findUnique({
    where: { id: input.leadCustomerId },
    select: { id: true, ownerId: true }
  });

  if (!lead) {
    throw new Error("Lead or customer was not found.");
  }

  if (lead.ownerId === input.toOwnerId) {
    throw new Error("Choose a different owner for reassignment.");
  }

  return database.$transaction(async (tx) => {
    const updated = await tx.leadCustomer.update({
      where: { id: input.leadCustomerId },
      data: { ownerId: input.toOwnerId, updatedById: user.id }
    });

    await tx.leadOwnershipHistory.create({
      data: {
        leadCustomerId: input.leadCustomerId,
        fromOwnerId: lead.ownerId,
        toOwnerId: input.toOwnerId,
        changedById: user.id,
        reason: input.reason
      }
    });

    return updated;
  });
}
```

- [ ] **Step 4: Run mutation tests and commit**

Run:

```powershell
npm run test -- src/server/crm/mutations.test.ts
```

Expected:

```text
PASS  src/server/crm/mutations.test.ts
```

Commit:

```powershell
git add src/server/crm/mutations.ts src/server/crm/mutations.test.ts
git commit -m "feat: add crm mutation services"
```

---

### Task 5: CRM Server Actions

**Files:**

- Create: `src/server/crm/actions.ts`
- Create: `src/server/crm/actions.test.ts`

- [ ] **Step 1: Write failing action tests**

Create `src/server/crm/actions.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { parseLeadCustomerFormForTest } from "./actions";

describe("crm actions", () => {
  it("returns field errors from lead form parsing", () => {
    const formData = new FormData();
    formData.set("name", "");
    formData.set("state", "LEAD");
    formData.set("ownerId", "");

    const result = parseLeadCustomerFormForTest(formData);

    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        name: ["Enter a lead or customer name."],
        ownerId: ["Choose an owner."]
      }
    });
  });

  it("parses valid lead form data", () => {
    const formData = new FormData();
    formData.set("name", "Acme Learning Pvt Ltd");
    formData.set("state", "LEAD");
    formData.set("ownerId", "user_sales");
    formData.set("source", "Referral");

    const result = parseLeadCustomerFormForTest(formData);

    expect(result).toEqual({
      ok: true,
      data: {
        name: "Acme Learning Pvt Ltd",
        state: "LEAD",
        ownerId: "user_sales",
        source: "Referral"
      }
    });
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail because actions do not exist**

Run:

```powershell
npm run test -- src/server/crm/actions.test.ts
```

Expected:

```text
FAIL  src/server/crm/actions.test.ts
Cannot find module './actions'
```

- [ ] **Step 3: Create `src/server/crm/actions.ts`**

Export these server action names:

- `createLeadCustomerAction`
- `updateLeadCustomerAction`
- `createBranchAction`
- `createContactAction`
- `createActivityAction`
- `completeActivityAction`
- `reassignLeadOwnerAction`
- `parseLeadCustomerFormForTest`

Use this structure:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import type { ActionState } from "./types";
import {
  activityInputSchema,
  branchInputSchema,
  contactInputSchema,
  leadCustomerInputSchema,
  reassignmentInputSchema
} from "./validators";
import {
  completeActivity,
  createActivity,
  createBranch,
  createContact,
  createLeadCustomer,
  reassignLeadOwner,
  updateLeadCustomer
} from "./mutations";

function fieldErrorState(error: { flatten: () => { fieldErrors: Record<string, string[]> } }): ActionState {
  return { ok: false, fieldErrors: error.flatten().fieldErrors };
}

export function parseLeadCustomerFormForTest(formData: FormData) {
  const result = leadCustomerInputSchema.safeParse({
    name: formData.get("name"),
    state: formData.get("state"),
    industry: formData.get("industry"),
    source: formData.get("source"),
    ownerId: formData.get("ownerId"),
    notes: formData.get("notes")
  });

  if (!result.success) {
    return fieldErrorState(result.error);
  }

  return { ok: true, data: result.data };
}

export async function createLeadCustomerAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseLeadCustomerFormForTest(formData);

  if (!parsed.ok) {
    return parsed;
  }

  const record = await createLeadCustomer(user, parsed.data);
  revalidatePath("/leads");
  redirect(`/leads/${record.id}`);
}

export async function updateLeadCustomerAction(
  leadCustomerId: string,
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseLeadCustomerFormForTest(formData);

  if (!parsed.ok) {
    return parsed;
  }

  await updateLeadCustomer(user, leadCustomerId, parsed.data);
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadCustomerId}`);
  redirect(`/leads/${leadCustomerId}`);
}

export async function createBranchAction(
  leadCustomerId: string,
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const result = branchInputSchema.safeParse({
    leadCustomerId,
    name: formData.get("name"),
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2"),
    city: formData.get("city"),
    region: formData.get("region"),
    postalCode: formData.get("postalCode"),
    country: formData.get("country"),
    gstin: formData.get("gstin"),
    locationHint: formData.get("locationHint"),
    salesContext: formData.get("salesContext"),
    notes: formData.get("notes")
  });

  if (!result.success) {
    return fieldErrorState(result.error);
  }

  await createBranch(user, result.data);
  revalidatePath(`/leads/${leadCustomerId}`);
  redirect(`/leads/${leadCustomerId}`);
}

export async function createContactAction(
  leadCustomerId: string,
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const result = contactInputSchema.safeParse({
    leadCustomerId,
    branchId: formData.get("branchId"),
    name: formData.get("name"),
    designation: formData.get("designation"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    isPrimary: formData.get("isPrimary"),
    notes: formData.get("notes")
  });

  if (!result.success) {
    return fieldErrorState(result.error);
  }

  await createContact(user, result.data);
  revalidatePath(`/leads/${leadCustomerId}`);
  redirect(`/leads/${leadCustomerId}`);
}

export async function createActivityAction(
  leadCustomerId: string,
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const result = activityInputSchema.safeParse({
    leadCustomerId,
    branchId: formData.get("branchId"),
    contactId: formData.get("contactId"),
    ownerId: formData.get("ownerId"),
    type: formData.get("type"),
    status: formData.get("status"),
    subject: formData.get("subject"),
    body: formData.get("body"),
    occurredAt: formData.get("occurredAt"),
    dueAt: formData.get("dueAt")
  });

  if (!result.success) {
    return fieldErrorState(result.error);
  }

  await createActivity(user, result.data);
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadCustomerId}`);
  redirect(`/leads/${leadCustomerId}`);
}

export async function completeActivityAction(leadCustomerId: string, activityId: string) {
  const user = await requireUser();
  await completeActivity(user, activityId);
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadCustomerId}`);
}

export async function reassignLeadOwnerAction(
  leadCustomerId: string,
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const result = reassignmentInputSchema.safeParse({
    leadCustomerId,
    toOwnerId: formData.get("toOwnerId"),
    reason: formData.get("reason")
  });

  if (!result.success) {
    return fieldErrorState(result.error);
  }

  await reassignLeadOwner(user, result.data);
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadCustomerId}`);
  return { ok: true, message: "Owner reassigned." };
}
```

- [ ] **Step 4: Run action tests and commit**

Run:

```powershell
npm run test -- src/server/crm/actions.test.ts
```

Expected:

```text
PASS  src/server/crm/actions.test.ts
```

Commit:

```powershell
git add src/server/crm/actions.ts src/server/crm/actions.test.ts
git commit -m "feat: add crm server actions"
```

---

### Task 6: Leads List and Lead Create/Edit Routes

**Files:**

- Create: `src/components/crm/lead-list.tsx`
- Create: `src/components/crm/lead-form.tsx`
- Create: `src/app/(app)/leads/page.tsx`
- Create: `src/app/(app)/leads/new/page.tsx`
- Create: `src/app/(app)/leads/[leadId]/edit/page.tsx`

- [ ] **Step 1: Write route-level acceptance notes as component test coverage**

Create `src/components/crm/lead-list.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LeadList } from "./lead-list";

describe("LeadList", () => {
  it("shows company-wide lead rows with owner and next follow-up", () => {
    render(
      <LeadList
        filters={{}}
        owners={[{ id: "user_sales", name: "Sales User", email: "sales@example.com", role: "SALES" }]}
        records={[
          {
            id: "lead_1",
            name: "Acme Learning Pvt Ltd",
            state: "LEAD",
            industry: "Education",
            source: "Referral",
            updatedAt: new Date("2026-06-15T10:00:00.000Z"),
            owner: { id: "user_sales", name: "Sales User", email: "sales@example.com", role: "SALES" },
            branches: [{ id: "branch_1", name: "Bengaluru Branch" }],
            contacts: [{ id: "contact_1", name: "Anita Rao", isPrimary: true }],
            activities: [{ id: "activity_1", subject: "Call procurement", dueAt: new Date("2026-06-16T10:00:00.000Z") }],
            _count: { branches: 1, contacts: 1, activities: 1 }
          }
        ]}
      />
    );

    expect(screen.getByRole("link", { name: "Acme Learning Pvt Ltd" })).toHaveAttribute("href", "/leads/lead_1");
    expect(screen.getByText("Sales User")).toBeVisible();
    expect(screen.getByText("Call procurement")).toBeVisible();
    expect(screen.getByText("1 branch")).toBeVisible();
    expect(screen.getByText("1 contact")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the component test and verify it fails**

Run:

```powershell
npm run test -- src/components/crm/lead-list.test.tsx
```

Expected:

```text
FAIL  src/components/crm/lead-list.test.tsx
Cannot find module './lead-list'
```

- [ ] **Step 3: Create `src/components/crm/lead-list.tsx`**

Implement `LeadList` with these visible controls:

- Search input named `q`.
- Owner select named `ownerId`.
- State select named `state` with `LEAD`, `CUSTOMER`, `DORMANT`.
- Follow-up select named `followUp` with `overdue`, `today`, `upcoming`.
- Link to `/leads/new` labeled `New lead/customer`.
- Row links to `/leads/{leadId}`.
- Empty state text: `No leads or customers match these filters.`

Use this prop shape:

```ts
type LeadListProps = {
  filters: {
    q?: string;
    ownerId?: string;
    state?: "LEAD" | "CUSTOMER" | "DORMANT";
    followUp?: "overdue" | "today" | "upcoming";
  };
  owners: Array<{ id: string; name: string; email: string; role: "ADMIN" | "SALES" }>;
  records: Array<{
    id: string;
    name: string;
    state: "LEAD" | "CUSTOMER" | "DORMANT";
    industry: string | null;
    source: string | null;
    updatedAt: Date;
    owner: { id: string; name: string; email: string; role: "ADMIN" | "SALES" };
    branches: Array<{ id: string; name: string }>;
    contacts: Array<{ id: string; name: string; isPrimary: boolean }>;
    activities: Array<{ id: string; subject: string; dueAt: Date | null }>;
    _count: { branches: number; contacts: number; activities: number };
  }>;
};
```

- [ ] **Step 4: Create `src/components/crm/lead-form.tsx`**

The form must render these fields and names:

- `name`, required text input, label `Lead/customer name`.
- `state`, select with `LEAD`, `CUSTOMER`, `DORMANT`.
- `ownerId`, select populated from active Admin/Sales users.
- `industry`, optional text input.
- `source`, optional text input.
- `notes`, optional textarea.
- Submit button label from prop: `Create lead/customer` or `Save lead/customer`.

The component accepts:

```ts
type LeadFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  owners: Array<{ id: string; name: string; email: string }>;
  initialValues?: {
    name: string;
    state: "LEAD" | "CUSTOMER" | "DORMANT";
    ownerId: string;
    industry: string | null;
    source: string | null;
    notes: string | null;
  };
  submitLabel: string;
};
```

- [ ] **Step 5: Create `/leads` list route**

Create `src/app/(app)/leads/page.tsx`:

```tsx
import { requireUser } from "@/server/auth/current-user";
import { LeadList } from "@/components/crm/lead-list";
import { listLeadCustomers } from "@/server/crm/queries";
import { leadFilterSchema } from "@/server/crm/validators";

export default async function LeadsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const rawSearchParams = await searchParams;
  const filters = leadFilterSchema.parse({
    q: rawSearchParams.q,
    ownerId: rawSearchParams.ownerId,
    state: rawSearchParams.state,
    followUp: rawSearchParams.followUp
  });
  const { records, owners } = await listLeadCustomers(user, filters);

  return <LeadList filters={filters} owners={owners} records={records} />;
}
```

- [ ] **Step 6: Create lead create and edit routes**

Create `src/app/(app)/leads/new/page.tsx`:

```tsx
import { LeadForm } from "@/components/crm/lead-form";
import { createLeadCustomerAction } from "@/server/crm/actions";
import { listCrmOwners } from "@/server/crm/queries";

export default async function NewLeadPage() {
  const owners = await listCrmOwners();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New lead/customer</h1>
      <LeadForm action={createLeadCustomerAction} owners={owners} submitLabel="Create lead/customer" />
    </div>
  );
}
```

Create `src/app/(app)/leads/[leadId]/edit/page.tsx` and bind `updateLeadCustomerAction` with the route `leadId`. If the record is missing, call `notFound()`. The page heading must be `Edit lead/customer`.

- [ ] **Step 7: Run component test and typecheck**

Run:

```powershell
npm run test -- src/components/crm/lead-list.test.tsx
npm run typecheck
```

Expected:

```text
PASS  src/components/crm/lead-list.test.tsx
```

and:

```text
tsc --noEmit
```

exits with code 0.

- [ ] **Step 8: Commit list and form routes**

Run:

```powershell
git add src/components/crm/lead-list.tsx src/components/crm/lead-list.test.tsx src/components/crm/lead-form.tsx 'src/app/(app)/leads'
git commit -m "feat: add lead list and forms"
```

---

### Task 7: Lead Detail, Branches, Contacts, Activities, and Reassignment UI

**Files:**

- Create: `src/components/crm/branch-form.tsx`
- Create: `src/components/crm/contact-form.tsx`
- Create: `src/components/crm/activity-form.tsx`
- Create: `src/components/crm/reassign-owner-form.tsx`
- Create: `src/app/(app)/leads/[leadId]/page.tsx`
- Create: `src/app/(app)/leads/[leadId]/branches/new/page.tsx`
- Create: `src/app/(app)/leads/[leadId]/contacts/new/page.tsx`
- Create: `src/app/(app)/leads/[leadId]/activities/new/page.tsx`

- [ ] **Step 1: Create form components with exact field names**

`BranchForm` fields:

- `name`, required text input, label `Branch name`.
- `addressLine1`, `addressLine2`, `city`, `region`, `postalCode`, `country`.
- `gstin`, `locationHint`, `salesContext`.
- `notes` textarea.
- Submit button `Create branch`.

`ContactForm` fields:

- `name`, required text input, label `Contact name`.
- `branchId`, optional select with empty option `Company level`.
- `designation`, `email`, `phone`.
- `isPrimary` checkbox labeled `Primary contact`.
- `notes` textarea.
- Submit button `Create contact`.

`ActivityForm` fields:

- `type`, select with `CALL`, `EMAIL`, `MEETING`, `NOTE`, `FOLLOW_UP`.
- `status`, select with `OPEN`, `COMPLETED`, `CANCELLED`.
- `ownerId`, select populated from active Admin/Sales users.
- `branchId`, optional select.
- `contactId`, optional select.
- `subject`, required text input.
- `body` textarea.
- `occurredAt`, datetime-local input.
- `dueAt`, datetime-local input.
- Submit button `Add activity`.

`ReassignOwnerForm` fields:

- `toOwnerId`, select populated from active Admin/Sales users except current owner.
- `reason`, required textarea.
- Submit button `Reassign owner`.

- [ ] **Step 2: Create lead detail route**

Create `src/app/(app)/leads/[leadId]/page.tsx` with this behavior:

- Calls `requireUser()`.
- Calls `getLeadCustomerDetail(user, params.leadId)`.
- Calls `notFound()` if missing.
- Shows heading with lead/customer name.
- Shows state, owner, industry, source, notes, created date, updated date.
- Shows links:
  - `/leads/{leadId}/edit` labeled `Edit`.
  - `/leads/{leadId}/branches/new` labeled `Add branch`.
  - `/leads/{leadId}/contacts/new` labeled `Add contact`.
  - `/leads/{leadId}/activities/new` labeled `Add activity`.
- Renders Branches section with name, city, region, GSTIN, sales context, notes.
- Renders Contacts section with name, designation, email, phone, primary flag, branch name.
- Renders Activities section with type, status, subject, owner, branch, contact, occurred date, due date, completion button for open items.
- Renders Ownership history section with from owner, to owner, changed by, reason, and date.
- Renders `ReassignOwnerForm`.

- [ ] **Step 3: Create branch, contact, and activity child routes**

Create `src/app/(app)/leads/[leadId]/branches/new/page.tsx`.

- Load the current user and lead detail.
- Call `notFound()` if the lead/customer is missing.
- Render heading `New branch for {lead.name}`.
- Render `BranchForm` bound to `createBranchAction.bind(null, lead.id)`.

Create `src/app/(app)/leads/[leadId]/contacts/new/page.tsx`.

- Load lead detail.
- Render heading `New contact for {lead.name}`.
- Pass lead branches to `ContactForm`.
- Bind `createContactAction.bind(null, lead.id)`.

Create `src/app/(app)/leads/[leadId]/activities/new/page.tsx`.

- Load lead detail and `listCrmOwners()`.
- Render heading `New activity for {lead.name}`.
- Pass owners, branches, and contacts to `ActivityForm`.
- Bind `createActivityAction.bind(null, lead.id)`.

- [ ] **Step 4: Run typecheck and commit**

Run:

```powershell
npm run typecheck
```

Expected:

```text
tsc --noEmit
```

exits with code 0.

Commit:

```powershell
git add src/components/crm/branch-form.tsx src/components/crm/contact-form.tsx src/components/crm/activity-form.tsx src/components/crm/reassign-owner-form.tsx 'src/app/(app)/leads/[leadId]'
git commit -m "feat: add crm detail workflows"
```

---

### Task 8: Seed Data for Local CRM Core Smoke

**Files:**

- Modify: `prisma/seed.ts`

- [ ] **Step 1: Extend seed script after seeded users**

After creating Admin and Sales users, load them by email and upsert this sample data:

```ts
const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
const salesEmail = process.env.SEED_SALES_EMAIL ?? "sales@example.com";

const admin = await prisma.user.findUniqueOrThrow({ where: { email: adminEmail } });
const sales = await prisma.user.findUniqueOrThrow({ where: { email: salesEmail } });

const sampleLead = await prisma.leadCustomer.upsert({
  where: { id: "seed_lead_acme_learning" },
  update: {
    name: "Acme Learning Pvt Ltd",
    state: "LEAD",
    industry: "Education",
    source: "Referral",
    ownerId: sales.id,
    notes: "Seed lead for CRM core smoke checks.",
    updatedById: admin.id
  },
  create: {
    id: "seed_lead_acme_learning",
    name: "Acme Learning Pvt Ltd",
    state: "LEAD",
    industry: "Education",
    source: "Referral",
    ownerId: sales.id,
    notes: "Seed lead for CRM core smoke checks.",
    createdById: admin.id,
    updatedById: admin.id
  }
});

await prisma.branch.upsert({
  where: { id: "seed_branch_acme_bengaluru" },
  update: {
    name: "Bengaluru Branch",
    city: "Bengaluru",
    region: "Karnataka",
    country: "India",
    salesContext: "Primary learning and development team"
  },
  create: {
    id: "seed_branch_acme_bengaluru",
    leadCustomerId: sampleLead.id,
    name: "Bengaluru Branch",
    city: "Bengaluru",
    region: "Karnataka",
    country: "India",
    salesContext: "Primary learning and development team"
  }
});

await prisma.contact.upsert({
  where: { id: "seed_contact_acme_anita" },
  update: {
    name: "Anita Rao",
    designation: "L&D Manager",
    email: "anita.rao@example.com",
    phone: "+91 98765 43210",
    isPrimary: true
  },
  create: {
    id: "seed_contact_acme_anita",
    leadCustomerId: sampleLead.id,
    branchId: "seed_branch_acme_bengaluru",
    name: "Anita Rao",
    designation: "L&D Manager",
    email: "anita.rao@example.com",
    phone: "+91 98765 43210",
    isPrimary: true
  }
});

await prisma.activity.upsert({
  where: { id: "seed_activity_acme_followup" },
  update: {
    ownerId: sales.id,
    status: "OPEN",
    subject: "Follow up on onboarding module requirements",
    dueAt: new Date("2026-06-20T10:00:00.000Z")
  },
  create: {
    id: "seed_activity_acme_followup",
    leadCustomerId: sampleLead.id,
    branchId: "seed_branch_acme_bengaluru",
    contactId: "seed_contact_acme_anita",
    ownerId: sales.id,
    createdById: admin.id,
    type: "FOLLOW_UP",
    status: "OPEN",
    subject: "Follow up on onboarding module requirements",
    dueAt: new Date("2026-06-20T10:00:00.000Z")
  }
});
```

- [ ] **Step 2: Run seed and verify the sample record appears in Prisma Studio or through a direct query**

Run:

```powershell
npm run prisma:seed
```

Expected:

```text
tsx prisma/seed.ts
```

exits with code 0.

Then run:

```powershell
npx prisma db execute --stdin
```

Paste:

```sql
select name, state from "LeadCustomer" where id = 'seed_lead_acme_learning';
```

Expected query result includes:

```text
Acme Learning Pvt Ltd
LEAD
```

- [ ] **Step 3: Commit seed changes**

Run:

```powershell
git add prisma/seed.ts
git commit -m "feat: seed crm core sample data"
```

---

### Task 9: Browser Smoke Tests for CRM Core

**Files:**

- Create: `tests/e2e/crm-core.spec.ts`

- [ ] **Step 1: Write Playwright smoke tests**

Create `tests/e2e/crm-core.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

async function signIn(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("admin creates a lead, branch, contact, follow-up, and reassigns owner", async ({ page }) => {
  await signIn(page, "admin@example.com", "Admin@12345");

  await page.goto("/leads");
  await page.getByRole("link", { name: "New lead/customer" }).click();
  await page.getByLabel("Lead/customer name").fill("Northstar Training Pvt Ltd");
  await page.getByLabel("State").selectOption("LEAD");
  await page.getByLabel("Owner").selectOption({ label: /Sales User/ });
  await page.getByLabel("Industry").fill("Corporate Training");
  await page.getByLabel("Source").fill("Website");
  await page.getByRole("button", { name: "Create lead/customer" }).click();

  await expect(page.getByRole("heading", { name: "Northstar Training Pvt Ltd" })).toBeVisible();

  await page.getByRole("link", { name: "Add branch" }).click();
  await page.getByLabel("Branch name").fill("Mumbai Branch");
  await page.getByLabel("City").fill("Mumbai");
  await page.getByLabel("Region").fill("Maharashtra");
  await page.getByLabel("Sales context").fill("HR buying team");
  await page.getByRole("button", { name: "Create branch" }).click();
  await expect(page.getByText("Mumbai Branch")).toBeVisible();

  await page.getByRole("link", { name: "Add contact" }).click();
  await page.getByLabel("Contact name").fill("Priya Nair");
  await page.getByLabel("Email").fill("priya.nair@example.com");
  await page.getByLabel("Phone").fill("+91 99887 77665");
  await page.getByLabel("Primary contact").check();
  await page.getByRole("button", { name: "Create contact" }).click();
  await expect(page.getByText("Priya Nair")).toBeVisible();

  await page.getByRole("link", { name: "Add activity" }).click();
  await page.getByLabel("Type").selectOption("FOLLOW_UP");
  await page.getByLabel("Status").selectOption("OPEN");
  await page.getByLabel("Owner").selectOption({ label: /Sales User/ });
  await page.getByLabel("Subject").fill("Schedule discovery call");
  await page.getByLabel("Due date").fill("2026-06-20T10:00");
  await page.getByRole("button", { name: "Add activity" }).click();
  await expect(page.getByText("Schedule discovery call")).toBeVisible();

  await page.getByLabel("New owner").selectOption({ label: /Admin User/ });
  await page.getByLabel("Reassignment reason").fill("Admin taking temporary ownership for onboarding");
  await page.getByRole("button", { name: "Reassign owner" }).click();
  await expect(page.getByText("Admin taking temporary ownership for onboarding")).toBeVisible();
});

test("sales can see company-wide leads regardless of owner", async ({ page }) => {
  await signIn(page, "sales@example.com", "Sales@12345");

  await page.goto("/leads");
  await expect(page.getByRole("heading", { name: "Leads / Customers" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Acme Learning Pvt Ltd" })).toBeVisible();

  await page.getByLabel("Owner").selectOption({ label: /Admin User/ });
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/ownerId=/);
});
```

- [ ] **Step 2: Run the CRM smoke test**

Run:

```powershell
npm run test:e2e -- tests/e2e/crm-core.spec.ts
```

Expected:

```text
2 passed
```

- [ ] **Step 3: Commit smoke tests**

Run:

```powershell
git add tests/e2e/crm-core.spec.ts
git commit -m "test: cover crm core smoke"
```

---

### Task 10: Full Verification and Hardening

**Files:**

- Review all files changed by Tasks 1 through 9.

- [ ] **Step 1: Run Prisma validation and generation**

Run:

```powershell
npx prisma validate
npm run prisma:generate
```

Expected:

```text
The schema at prisma\schema.prisma is valid
Generated Prisma Client
```

- [ ] **Step 2: Run unit and component tests**

Run:

```powershell
npm run test
```

Expected:

```text
Test Files  all passed
```

- [ ] **Step 3: Run the full gate**

Run:

```powershell
npm run gate
```

Expected:

```text
npm run typecheck && npm run lint && npm run test && npm run build
```

exits with code 0.

- [ ] **Step 4: Run all browser smoke tests**

Run:

```powershell
npm run test:e2e
```

Expected:

```text
passed
```

with the existing auth tests and new CRM core tests passing.

- [ ] **Step 5: Check formatting and whitespace**

Run:

```powershell
git diff --check
```

Expected:

```text
```

No output.

- [ ] **Step 6: Final commit if hardening changed files**

If verification required any fixes, commit them:

```powershell
git add prisma src tests
git commit -m "fix: harden crm core verification"
```

If no fixes were needed, skip this commit.

---

## Validation Rules

Lead/customer:

- `name` is required, trimmed, minimum 1 character after trimming.
- `state` is one of `LEAD`, `CUSTOMER`, `DORMANT`; default is `LEAD`.
- `ownerId` is required and must resolve to an active Admin or Sales user.
- `industry`, `source`, and `notes` are optional trimmed strings.
- Sales and Admin can create and edit records.
- Ownership is not visibility control.

Branch:

- `leadCustomerId` is required and must resolve to an existing lead/customer.
- `name` is required, trimmed.
- `country` defaults to `India`.
- Address, city, region, postal code, GSTIN, location hint, sales context, and notes are optional.
- Branch belongs to exactly one lead/customer.

Contact:

- `leadCustomerId` is required and must resolve to an existing lead/customer.
- `branchId` is optional, but when supplied it must belong to the same lead/customer.
- `name` is required, trimmed.
- `email` is optional, lowercased, and must be a valid email when supplied.
- `phone`, `designation`, and `notes` are optional trimmed strings.
- `isPrimary` defaults to false.

Activity/follow-up:

- `leadCustomerId` is required.
- `ownerId` is required and must resolve to an active Admin or Sales user.
- `type` is one of `CALL`, `EMAIL`, `MEETING`, `NOTE`, `FOLLOW_UP`.
- `status` is one of `OPEN`, `COMPLETED`, `CANCELLED`; default is `OPEN`.
- `subject` is required.
- `dueAt` is required when `type` is `FOLLOW_UP` and `status` is `OPEN`.
- `branchId` and `contactId` are optional and must belong to the selected lead/customer when supplied.
- Completing an activity sets `status`, `completedAt`, and `completedById`.

Ownership/reassignment:

- Reassignment requires `leadCustomerId`, `toOwnerId`, and `reason`.
- `toOwnerId` must be an active Admin or Sales user.
- `toOwnerId` must differ from the current owner.
- Reassignment updates `LeadCustomer.ownerId` and writes one `LeadOwnershipHistory` row in the same transaction.
- Sales can reassign because the design says the small team needs handoff flexibility and Sales can create/update normal sales records.

## Route Names and Server Action Names

Routes:

- `/leads`
- `/leads/new`
- `/leads/[leadId]`
- `/leads/[leadId]/edit`
- `/leads/[leadId]/branches/new`
- `/leads/[leadId]/contacts/new`
- `/leads/[leadId]/activities/new`

Server actions:

- `createLeadCustomerAction`
- `updateLeadCustomerAction`
- `createBranchAction`
- `createContactAction`
- `createActivityAction`
- `completeActivityAction`
- `reassignLeadOwnerAction`

Query functions:

- `listLeadCustomers`
- `getLeadCustomerDetail`
- `listCrmOwners`

Mutation functions:

- `createLeadCustomer`
- `updateLeadCustomer`
- `createBranch`
- `createContact`
- `createActivity`
- `completeActivity`
- `reassignLeadOwner`

## Commit Sequence

Use this commit sequence:

1. `feat: add crm core schema`
2. `feat: add crm validation contracts`
3. `feat: add crm query layer`
4. `feat: add crm mutation services`
5. `feat: add crm server actions`
6. `feat: add lead list and forms`
7. `feat: add crm detail workflows`
8. `feat: seed crm core sample data`
9. `test: cover crm core smoke`
10. `fix: harden crm core verification` only if final verification requires changes

## Final Verification Gates

Run these before claiming the CRM Core slice is complete:

```powershell
git status --short --branch
npx prisma validate
npm run prisma:generate
npm run test
npm run gate
npm run test:e2e
git diff --check
```

Expected:

- Branch is the implementation branch for CRM Core.
- Prisma schema validates.
- Prisma client generation succeeds.
- All Vitest tests pass.
- Typecheck, lint, tests, and build pass through `npm run gate`.
- Existing auth e2e tests and new CRM Core e2e tests pass.
- `git diff --check` prints no whitespace errors.

## Implementation Handoff Notes

- Keep opportunities, proposals, products, orders, finance, production, incentives, reports, and CSV import out of this slice.
- Do not add tenant IDs or organization scoping.
- Do not add new roles beyond `ADMIN` and `SALES`.
- Do not hide records from Sales based on ownership.
- Use owner filters only when the user explicitly selects an owner filter.
- Prefer soft workflow states over destructive deletes in this slice; destructive deletes are not part of this plan.
