# Tenant Onboarding and Demo Users Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tenant-local ARA/AI demo user bootstrap and a platform-admin UI for future customer-cell onboarding.

**Architecture:** Keep the platform control plane and each customer cell separate. A tenant seed command validates deployment-derived identity and upserts only local users/configuration; a platform-mode page calls the existing bearer-protected provisioning API without creating a second auth system.

**Tech Stack:** Next.js App Router, React, Prisma, bcryptjs, Vitest, Zod, TypeScript.

---

### Task 1: Tenant fixtures and seed validation

**Files:**
- Create: `prisma/tenant-seed-fixtures.ts`
- Create: `prisma/tenant-seed.ts`
- Create: `prisma/tenant-seed.test.ts`
- Modify: `package.json`

- [ ] Write tests for ARA/AI fixture isolation, supported tenant keys, and rejection when `APP_MODE` is not `cell` or identity/database settings are missing.
- [ ] Run `npm test -- prisma/tenant-seed.test.ts` and observe the expected missing-module failures.
- [ ] Implement typed fixtures, pure validation, Prisma user/configuration upserts, bcrypt hashing, and `prisma:seed:tenant`.
- [ ] Re-run the focused tests and typecheck.

### Task 2: Platform onboarding console

**Files:**
- Create: `src/components/platform/customer-cell-onboarding-panel.tsx`
- Create: `src/components/platform/customer-cell-onboarding-panel.test.tsx`
- Create: `src/app/platform/cells/page.tsx`

- [ ] Write a failing component test for submitting a valid provisioning request with a runtime bearer token and rendering API errors.
- [ ] Run the focused component test and observe the expected missing-module failure.
- [ ] Implement the form for cell identity, legal/display name, region, subdomain, plan/modules, initial admin email, idempotency/correlation/reason, and a cells list refresh.
- [ ] Ensure the token is never rendered into DOM and is sent only as `Authorization: Bearer ...` to `/api/platform/cells`.
- [ ] Re-run component tests and typecheck.

### Task 3: Operations documentation

**Files:**
- Modify: `docs/operations/customer-cell-onboarding.md`

- [ ] Document platform-admin onboarding through `/platform/cells`, ARA/AI seed commands, expected demo login identities, adding later users from the tenant Admin Settings page, and production secret/password handling.
- [ ] Include explicit commands that target one cell database at a time and explain that `npm run prisma:seed` remains destructive/demo-only.

### Task 4: Verification

- [ ] Run `npm test -- prisma/tenant-seed.test.ts src/components/platform/customer-cell-onboarding-panel.test.tsx`.
- [ ] Run `npm run typecheck` and `npm run lint`.
- [ ] Run the full `npm test` suite and report any unrelated pre-existing failures honestly.
- [ ] Run `git diff --check` and inspect the final diff before committing.
