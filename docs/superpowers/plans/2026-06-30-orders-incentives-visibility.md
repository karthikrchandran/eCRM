# Orders and Incentives Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose finance in the right places by splitting admin orders and incentives browsing, adding a sales performance page, and grouping admin setup navigation.

**Architecture:** Reuse the existing Prisma-backed finance and reports data. Admin order and incentive browsing will stay separate to support company-wide filtering. Sales gets one combined page focused on the rep's own activity. The app shell handles role-based navigation and setup grouping, while the page routes focus on read-only summaries and filters.

**Tech Stack:** Next.js App Router, React, Prisma, Vitest, Playwright.

---

### Task 1: Group admin navigation under Setup

**Files:**
- Modify: `src/components/app-shell.tsx`
- Test: `src/components/app-shell.test.tsx`

- [ ] **Step 1: Write the failing test**

```ts
it("groups production and admin tools under Setup for admins", () => {
  render(<AppShell user={{ name: "Kavya Iyer", email: "admin@example.com", role: "ADMIN" }}><p>Dashboard content</p></AppShell>);

  expect(screen.getByText("Setup")).toBeVisible();
  expect(screen.getByRole("link", { name: "Production" })).toHaveAttribute("href", "/production");
  expect(screen.getByRole("link", { name: "Production config" })).toHaveAttribute("href", "/admin/production-config");
  expect(screen.getByRole("link", { name: "Products" })).toHaveAttribute("href", "/admin/products");
  expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/admin/settings");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/app-shell.test.tsx`
Expected: FAIL because `Setup` grouping does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```tsx
const adminMainNavItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/customer-360", label: "Customer 360" },
  { href: "/opportunities", label: "Pipeline" },
  { href: "/orders", label: "Orders" },
  { href: "/incentives", label: "Incentives" },
  { href: "/reports", label: "Reports" }
];

const adminSetupNavItems = [
  { href: "/production", label: "Production" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/production-config", label: "Production config" },
  { href: "/admin/settings", label: "Settings" }
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/app-shell.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/app-shell.tsx src/components/app-shell.test.tsx
git commit -m "feat: group admin setup navigation"
```

### Task 2: Add admin orders and incentives browsing

**Files:**
- Modify: `src/app/(app)/orders/page.tsx`
- Modify: `src/components/orders/order-list.tsx`
- Create: `src/app/(app)/incentives/page.tsx`
- Create: `src/components/incentives/incentive-list.tsx`
- Create: `src/server/finance/incentives-queries.ts`
- Test: `src/components/orders/order-list.test.tsx`
- Test: `src/components/incentives/incentive-list.test.tsx`
- Test: `src/server/finance/incentives-queries.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("lists incentives with rep and time filters", async () => {
  // assert the query returns incentive rows for the selected owner and quarter
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/server/finance/incentives-queries.test.ts`
Expected: FAIL because the new query helper does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export async function listIncentives(user: FinanceUser, filters: IncentiveFilters, database = db) {
  assertCanViewFinance(user);
  return database.incentive.findMany({
    where: {
      ...(filters.ownerId ? { order: { ownerId: filters.ownerId } } : {}),
      ...(filters.status ? { status: filters.status } : {})
    },
    orderBy: [{ updatedAt: "desc" }]
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/server/finance/incentives-queries.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/orders/page.tsx src/components/orders/order-list.tsx src/app/(app)/incentives/page.tsx src/components/incentives/incentive-list.tsx src/server/finance/incentives-queries.ts
git commit -m "feat: split orders and incentives views"
```

### Task 3: Add sales performance page

**Files:**
- Create: `src/app/(app)/performance/page.tsx`
- Create: `src/components/performance/sales-performance.tsx`
- Modify: `src/components/app-shell.tsx`
- Test: `src/components/performance/sales-performance.test.tsx`

- [ ] **Step 1: Write the failing test**

```ts
it("shows the signed-in rep's orders and incentives in one filtered view", () => {
  render(<SalesPerformance ... />);
  expect(screen.getByRole("heading", { name: "Sales performance" })).toBeVisible();
  expect(screen.getByText("This quarter")).toBeVisible();
  expect(screen.getByText("Orders")).toBeVisible();
  expect(screen.getByText("Incentives")).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/performance/sales-performance.test.tsx`
Expected: FAIL because the page/component does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```tsx
export function SalesPerformance({ orders, incentives }) {
  return (
    <div>
      <h1>Sales performance</h1>
      <section>Orders</section>
      <section>Incentives</section>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/performance/sales-performance.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/performance/page.tsx src/components/performance/sales-performance.tsx src/components/app-shell.tsx
git commit -m "feat: add sales performance view"
```

### Task 4: Verify navigation and routes end to end

**Files:**
- Modify: `src/components/app-shell.test.tsx`
- Test: `tests` or Playwright smoke paths if needed

- [ ] **Step 1: Run the relevant tests**

Run: `npm test -- src/components/app-shell.test.tsx src/components/orders/order-list.test.tsx src/components/performance/sales-performance.test.tsx`
Expected: PASS.

- [ ] **Step 2: Run the full gate**

Run: `npm run gate`
Expected: PASS.

- [ ] **Step 3: Browser smoke**

Run the local app and verify:
```bash
http://localhost:3000/orders
http://localhost:3000/incentives
http://localhost:3000/performance
```
Expected: admin pages show company-wide filters; sales page shows rep-scoped combined finance.

- [ ] **Step 4: Commit**

```bash
git add src/components/app-shell.test.tsx
git commit -m "test: cover grouped setup and finance routes"
```
