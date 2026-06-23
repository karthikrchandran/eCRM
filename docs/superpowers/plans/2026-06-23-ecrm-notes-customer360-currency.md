# eCRM Notes Customer 360 Currency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add personal typed notes inside My Day, show a Customer 360 timeline on lead/customer detail, and let Admin choose INR or USD with manual USD tax entry.

**Architecture:** Add a first-class `SalesTextNote` model owned by a salesperson and optionally linked to task/customer/opportunity/proposal/order. Add a singleton `BusinessSettings` model for default currency. Keep existing integer minor-unit storage and legacy field names internally while making new UI labels currency-aware.

**Tech Stack:** Next.js App Router, React server actions, Prisma, Vitest, Testing Library.

---

### Task 1: Red Tests

**Files:**
- Modify: `src/server/sales-day/queries.test.ts`
- Modify: `src/server/sales-day/mutations.test.ts`
- Modify: `src/server/crm/queries.test.ts`
- Create: `src/server/settings/settings.test.ts`
- Modify: `src/server/proposals/calculations.test.ts`
- Modify: `src/server/proposals/mutations.test.ts`

- [ ] Write tests proving My Day loads owner/date-scoped text notes, note mutations enforce ownership, Customer 360 builds a mixed timeline, settings default to INR and update to USD, and USD proposal lines accept manual tax.
- [ ] Run focused tests and confirm they fail because the new exports/models are missing.

### Task 2: Schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260623000100_add_sales_text_notes_and_business_settings/migration.sql`

- [ ] Add `CurrencyCode`, `BusinessSettings`, and `SalesTextNote`.
- [ ] Link `SalesTextNote` to `User`, `SalesTask`, `LeadCustomer`, `Opportunity`, `Proposal`, and `Order`.
- [ ] Generate Prisma client.

### Task 3: My Day Typed Notes

**Files:**
- Modify: `src/server/sales-day/types.ts`
- Modify: `src/server/sales-day/validators.ts`
- Modify: `src/server/sales-day/mutations.ts`
- Modify: `src/server/sales-day/actions.ts`
- Modify: `src/server/sales-day/queries.ts`
- Create: `src/components/sales-day/text-note-composer.tsx`
- Create: `src/components/sales-day/text-note-panel.tsx`
- Modify: `src/components/sales-day/my-day-page.tsx`

- [ ] Add create/update/delete server APIs and actions for typed notes.
- [ ] Add typed notes to `loadMyDay`.
- [ ] Render a simple My Day-only notes composer and editable list.

### Task 4: Customer 360 Timeline

**Files:**
- Modify: `src/server/crm/queries.ts`
- Create: `src/components/crm/customer-timeline.tsx`
- Modify: `src/app/(app)/leads/[leadId]/page.tsx`

- [ ] Build a mixed customer timeline from CRM activities, typed notes, voice notes, opportunities, proposals, orders, production, invoices, payments, and costs.
- [ ] Render the timeline on the lead/customer detail page.

### Task 5: Currency Settings And USD Manual Tax

**Files:**
- Create: `src/server/settings/*`
- Create: `src/components/settings/business-settings-form.tsx`
- Create: `src/app/(app)/admin/settings/page.tsx`
- Modify: `src/components/app-shell.tsx`
- Modify: `src/server/proposals/*`
- Modify: `src/components/proposals/*`

- [ ] Add Admin settings page for default currency.
- [ ] Use the configured currency when creating proposals.
- [ ] For USD, collect manual tax amount per line and store it in existing tax total fields.
- [ ] Update proposal UI labels to show currency-aware minor-unit wording.

### Task 6: Verification

- [ ] Run focused Vitest files.
- [ ] Run `npx prisma validate`.
- [ ] Run `npm run typecheck`, `npm run lint`, and broader test/build gates as time allows.
