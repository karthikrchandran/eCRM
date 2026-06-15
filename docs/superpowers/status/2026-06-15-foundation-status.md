# eCRM Foundation Status

Date: 2026-06-15

## Completed

- Next.js App Router project baseline.
- TypeScript, ESLint, Vitest, Playwright, and Tailwind.
- Postgres configuration through Docker Compose, with local PostgreSQL fallback used in verification.
- Prisma schema, migration, and User model with Admin and Sales roles.
- Seeded Admin and Sales users.
- Internal email/password login.
- Signed session cookie and hardened JWT policy.
- Protected dashboard shell.
- Admin/Sales permission helpers.
- Browser smoke test for login.

## Verification Evidence

Current branch: `main`

- `npm run gate` passed.
- `npm run test:e2e` passed with 2 tests.
- `npm audit --audit-level=low` passed with 0 vulnerabilities.
- `npx prisma validate` passed.
- `npx prisma generate` passed.
- Docker was unavailable on `PATH`, so verification used the local PostgreSQL fallback on port `54329`; runtime migration, seed, and e2e checks passed against it.

## Known Non-Blocking Warnings

- npm prints an `always-auth` user config warning in this environment.
- Prisma prints a seed config deprecation warning for future Prisma 7 behavior.

## Next Plan

The next implementation plan should cover CRM core records:

- Leads/customers.
- Branches.
- Contacts.
- Activities and follow-ups.
- Ownership and reassignment.
- Company-wide visibility for Sales.
