# Pilot Form Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent entry loss in the CRM pilot, filter branches by customer, and allow contacts to be edited.

**Architecture:** Keep authoritative validation and mutations on the server. Add small client-only draft and unsaved-navigation guards to the form components; drafts are keyed to the page/form identity and cleared only after a confirmed successful action. Contact editing reuses the current CRM validation and permission layer.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Prisma, Zod, Vitest, Playwright.

---

### Task 1: Customer-scoped branch selection

**Files:**
- Modify: `src/components/opportunities/opportunity-form.tsx`
- Test: `src/components/opportunities/opportunity-form.test.tsx`

- [ ] Write a failing component test showing that branches from another customer are not rendered after a customer is selected.
- [ ] Run `npm test -- src/components/opportunities/opportunity-form.test.tsx` and confirm the assertion fails.
- [ ] Store the selected customer in component state, render only its branches, and clear a no-longer-valid branch selection.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Contact editing

**Files:**
- Modify: `src/server/crm/types.ts`, `src/server/crm/mutations.ts`, `src/server/crm/actions.ts`
- Modify: `src/components/crm/contact-form.tsx`, `src/components/crm/contact-detail.tsx`
- Create: `src/app/(app)/contacts/[contactId]/edit/page.tsx`
- Test: `src/server/crm/mutations.test.ts`, `src/server/crm/actions.test.ts`, `src/components/crm/contact-form.test.tsx`

- [ ] Write failing tests for parsing an edit request and persisting a validated contact update.
- [ ] Run the focused CRM tests and confirm they fail because update support is absent.
- [ ] Add the update mutation/action, route, prefilled form values, and Edit contact link.
- [ ] Re-run focused tests and confirm they pass.

### Task 3: Form-loss protection and diagnostics

**Files:**
- Create: `src/components/forms/use-form-draft.ts`
- Modify: `src/components/crm/activity-form.tsx`, `src/components/crm/contact-form.tsx`, `src/components/opportunities/opportunity-form.tsx`, `src/components/sales-day/task-composer.tsx`, `src/components/sales-day/task-edit-form.tsx`
- Test: `src/components/forms/use-form-draft.test.tsx`
- Test: `tests/e2e/crm-core.spec.ts`, `tests/e2e/opportunities.spec.ts`, `tests/e2e/my-day.spec.ts`

- [ ] Write failing hook tests for saving a changed field to session storage, restoring it after remount, and clearing it only on explicit success.
- [ ] Run the focused test and confirm it fails because the hook does not exist.
- [ ] Implement the hook with `beforeunload` protection and form-level restore messaging; apply it to pilot data-entry forms.
- [ ] Add E2E assertions for filtered branches, contact editing, and draft survival through a reload.
- [ ] Run focused tests and then `npm run typecheck`, `npm run lint`, `npm test`, and relevant Playwright specs.
