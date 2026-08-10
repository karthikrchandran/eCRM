# eCRM Remaining Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining eCRM page surfaces outside the dashboard and contacts work, with a simple lead intake experience, proposal management that keeps proposals versioned and read-only, customer 360, orders, production, reports/admin, and My Day last.

**Architecture:** Keep the remaining work in the existing modular monolith boundaries. Each page cluster should use the current server query/action pattern and focused App Router pages, with the smallest possible component layer around each route. Proposal management is explicitly append-only: users can create new versions and manage status/book-order flows, but they cannot edit proposal bodies in place. My Day is the last phase so the personal workspace can be revisited after the shared CRM, order, and production flows settle.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma/Postgres, Zod, server actions, route handlers, Vitest, Testing Library, Playwright, Tailwind CSS.

---

## Scope Boundaries

Included:

- Lead intake pages: list, create, import CSV, and template download parity.
- Opportunity detail proposal management with multiple versions.
- Customer 360 workspace and its lead-scoped landing page.
- Orders list/detail/book-order flow.
- Production board, work-item detail, and production config.
- Reports and admin pages that still need UI cleanup or route verification.
- My Day workspace, explicitly last.

Excluded:

- Contacts, dashboard, and the lead/contact detail work already handled elsewhere.
- Proposal in-place editing or proposal body mutation after creation.
- New schema work unless a phase explicitly needs it.
- Background job infrastructure or queue services.

## File Map

- Lead intake:
  - Modify: `src/app/(app)/leads/page.tsx`
  - Modify: `src/components/crm/lead-list.tsx`
  - Modify: `src/app/(app)/leads/import/page.tsx`
  - Modify: `src/app/(app)/leads/import/template/route.ts`
  - Modify: `src/server/crm/lead-import.ts`
  - Modify: `src/server/crm/lead-import-actions.ts`
  - Modify: `src/components/crm/lead-import-form.tsx`
  - Test: `src/components/crm/lead-list.test.tsx`
  - Test: `src/components/crm/lead-import-form.test.tsx`
  - Test: `src/server/crm/lead-import.test.ts`
  - Test: `tests/e2e/leads.spec.ts`

- Opportunity proposals:
  - Modify: `src/app/(app)/opportunities/[opportunityId]/page.tsx`
  - Modify: `src/app/(app)/opportunities/[opportunityId]/proposals/new/page.tsx`
  - Modify: `src/app/(app)/opportunities/[opportunityId]/proposals/[proposalId]/page.tsx`
  - Modify: `src/app/(app)/opportunities/[opportunityId]/proposals/[proposalId]/book-order/page.tsx`
  - Modify: `src/components/proposals/proposal-detail.tsx`
  - Modify: `src/components/proposals/proposal-form.tsx`
  - Modify: `src/components/proposals/proposal-line-items.tsx`
  - Modify: `src/components/proposals/proposal-pdf-upload.tsx`
  - Modify: `src/components/proposals/proposal-status-actions.tsx`
  - Modify: `src/server/proposals/queries.ts`
  - Modify: `src/server/proposals/mutations.ts`
  - Modify: `src/server/proposals/actions.ts`
  - Test: `src/components/proposals/proposal-detail.test.tsx`
  - Test: `src/components/proposals/proposal-form.test.tsx`
  - Test: `src/server/proposals/queries.test.ts`
  - Test: `src/server/proposals/mutations.test.ts`
  - Test: `src/server/proposals/actions.test.ts`

- Customer 360:
  - Modify: `src/app/(app)/customer-360/page.tsx`
  - Modify: `src/app/(app)/customer-360/[leadId]/page.tsx`
  - Modify: `src/components/crm/customer-360-workspace.tsx`
  - Test: `src/components/crm/customer-360-workspace.test.tsx`

- Orders:
  - Modify: `src/app/(app)/orders/page.tsx`
  - Modify: `src/app/(app)/orders/[orderId]/page.tsx`
  - Modify: `src/components/orders/order-list.tsx`
  - Modify: `src/components/orders/order-detail.tsx`
  - Modify: `src/components/orders/order-booking-form.tsx`
  - Modify: `src/server/orders/queries.ts`
  - Modify: `src/server/orders/mutations.ts`
  - Modify: `src/server/orders/actions.ts`
  - Test: `src/components/orders/order-list.test.tsx`
  - Test: `src/components/orders/order-detail.test.tsx`
  - Test: `src/server/orders/queries.test.ts`
  - Test: `src/server/orders/mutations.test.ts`
  - Test: `src/server/orders/actions.test.ts`

- Production:
  - Modify: `src/app/(app)/production/page.tsx`
  - Modify: `src/app/(app)/production/[workItemId]/page.tsx`
  - Modify: `src/app/(app)/admin/production-config/page.tsx`
  - Modify: `src/components/production/production-board.tsx`
  - Modify: `src/components/production/production-detail.tsx`
  - Modify: `src/components/production/production-config.tsx`
  - Modify: `src/components/production/production-stage-actions.tsx`
  - Modify: `src/server/production/queries.ts`
  - Modify: `src/server/production/mutations.ts`
  - Modify: `src/server/production/actions.ts`
  - Test: `src/components/production/production-board.test.tsx`
  - Test: `src/components/production/production-detail.test.tsx`
  - Test: `src/components/production/production-stage-actions.test.tsx`
  - Test: `src/server/production/queries.test.ts`
  - Test: `src/server/production/mutations.test.ts`
  - Test: `src/server/production/actions.test.ts`

- Reports and admin:
  - Modify: `src/app/(app)/reports/page.tsx`
  - Modify: `src/app/(app)/admin/settings/page.tsx`
  - Modify: `src/app/(app)/admin/products/page.tsx`
  - Modify: `src/app/(app)/admin/products/new/page.tsx`
  - Modify: `src/app/(app)/admin/products/[productServiceId]/edit/page.tsx`
  - Modify: `src/components/reports/report-formatters.ts`
  - Test: `src/components/reports/report-formatters.test.ts`
  - Test: `tests/e2e/reports.spec.ts`

- My Day last:
  - Modify: `src/app/(app)/my-day/page.tsx`
  - Modify: `src/components/sales-day/my-day-page.tsx`
  - Modify: `src/components/sales-day/task-composer.tsx`
  - Modify: `src/components/sales-day/task-list.tsx`
  - Modify: `src/components/sales-day/task-row.tsx`
  - Modify: `src/components/sales-day/voice-note-recorder.tsx`
  - Modify: `src/components/sales-day/voice-note-panel.tsx`
  - Modify: `src/components/sales-day/suggested-actions-panel.tsx`
  - Modify: `src/components/sales-day/insights-panel.tsx`
  - Modify: `src/components/sales-day/end-of-day-review.tsx`
  - Modify: `src/server/sales-day/queries.ts`
  - Modify: `src/server/sales-day/mutations.ts`
  - Modify: `src/server/sales-day/actions.ts`
  - Test: `src/components/sales-day/task-list.test.tsx`
  - Test: `src/components/sales-day/voice-note-panel.test.tsx`
  - Test: `src/components/sales-day/suggested-actions-panel.test.tsx`
  - Test: `src/server/sales-day/queries.test.ts`
  - Test: `src/server/sales-day/mutations.test.ts`
  - Test: `src/server/sales-day/actions.test.ts`
  - Test: `tests/e2e/my-day.spec.ts`

---

### Task 1: Lead Intake Parity and CSV Import

**Files:**
- Modify: `src/app/(app)/leads/page.tsx`
- Modify: `src/components/crm/lead-list.tsx`
- Modify: `src/app/(app)/leads/import/page.tsx`
- Modify: `src/app/(app)/leads/import/template/route.ts`
- Modify: `src/server/crm/lead-import.ts`
- Modify: `src/server/crm/lead-import-actions.ts`
- Modify: `src/components/crm/lead-import-form.tsx`
- Test: `src/components/crm/lead-list.test.tsx`
- Test: `src/components/crm/lead-import-form.test.tsx`
- Test: `src/server/crm/lead-import.test.ts`
- Test: `tests/e2e/leads.spec.ts`

- [ ] **Step 1: Confirm the current lead list and import routes still match the intended simple flow**

Run:

```powershell
npm test -- src/components/crm/lead-list.test.tsx src/components/crm/lead-import-form.test.tsx src/server/crm/lead-import.test.ts
```

Expected: the existing lead list/import tests pass and prove the page already exposes `Add one lead`, `Import leads from CSV`, and the fixed template route.

- [ ] **Step 2: Patch only what drifts from the current UX contract**

Keep the page simple: table first, search and filters above it, and the import/template actions always visible in the header. If a helper has drifted, patch the smallest file that owns it instead of reshaping the whole lead module.

- [ ] **Step 3: Verify the CSV template and import flow end to end**

Run:

```powershell
npm run typecheck
npm test -- src/components/crm/lead-list.test.tsx src/components/crm/lead-import-form.test.tsx src/server/crm/lead-import.test.ts
```

Expected: `tsc --noEmit` passes and the lead import tests stay green.

- [ ] **Step 4: Add or update the browser smoke for the lead intake page**

Run:

```powershell
npm run test:e2e -- tests/e2e/leads.spec.ts
```

Expected: the lead list page loads, the CSV import entry point is reachable, and the template download remains attached to the right route.

- [ ] **Step 5: Commit the lead intake slice**

```powershell
git add src/app/(app)/leads src/components/crm/lead-list.tsx src/server/crm/lead-import.ts src/server/crm/lead-import-actions.ts src/components/crm/lead-import-form.tsx tests/e2e/leads.spec.ts
git commit -m "feat: keep lead intake simple and importable"
```

---

### Task 2: Opportunity Detail and Proposal Version Management

**Files:**
- Modify: `src/app/(app)/opportunities/[opportunityId]/page.tsx`
- Modify: `src/app/(app)/opportunities/[opportunityId]/proposals/new/page.tsx`
- Modify: `src/app/(app)/opportunities/[opportunityId]/proposals/[proposalId]/page.tsx`
- Modify: `src/app/(app)/opportunities/[opportunityId]/proposals/[proposalId]/book-order/page.tsx`
- Modify: `src/components/proposals/proposal-detail.tsx`
- Modify: `src/components/proposals/proposal-form.tsx`
- Modify: `src/components/proposals/proposal-line-items.tsx`
- Modify: `src/components/proposals/proposal-pdf-upload.tsx`
- Modify: `src/components/proposals/proposal-status-actions.tsx`
- Modify: `src/server/proposals/queries.ts`
- Modify: `src/server/proposals/mutations.ts`
- Modify: `src/server/proposals/actions.ts`
- Test: `src/components/proposals/proposal-detail.test.tsx`
- Test: `src/components/proposals/proposal-form.test.tsx`
- Test: `src/server/proposals/queries.test.ts`
- Test: `src/server/proposals/mutations.test.ts`
- Test: `src/server/proposals/actions.test.ts`

- [ ] **Step 1: Lock the proposal rule before coding**

Proposal management is versioned and read-only after creation. The user can:

- create a new proposal version
- review version history
- upload or replace the current PDF attachment metadata for a version
- book an order from a proposal

The user cannot edit an existing proposal body in place.

- [ ] **Step 2: Add tests that prove the opportunity page only manages proposal versions**

Run:

```powershell
npm test -- src/components/proposals/proposal-detail.test.tsx src/components/proposals/proposal-form.test.tsx src/server/proposals/queries.test.ts src/server/proposals/mutations.test.ts src/server/proposals/actions.test.ts
```

Expected: the proposal detail test shows version history and status actions, and there is no edit-only path in the UI contract.

- [ ] **Step 3: Implement the read-only detail and version-creation path**

Use the existing proposal modules as the boundary:

- `proposal-detail.tsx` shows version metadata, linked opportunity context, line items, PDFs, and status.
- `proposal-form.tsx` is create-only and should be used for a fresh version or a new proposal, not editing old content.
- `proposal-status-actions.tsx` should expose manage-only actions like approve, retire, or book-order handoff.

- [ ] **Step 4: Keep the opportunity page focused**

The opportunity page should remain a record summary plus proposal management, not a second proposal editor. The page should surface proposal list/history and direct the user to the current version or a new version flow when needed.

- [ ] **Step 5: Verify the proposal slice**

Run:

```powershell
npm run typecheck
npm test -- src/components/proposals/proposal-detail.test.tsx src/components/proposals/proposal-form.test.tsx src/server/proposals/queries.test.ts src/server/proposals/mutations.test.ts src/server/proposals/actions.test.ts
```

Expected: typecheck passes and proposal tests confirm versioning without edit affordances.

- [ ] **Step 6: Commit the opportunity/proposal slice**

```powershell
git add src/app/(app)/opportunities/[opportunityId] src/components/proposals src/server/proposals
git commit -m "feat: manage proposal versions from opportunity detail"
```

---

### Task 3: Customer 360 Workspace

**Files:**
- Modify: `src/app/(app)/customer-360/page.tsx`
- Modify: `src/app/(app)/customer-360/[leadId]/page.tsx`
- Modify: `src/components/crm/customer-360-workspace.tsx`
- Test: `src/components/crm/customer-360-workspace.test.tsx`

- [ ] **Step 1: Verify the current customer 360 entry point and lead-scoped page**

Run:

```powershell
npm test -- src/components/crm/customer-360-workspace.test.tsx
```

Expected: the workspace shows a coherent account profile and timeline without needing any proposal editing surface.

- [ ] **Step 2: Tighten the page copy and navigation**

Keep this page as a read-only customer workspace that connects sales, delivery, and finance events. The page can link out to leads, opportunities, orders, and proposals, but it should not become a second editing surface for any of them.

- [ ] **Step 3: Verify the workspace stays stable under filters**

Run:

```powershell
npm run typecheck
npm test -- src/components/crm/customer-360-workspace.test.tsx
```

Expected: the filtered stream, account summary, and linked records all still render.

- [ ] **Step 4: Commit the customer 360 slice**

```powershell
git add src/app/(app)/customer-360 src/components/crm/customer-360-workspace.tsx src/components/crm/customer-360-workspace.test.tsx
git commit -m "feat: tighten customer 360 workspace"
```

---

### Task 4: Orders Workspace

**Files:**
- Modify: `src/app/(app)/orders/page.tsx`
- Modify: `src/app/(app)/orders/[orderId]/page.tsx`
- Modify: `src/components/orders/order-list.tsx`
- Modify: `src/components/orders/order-detail.tsx`
- Modify: `src/components/orders/order-booking-form.tsx`
- Modify: `src/server/orders/queries.ts`
- Modify: `src/server/orders/mutations.ts`
- Modify: `src/server/orders/actions.ts`
- Test: `src/components/orders/order-list.test.tsx`
- Test: `src/components/orders/order-detail.test.tsx`
- Test: `src/server/orders/queries.test.ts`
- Test: `src/server/orders/mutations.test.ts`
- Test: `src/server/orders/actions.test.ts`

- [ ] **Step 1: Confirm the order list/detail contract**

Run:

```powershell
npm test -- src/components/orders/order-list.test.tsx src/components/orders/order-detail.test.tsx src/server/orders/queries.test.ts src/server/orders/mutations.test.ts src/server/orders/actions.test.ts
```

Expected: the order pages keep the current list/detail flow and booking handoff intact.

- [ ] **Step 2: Keep booking as a dedicated action path**

The order page should stay focused on booked order state, payment/reconciliation visibility, and the existing booking form. Do not pull proposal editing into orders; the order page is the handoff, not a proposal workspace.

- [ ] **Step 3: Verify the order slice**

Run:

```powershell
npm run typecheck
npm test -- src/components/orders/order-list.test.tsx src/components/orders/order-detail.test.tsx src/server/orders/queries.test.ts src/server/orders/mutations.test.ts src/server/orders/actions.test.ts
```

Expected: typecheck passes and the order module stays isolated from proposal authoring.

- [ ] **Step 4: Commit the orders slice**

```powershell
git add src/app/(app)/orders src/components/orders src/server/orders
git commit -m "feat: stabilize orders workspace"
```

---

### Task 5: Production Workspace

**Files:**
- Modify: `src/app/(app)/production/page.tsx`
- Modify: `src/app/(app)/production/[workItemId]/page.tsx`
- Modify: `src/app/(app)/admin/production-config/page.tsx`
- Modify: `src/components/production/production-board.tsx`
- Modify: `src/components/production/production-detail.tsx`
- Modify: `src/components/production/production-config.tsx`
- Modify: `src/components/production/production-stage-actions.tsx`
- Modify: `src/server/production/queries.ts`
- Modify: `src/server/production/mutations.ts`
- Modify: `src/server/production/actions.ts`
- Test: `src/components/production/production-board.test.tsx`
- Test: `src/components/production/production-detail.test.tsx`
- Test: `src/components/production/production-stage-actions.test.tsx`
- Test: `src/server/production/queries.test.ts`
- Test: `src/server/production/mutations.test.ts`
- Test: `src/server/production/actions.test.ts`

- [ ] **Step 1: Verify the board/detail/config shape**

Run:

```powershell
npm test -- src/components/production/production-board.test.tsx src/components/production/production-detail.test.tsx src/components/production/production-stage-actions.test.tsx
```

Expected: the board stays stage-oriented, the detail page stays work-item oriented, and config remains admin-only.

- [ ] **Step 2: Keep production independent from orders and proposals**

Production should show progress and stage transitions for booked work, not become a proposal editor or a second orders screen.

- [ ] **Step 3: Verify the production slice**

Run:

```powershell
npm run typecheck
npm test -- src/components/production/production-board.test.tsx src/components/production/production-detail.test.tsx src/components/production/production-stage-actions.test.tsx src/server/production/queries.test.ts src/server/production/mutations.test.ts src/server/production/actions.test.ts
```

Expected: typecheck passes and the production tests remain stable.

- [ ] **Step 4: Commit the production slice**

```powershell
git add src/app/(app)/production src/app/(app)/admin/production-config src/components/production src/server/production
git commit -m "feat: clean up production workspace"
```

---

### Task 6: Reports and Admin Surfaces

**Files:**
- Modify: `src/app/(app)/reports/page.tsx`
- Modify: `src/app/(app)/admin/settings/page.tsx`
- Modify: `src/app/(app)/admin/products/page.tsx`
- Modify: `src/app/(app)/admin/products/new/page.tsx`
- Modify: `src/app/(app)/admin/products/[productServiceId]/edit/page.tsx`
- Modify: `src/components/reports/report-formatters.ts`
- Test: `src/components/reports/report-formatters.test.ts`
- Test: `tests/e2e/reports.spec.ts`

- [ ] **Step 1: Keep reports as read-only company visibility**

Run:

```powershell
npm test -- src/components/reports/report-formatters.test.ts
```

Expected: the shared formatters stay stable and the page remains a display surface, not a workflow builder.

- [ ] **Step 2: Clean up admin surfaces without widening scope**

The admin pages should stay boring and explicit: settings, products, and production config. If a page is already correct, preserve it and only adjust the layout or labels needed for consistency.

- [ ] **Step 3: Verify the reports/admin slice**

Run:

```powershell
npm run typecheck
npm test -- src/components/reports/report-formatters.test.ts
```

Expected: typecheck passes and the reports copy/formatting continues to match the live data.

- [ ] **Step 4: Commit the reports/admin slice**

```powershell
git add src/app/(app)/reports src/app/(app)/admin src/components/reports tests/e2e/reports.spec.ts
git commit -m "feat: tighten reports and admin pages"
```

---

### Task 7: My Day Last

**Files:**
- Modify: `src/app/(app)/my-day/page.tsx`
- Modify: `src/components/sales-day/my-day-page.tsx`
- Modify: `src/components/sales-day/task-composer.tsx`
- Modify: `src/components/sales-day/task-list.tsx`
- Modify: `src/components/sales-day/task-row.tsx`
- Modify: `src/components/sales-day/voice-note-recorder.tsx`
- Modify: `src/components/sales-day/voice-note-panel.tsx`
- Modify: `src/components/sales-day/suggested-actions-panel.tsx`
- Modify: `src/components/sales-day/insights-panel.tsx`
- Modify: `src/components/sales-day/end-of-day-review.tsx`
- Modify: `src/server/sales-day/queries.ts`
- Modify: `src/server/sales-day/mutations.ts`
- Modify: `src/server/sales-day/actions.ts`
- Test: `src/components/sales-day/task-list.test.tsx`
- Test: `src/components/sales-day/voice-note-panel.test.tsx`
- Test: `src/components/sales-day/suggested-actions-panel.test.tsx`
- Test: `src/server/sales-day/queries.test.ts`
- Test: `src/server/sales-day/mutations.test.ts`
- Test: `src/server/sales-day/actions.test.ts`
- Test: `tests/e2e/my-day.spec.ts`

- [ ] **Step 1: Leave this slice untouched until everything else is green**

My Day is intentionally last because it is the most personal and the easiest place to regress if the shared CRM or fulfillment surfaces are still moving.

- [ ] **Step 2: Revisit the workspace only after the other phases pass**

At that point, tighten the daily task flow, voice note path, insights panel, and end-of-day review without dragging in unrelated CRM changes.

- [ ] **Step 3: Verify the My Day slice**

Run:

```powershell
npm run typecheck
npm test -- src/components/sales-day/task-list.test.tsx src/components/sales-day/voice-note-panel.test.tsx src/components/sales-day/suggested-actions-panel.test.tsx src/server/sales-day/queries.test.ts src/server/sales-day/mutations.test.ts src/server/sales-day/actions.test.ts
```

Expected: the workspace remains stable and the tests pass after all earlier phases are settled.

- [ ] **Step 4: Commit the My Day slice last**

```powershell
git add src/app/(app)/my-day src/components/sales-day src/server/sales-day tests/e2e/my-day.spec.ts
git commit -m "feat: finish my day workspace"
```
