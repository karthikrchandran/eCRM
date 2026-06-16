# Reports And Live Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace placeholder dashboard cards with live metrics and add a read-only `/reports` page for top clients, top billings, collections, pipeline, production, and follow-ups.

**Architecture:** Add a `src/server/reports` read-model module with permission checks and tested aggregation helpers. Wire server-rendered dashboard and reports routes to that module, keeping formatting in a small component helper and avoiding Prisma schema changes.

**Tech Stack:** Next.js App Router, React, TypeScript, Prisma, Postgres, Vitest, Playwright, Tailwind CSS.

---

## Status

Implementation status: **READY TO START** on `feature/reports-dashboard`.

Approved exclusions:

- No gross margin metrics.
- No incentives pending approval metrics.
- No new Prisma models, migrations, seed data, write workflows, exports, or Admin mutation controls.

## Source Contracts

Use these landed fields:

- `Opportunity.estimatedValueInr` is a Decimal INR amount; convert it to paise in reports.
- Open opportunities are those whose `stage.kind` is `OPEN`.
- `Order.subtotalPaisa` is booked value excluding GST.
- Exclude `Order.status = CANCELLED` from current billing summaries.
- Top products use `OrderLineItem.productNameSnapshot` and `OrderLineItem.lineSubtotalPaisa`.
- Collections use `Payment.amountPaisa`.
- Pending receivables use `calculateOrderPaymentSummary(order.totalPaisa, order.invoices, order.payments).pendingReceivablePaisa`.
- Production pending excludes `ProductionWorkItem.status in ("DONE", "SKIPPED")`.
- Upcoming follow-ups are `Activity.status = OPEN` with `dueAt >= now`.
- Reports are visible to `ADMIN` and `SALES` via `canViewCompanyRecords`.

## Files

- Create: `src/server/reports/types.ts`
- Create: `src/server/reports/permissions.ts`
- Create: `src/server/reports/queries.ts`
- Create: `src/server/reports/queries.test.ts`
- Create: `src/components/reports/report-formatters.ts`
- Create: `src/app/(app)/reports/page.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `tests/e2e/auth.spec.ts`
- Create: `tests/e2e/reports.spec.ts`
- Modify: `docs/superpowers/plans/2026-06-15-ecrm-reports-after-crm-plan.md`
- Modify: `docs/superpowers/plans/2026-06-15-ecrm-reports-metric-inventory.md`

## Task 1: Add Reports Types, Permissions, And Query Tests

**Files:**

- Create: `src/server/reports/types.ts`
- Create: `src/server/reports/permissions.ts`
- Create: `src/server/reports/queries.test.ts`

- [ ] **Step 1: Create read-model types**

Create `src/server/reports/types.ts`:

```ts
import type { UserRole } from "@prisma/client";

export type ReportsUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type DashboardMetric = {
  label: string;
  value: string;
  detail: string;
};

export type PipelineStageSummary = {
  stageId: string;
  stageName: string;
  count: number;
  valuePaisa: number;
};

export type TopClientSummary = {
  clientId: string;
  clientName: string;
  orderCount: number;
  bookedValuePaisa: number;
};

export type TopProductSummary = {
  productName: string;
  orderCount: number;
  lineItemCount: number;
  bookedValuePaisa: number;
};

export type TopBillingSummary = {
  orderId: string;
  orderNumber: string;
  clientName: string;
  ownerName: string;
  bookedValuePaisa: number;
  status: string;
};

export type CollectionSummary = {
  collectedPaisa: number;
  pendingReceivablePaisa: number;
  paymentCount: number;
};

export type PendingProductionSummary = {
  workItemId: string;
  orderNumber: string;
  clientName: string;
  productName: string;
  status: string;
  dueAt: Date | null;
};

export type UpcomingFollowUpSummary = {
  activityId: string;
  subject: string;
  dueAt: Date | null;
  clientName: string;
  ownerName: string;
};

export type ReportsOverview = {
  dashboardMetrics: DashboardMetric[];
  pipelineByStage: PipelineStageSummary[];
  topClients: TopClientSummary[];
  topProducts: TopProductSummary[];
  topBillings: TopBillingSummary[];
  collections: CollectionSummary;
  pendingProduction: PendingProductionSummary[];
  upcomingFollowUps: UpcomingFollowUpSummary[];
  recentOrders: TopBillingSummary[];
};
```

- [ ] **Step 2: Create read permission helper**

Create `src/server/reports/permissions.ts`:

```ts
import { canViewCompanyRecords } from "@/server/auth/permissions";
import type { ReportsUser } from "./types";

export function assertCanViewReports(user: ReportsUser) {
  if (!canViewCompanyRecords(user.role)) {
    throw new Error("You do not have permission to view reports.");
  }
}
```

- [ ] **Step 3: Write failing query tests**

Create `src/server/reports/queries.test.ts` with tests for:

- Admin and Sales can view reports; unsupported roles are rejected.
- Opportunity Decimal INR values convert to paise.
- Cancelled orders are excluded from top clients, top products, and top billings.
- Top billings and top clients use `subtotalPaisa`, excluding GST.
- Collections use payment rows and pending receivables use order totals minus cumulative payments.
- Production pending excludes `DONE` and `SKIPPED`.

Run:

```powershell
npm run test -- src/server/reports/queries.test.ts
```

Expected: fail because `src/server/reports/queries.ts` does not exist.

## Task 2: Implement Reports Query Module

**Files:**

- Create: `src/server/reports/queries.ts`
- Modify: `src/server/reports/queries.test.ts`

- [ ] **Step 1: Implement pure helpers**

Create helpers in `src/server/reports/queries.ts`:

```ts
function decimalInrToPaisa(value: unknown): number {
  if (!value) return 0;
  return Math.round(Number(value) * 100);
}

function isCurrentOrder(status: string) {
  return status !== "CANCELLED";
}

function isPendingProduction(status: string) {
  return status !== "DONE" && status !== "SKIPPED";
}
```

- [ ] **Step 2: Implement `getReportsOverview`**

Implement:

```ts
export async function getReportsOverview(
  user: ReportsUser,
  database: ReportsQueryDb = db as unknown as ReportsQueryDb
): Promise<ReportsOverview>
```

Load in parallel:

- `opportunity.findMany` with `stage`, ordered by `updatedAt desc`.
- `order.findMany` with `leadCustomer`, `owner`, `lineItems`, `invoices`, and `payments`.
- `payment.findMany` ordered by `paymentDate desc`.
- `productionWorkItem.findMany` with order/customer context.
- `activity.findMany` with lead/customer and owner context.

Aggregate in memory into the `ReportsOverview` shape. Keep `take: 5` for top lists and pending lists.

- [ ] **Step 3: Run focused tests**

Run:

```powershell
npm run test -- src/server/reports/queries.test.ts
```

Expected: pass.

- [ ] **Step 4: Commit server reports module**

```powershell
git add src/server/reports
git commit -m "feat: add reports read models"
```

## Task 3: Add Report Formatters And Live Dashboard

**Files:**

- Create: `src/components/reports/report-formatters.ts`
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `tests/e2e/auth.spec.ts`

- [ ] **Step 1: Create formatter helper**

Create `src/components/reports/report-formatters.ts`:

```ts
export function formatInrPaisa(value: number) {
  return `INR ${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(value / 100)}`;
}

export function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(value) : "Not set";
}
```

- [ ] **Step 2: Replace hard-coded dashboard cards**

Modify `src/app/(app)/dashboard/page.tsx` to load:

```ts
const reports = await getReportsOverview(user);
```

Render `reports.dashboardMetrics` instead of the static `cards` array. Keep the page dense and operational; do not add marketing copy.

- [ ] **Step 3: Update auth dashboard smoke**

Modify `tests/e2e/auth.spec.ts` to expect:

- `Booked value excl. GST`
- `Top billings`
- `Reports`

Do not assert hard-coded zero values.

- [ ] **Step 4: Run focused tests**

Run:

```powershell
npm run test -- src/server/reports/queries.test.ts
npm run test:e2e -- tests/e2e/auth.spec.ts
```

- [ ] **Step 5: Commit dashboard wiring**

```powershell
git add src/components/reports src/app/(app)/dashboard/page.tsx tests/e2e/auth.spec.ts
git commit -m "feat: show live dashboard metrics"
```

## Task 4: Add Reports Page And Browser Smoke

**Files:**

- Create: `src/app/(app)/reports/page.tsx`
- Create: `tests/e2e/reports.spec.ts`

- [ ] **Step 1: Add `/reports` route**

Create a server component that:

- calls `requireUser()`;
- calls `getReportsOverview(user)`;
- renders sections for top clients, top products/services, top billings, collections, recent booked orders, open pipeline by stage, production pending, and upcoming follow-ups;
- does not render cost, margin, incentive, approval, or mutation controls.

- [ ] **Step 2: Add Playwright smoke**

Create `tests/e2e/reports.spec.ts`:

- Admin signs in, opens Reports from nav, sees all report sections.
- Sales signs in, opens Reports from nav, sees reports.
- Sales does not see buttons named `Approve incentive`, `Approve cost`, or `Save`.

- [ ] **Step 3: Run focused browser smoke**

Run:

```powershell
npm run test:e2e -- tests/e2e/reports.spec.ts
```

- [ ] **Step 4: Commit reports page**

```powershell
git add src/app/(app)/reports/page.tsx tests/e2e/reports.spec.ts
git commit -m "feat: add reports page"
```

## Task 5: Refresh Reports Planning Docs

**Files:**

- Modify: `docs/superpowers/plans/2026-06-15-ecrm-reports-after-crm-plan.md`
- Modify: `docs/superpowers/plans/2026-06-15-ecrm-reports-metric-inventory.md`

- [ ] **Step 1: Update docs to reflect landed modules**

Mark the old CRM-only blocked assumptions as stale and record:

- Opportunities, Orders/Production, Products/Proposals, and Finance have landed.
- Top billings exclude GST.
- Gross margin and incentives are intentionally excluded from this slice.
- `/reports` is now implemented as read-only.

- [ ] **Step 2: Commit docs refresh**

```powershell
git add docs/superpowers/plans/2026-06-15-ecrm-reports-after-crm-plan.md docs/superpowers/plans/2026-06-15-ecrm-reports-metric-inventory.md
git commit -m "docs: refresh reports implementation status"
```

## Task 6: Final Gates

**Files:** all changed files.

- [ ] Run `npx prisma validate`.
- [ ] Run `npm run prisma:generate`.
- [ ] Run `npm run test`.
- [ ] Run `npm run gate`.
- [ ] Run `npm run test:e2e`.
- [ ] Run `git diff --check`.
- [ ] If all pass, use `superpowers:finishing-a-development-branch` and offer local merge back to `main`.
