# Operations Cockpit Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stacked dashboard with a shared, data-backed Operations Cockpit for Sales and Admin users.

**Architecture:** Extend the existing `getReportsOverview()` server projection with typed six-month booked/collected trend points and read-only risk summaries. Compose accessible SVG chart and list components from that projection in the dashboard page; keep direct database access, permissions, and data ownership in the reports layer.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Prisma, Vitest, Testing Library, CSS, inline SVG.

---

### Task 1: Add the typed cockpit report projection

**Files:**
- Modify: `src/server/reports/types.ts`
- Modify: `src/server/reports/queries.ts`
- Modify: `src/server/reports/queries.test.ts`

- [ ] **Step 1: Write the failing projection tests**

Add deterministic assertions with `now = 2026-08-16T12:00:00Z` for a `cockpit` field returned by `getReportsOverview()`. Cover six ordered month points, booked and collected values grouped by UTC calendar month, a `hasHistory` false result when only one non-zero month exists, and the three delivery-risk counts.

```ts
expect(overview.cockpit.trend).toEqual({
  hasHistory: true,
  months: [
    { bookedPaisa: 0, collectedPaisa: 0, label: "Mar" },
    // Apr, May, Jun, Jul
    { bookedPaisa: 300000, collectedPaisa: 218000, label: "Aug" }
  ]
});
expect(overview.cockpit.deliveryRisk).toEqual({ blockedCount: 0, dueSoonCount: 1, overdueCount: 0, totalCount: 1 });
expect(overview.cockpit.followUpRisk).toEqual({ overdueCount: 1, upcomingCount: 1 });
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
& 'C:\My Workspace\eCRM\node_modules\.bin\vitest.cmd' run src/server/reports/queries.test.ts
```

Expected: failure because `ReportsOverview.cockpit` is not defined.

- [ ] **Step 3: Define the report contracts**

Add these types in `src/server/reports/types.ts` and add `cockpit: CockpitReports` to `ReportsOverview`:

```ts
export type CockpitTrendPoint = { bookedPaisa: number; collectedPaisa: number; label: string };
export type DeliveryRiskSummary = { blockedCount: number; dueSoonCount: number; overdueCount: number; totalCount: number };
export type CockpitReports = {
  deliveryRisk: DeliveryRiskSummary;
  followUpRisk: { overdueCount: number; upcomingCount: number };
  trend: { hasHistory: boolean; months: CockpitTrendPoint[] };
};
```

- [ ] **Step 4: Implement the minimal server-side builders**

In `src/server/reports/queries.ts`, add pure builders that receive the already fetched `OrderRecord[]`, `PaymentRecord[]`, `ProductionWorkItemRecord[]`, activities, and `now`:

```ts
function buildCockpitTrend(orders: OrderRecord[], payments: PaymentRecord[], now: Date): CockpitReports["trend"]
function buildDeliveryRisk(workItems: ProductionWorkItemRecord[], now: Date): DeliveryRiskSummary
function buildCockpitReports(input: { activities: ActivityRecord[]; orders: OrderRecord[]; payments: PaymentRecord[]; workItems: ProductionWorkItemRecord[]; now: Date }): CockpitReports
```

Use UTC month keys for the current month and preceding five calendar months. Exclude cancelled orders with `isCurrentOrder()`. Count a delivery item once in each applicable bucket only when it is pending: blocked if a pending stage is `BLOCKED`; overdue if its work-item due date is before `now`; due soon if its due date is from `now` through seven days ahead and it is not overdue. Set `hasHistory` only when two or more buckets have booked or collected value.

- [ ] **Step 5: Attach the projection to `getReportsOverview()` and verify GREEN**

Pass the existing query results into `buildCockpitReports()` in the returned overview, then rerun the focused test:

```powershell
& 'C:\My Workspace\eCRM\node_modules\.bin\vitest.cmd' run src/server/reports/queries.test.ts
```

Expected: all report-query tests pass.

### Task 2: Build accessible cockpit visual components

**Files:**
- Create: `src/components/dashboard/cockpit-charts.tsx`
- Create: `src/components/dashboard/cockpit-charts.test.tsx`

- [ ] **Step 1: Write failing component tests**

Test the public chart components with plain projection fixtures. Assert that a chart has an accessible name and text fallback, has a visible `Not enough history yet` state for `hasHistory: false`, and represents each supplied pipeline stage/risk row.

```tsx
render(<BookedCollectedTrend currency="INR" trend={{ hasHistory: false, months: [] }} />);
expect(screen.getByText("Not enough history yet")).toBeVisible();

render(<PipelineStageBars currency="INR" stages={[{ count: 2, stageId: "qualified", stageName: "Qualified", valuePaisa: 2090000 }]} />);
expect(screen.getByRole("img", { name: "Pipeline by stage" })).toHaveTextContent("Qualified");
```

- [ ] **Step 2: Run the focused component test and verify RED**

Run:

```powershell
& 'C:\My Workspace\eCRM\node_modules\.bin\vitest.cmd' run src/components/dashboard/cockpit-charts.test.tsx
```

Expected: failure because the component module does not exist.

- [ ] **Step 3: Implement minimal reusable visual components**

Create `src/components/dashboard/cockpit-charts.tsx` with:

```ts
export function BookedCollectedTrend(props: { currency: ReportCurrency; trend: CockpitReports["trend"] }): JSX.Element
export function PipelineStageBars(props: { currency: ReportCurrency; stages: PipelineStageSummary[] }): JSX.Element
export function ReceivablesAgingBars(props: { currency: ReportCurrency; buckets: AgingBucketSummary[] }): JSX.Element
export function DeliveryRiskPanel(props: { risk: DeliveryRiskSummary }): JSX.Element
```

Render charts as semantic figures with `role="img"`, `aria-label`, a short visible text summary, and inline SVG only when the corresponding series has data. Use `formatCurrencyPaisa()` for all currency labels. Do not add a third-party chart dependency.

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
& 'C:\My Workspace\eCRM\node_modules\.bin\vitest.cmd' run src/components/dashboard/cockpit-charts.test.tsx
```

Expected: all cockpit component tests pass.

### Task 3: Compose the shared dashboard and responsive layout

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/app/(app)/dashboard/page.test.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write the failing page test**

Replace the stacked-section expectation with cockpit regions. Mock `getReportsOverview()` with `cockpit`, `finance.receivablesAging`, `sales.followUpCompliance`, current rows, and pipeline stages. Assert that both an Admin and a Sales mock receive the same cockpit regions and that all drill-through anchors have existing destinations.

```tsx
expect(screen.getByRole("region", { name: "Operations health" })).toBeVisible();
expect(screen.getByRole("region", { name: "Commercial and cash" })).toBeVisible();
expect(screen.getByRole("region", { name: "Operating detail" })).toBeVisible();
expect(screen.getByRole("link", { name: "View delivery risk" })).toHaveAttribute("href", "/production");
```

- [ ] **Step 2: Run the dashboard test and verify RED**

Run:

```powershell
& 'C:\My Workspace\eCRM\node_modules\.bin\vitest.cmd' run 'src/app/(app)/dashboard/page.test.tsx'
```

Expected: failure because the new cockpit regions do not exist.

- [ ] **Step 3: Compose the cockpit page**

Keep `requireUser("crm")` and one `getReportsOverview(user)` call. Replace the four stacked overview sections with:

```tsx
<section aria-label="Operations health">...</section>
<section aria-label="Commercial and cash">...</section>
<section aria-label="Operating detail">...</section>
```

The health strip uses the existing pipeline/booked/receivables/collections metrics plus `cockpit.deliveryRisk.totalCount`. The commercial/cash section renders `PipelineStageBars`, `BookedCollectedTrend`, and `DeliveryRiskPanel`. The operating-detail section renders `ReceivablesAgingBars`, upcoming follow-ups with a My Day link, recent bookings with an Orders link, and pending production with a Production link. Preserve visible zero and empty states; never manufacture table rows or trend values.

- [ ] **Step 4: Add responsive cockpit CSS**

Add focused `dashboard-cockpit-*` rules in `src/app/globals.css`: five-card health grid on large screens, two/three-column chart grid where space permits, single-column layout below `640px`, compact list rows, semantic green/amber/red accents, and no hard-coded viewport height. Keep the existing nav and global palette unchanged.

- [ ] **Step 5: Verify GREEN and run the focused regression suite**

Run:

```powershell
& 'C:\My Workspace\eCRM\node_modules\.bin\vitest.cmd' run src/server/reports/queries.test.ts src/components/dashboard/cockpit-charts.test.tsx 'src/app/(app)/dashboard/page.test.tsx'
```

Expected: all focused report, chart, and dashboard tests pass.

### Task 4: Verify role parity and production readiness

**Files:**
- Modify: `tests/e2e/dashboard.spec.ts` only if the existing dashboard browser coverage lacks Sales/Admin cockpit assertions.

- [ ] **Step 1: Add browser assertions only if no equivalent coverage exists**

Extend the existing persona dashboard test to sign in separately as `admin@example.com` and `sales@example.com`, assert the three cockpit regions and one drill-through link each, and keep their separate browser contexts.

- [ ] **Step 2: Run the appropriate browser slice**

Run:

```powershell
npm run test:e2e -- tests/e2e/dashboard.spec.ts
```

Expected: both protected personas load the cockpit and can use the existing drill-through destinations. If the Windows-host browser process fails to stay alive, record that as a host-run gate rather than claiming browser verification.

- [ ] **Step 3: Run repository checks**

Run:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Expected: each command exits 0. Preserve unrelated files and do not commit unless explicitly requested.

## Plan self-review

- **Spec coverage:** Tasks 1-3 implement the shared cockpit, trends, risk summaries, empty states, accessible SVG charts, drill-through links, and responsive layout. Task 4 covers role parity and release checks. Customer customization remains intentionally excluded.
- **Placeholder scan:** no `TBD`, `TODO`, or undefined implementation steps.
- **Type consistency:** `CockpitReports`, `DeliveryRiskSummary`, and `CockpitTrendPoint` are defined in Task 1 and consumed by Tasks 2 and 3.
