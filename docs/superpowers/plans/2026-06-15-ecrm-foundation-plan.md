# eCRM Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the local foundation for the eCRM app: Next.js, TypeScript, tests, Prisma/Postgres, internal auth, Admin/Sales roles, seeded users, protected dashboard shell, and verification gates.

**Architecture:** This slice creates a modular monolith foundation in one Next.js App Router project. It does not implement leads, opportunities, proposals, orders, payments, production, or reports; it creates the app, database, auth, layout, and gate structure those modules will build on.

**Tech Stack:** Next.js 16.2.9, React 19.2.7, TypeScript 6.0.3, Postgres, Prisma 6.19.3, Tailwind CSS 4.3.1, Vitest 4.1.8, Playwright 1.60.0, bcryptjs, jose, zod.

---

## Scope Boundaries

This plan implements only foundation slice 1 from `docs/superpowers/specs/2026-06-15-ecrm-design.md`.

The remaining CRM modules will get separate plans:

1. CRM core: leads/customers, branches, contacts, activities, ownership/reassignment.
2. Opportunities and pipeline: configurable stages, list/board views, targets.
3. Products/services and proposals: catalog, GST defaults, proposal summaries, PDF uploads.
4. Orders and production: PO/order records, line items, production templates/instances.
5. Invoices and payments: invoice records, installments, cumulative order payment tracking.
6. Costs and incentives: cost components, gross margin, 5% incentive, split support, Admin approval.
7. Reports and dashboards: sales progress, pipeline, orders, payments, production, incentives.
8. CSV import and responsive hardening.

## Foundation File Structure

Create these files in this slice:

- `package.json`: npm scripts and pinned package versions.
- `tsconfig.json`: TypeScript configuration where `@/*` maps to `./src/*` without `baseUrl`, uses Next 16's `react-jsx` setting, and includes both `.next/types/**/*.ts` and `.next/dev/types/**/*.ts`.
- `next.config.ts`: Next.js config.
- `eslint.config.mjs`: flat ESLint config using Next presets.
- `postcss.config.mjs`: Tailwind PostCSS plugin.
- `vitest.config.ts`: unit/component test config.
- `playwright.config.ts`: local browser smoke config.
- `.env.example`: documented local environment variables.
- `docker-compose.yml`: local Postgres service.
- `prisma/schema.prisma`: User model and role enum.
- `prisma/seed.ts`: seeded Admin and Sales users.
- `src/app/globals.css`: base application styling.
- `src/app/layout.tsx`: root HTML layout.
- `src/app/page.tsx`: root redirect.
- `src/app/(auth)/login/page.tsx`: login page.
- `src/app/(auth)/login/login-form.tsx`: client login form.
- `src/app/(app)/layout.tsx`: protected app layout.
- `src/app/(app)/dashboard/page.tsx`: protected dashboard.
- `src/components/app-shell.tsx`: authenticated shell/navigation.
- `src/server/db.ts`: Prisma singleton.
- `src/server/env.ts`: server env validation.
- `src/server/auth/password.ts`: password hashing/verification.
- `src/server/auth/session.ts`: signed session token utilities.
- `src/server/auth/permissions.ts`: Admin/Sales permission helpers.
- `src/server/auth/current-user.ts`: authenticated user lookup.
- `src/server/auth/actions.ts`: login/logout server actions.
- `src/server/auth/*.test.ts`: auth and permission tests.
- `src/test/setup.ts`: Vitest setup.
- `tests/e2e/auth.spec.ts`: login smoke test.

Every task ends with a local gate and a commit.

---

### Task 1: Project Tooling Baseline

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `eslint.config.mjs`
- Create: `postcss.config.mjs`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Verify the current repo has no app tooling**

Run:

```powershell
git status --short --branch
npm run gate
```

Expected:

```text
## main
npm error code ENOENT
npm error Could not read package.json
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "ecrm",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --max-warnings=0",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:seed": "tsx prisma/seed.ts",
    "gate": "npm run typecheck && npm run lint && npm run test && npm run build"
  },
  "dependencies": {
    "@prisma/client": "6.19.3",
    "bcryptjs": "3.0.3",
    "clsx": "2.1.1",
    "jose": "6.2.3",
    "next": "16.2.9",
    "react": "19.2.7",
    "react-dom": "19.2.7",
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "@playwright/test": "1.60.0",
    "@tailwindcss/postcss": "4.3.1",
    "@testing-library/dom": "10.4.1",
    "@testing-library/jest-dom": "6.9.1",
    "@testing-library/react": "16.3.2",
    "@types/node": "25.9.3",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    "eslint": "10.5.0",
    "eslint-config-next": "16.2.9",
    "jsdom": "29.1.1",
    "postcss": "8.5.15",
    "prisma": "6.19.3",
    "tailwindcss": "4.3.1",
    "tsx": "4.22.4",
    "typescript": "6.0.3",
    "vitest": "4.1.8"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

- [ ] **Step 3: Create TypeScript and framework config files**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": [
      "dom",
      "dom.iterable",
      "es2022"
    ],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": [
        "./src/*"
      ]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts"
  ],
  "exclude": [
    "node_modules"
  ]
}
```

Create `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

Create `eslint.config.mjs`:

```js
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", "node_modules/**", "coverage/**", "playwright-report/**"]
  }
];

export default eslintConfig;
```

Create `postcss.config.mjs`:

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {}
  }
};

export default config;
```

Create `vitest.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"]
    }
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  }
});
```

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  use: {
    baseURL: process.env.APP_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry"
  },
  webServer: {
    command: "npm run dev",
    url: process.env.APP_BASE_URL ?? "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
```

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Install dependencies**

Run:

```powershell
npm install
```

Expected:

```text
added ... packages
found 0 vulnerabilities
```

If npm prints the existing local `always-auth` warning, keep going; it is unrelated to this repo.

- [ ] **Step 5: Run the first tooling gate**

Run:

```powershell
npm run typecheck
npm run lint
npm run test
```

Expected:

```text
tsc --noEmit exits 0
eslint exits 0
vitest exits 0 with no test files or passes the empty suite
```

- [ ] **Step 6: Commit tooling baseline**

```powershell
git add package.json package-lock.json tsconfig.json next.config.ts eslint.config.mjs postcss.config.mjs vitest.config.ts playwright.config.ts src/test/setup.ts
git commit -m "chore: add Next.js tooling baseline"
```

---

### Task 2: Minimal App Shell

**Files:**
- Create: `src/app/globals.css`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`

- [ ] **Step 1: Write a failing build check**

Run:

```powershell
npm run build
```

Expected:

```text
Failed to compile
Next.js cannot find a root app layout or page
```

- [ ] **Step 2: Create base styles**

Create `src/app/globals.css`:

```css
@import "tailwindcss";

:root {
  --background: #f7f8fa;
  --foreground: #17181c;
  --muted: #667085;
  --border: #d9dee8;
  --panel: #ffffff;
  --accent: #126b5f;
  --accent-strong: #0f5149;
}

* {
  box-sizing: border-box;
}

html,
body {
  min-height: 100%;
}

body {
  margin: 0;
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}

a {
  color: inherit;
  text-decoration: none;
}

button,
input,
select,
textarea {
  font: inherit;
}

.surface {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
}
```

- [ ] **Step 3: Create root layout and root page**

Create `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "eCRM",
  description: "Small-team lead-to-cash CRM"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

Create `src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/dashboard");
}
```

- [ ] **Step 4: Verify the app shell builds**

Run:

```powershell
npm run typecheck
npm run lint
npm run build
```

Expected:

```text
typecheck exits 0
lint exits 0
next build exits 0
```

- [ ] **Step 5: Commit minimal app shell**

```powershell
git add src/app/globals.css src/app/layout.tsx src/app/page.tsx
git commit -m "feat: add minimal app shell"
```

---

### Task 3: Database Schema And Seed Users

**Files:**
- Create: `.env.example`
- Create: `docker-compose.yml`
- Create: `prisma/schema.prisma`
- Create: `prisma/seed.ts`
- Create: `src/server/db.ts`
- Create: `src/server/env.ts`

- [ ] **Step 1: Create local environment and database files**

Create `.env.example`:

```dotenv
DATABASE_URL="postgresql://ecrm:ecrm@localhost:54329/ecrm?schema=public"
AUTH_SECRET="replace-with-at-least-32-characters-for-local-dev"
APP_BASE_URL="http://localhost:3000"
SEED_ADMIN_EMAIL="admin@example.com"
SEED_ADMIN_PASSWORD="Admin@12345"
SEED_SALES_EMAIL="sales@example.com"
SEED_SALES_PASSWORD="Sales@12345"
```

Create `docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: ecrm-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ecrm
      POSTGRES_PASSWORD: ecrm
      POSTGRES_DB: ecrm
    ports:
      - "54329:5432"
    volumes:
      - ecrm-postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ecrm -d ecrm"]
      interval: 5s
      timeout: 5s
      retries: 20

volumes:
  ecrm-postgres-data:
```

- [ ] **Step 2: Create Prisma schema**

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  ADMIN
  SALES
}

model User {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  passwordHash String
  role         UserRole @default(SALES)
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

- [ ] **Step 3: Create server env and Prisma client helpers**

Create `src/server/env.ts`:

```ts
import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
  APP_BASE_URL: z.string().url().default("http://localhost:3000")
});

export function getServerEnv() {
  return serverEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    APP_BASE_URL: process.env.APP_BASE_URL
  });
}
```

Create `src/server/db.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
```

- [ ] **Step 4: Create seed script**

Create `prisma/seed.ts`:

```ts
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function upsertUser(input: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}) {
  const passwordHash = await bcrypt.hash(input.password, 12);

  await prisma.user.upsert({
    where: { email: input.email },
    update: {
      name: input.name,
      passwordHash,
      role: input.role,
      active: true
    },
    create: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
      active: true
    }
  });
}

async function main() {
  await upsertUser({
    name: "Admin User",
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@example.com",
    password: process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345",
    role: UserRole.ADMIN
  });

  await upsertUser({
    name: "Sales User",
    email: process.env.SEED_SALES_EMAIL ?? "sales@example.com",
    password: process.env.SEED_SALES_PASSWORD ?? "Sales@12345",
    role: UserRole.SALES
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 5: Create local `.env.local` from example**

Run:

```powershell
Copy-Item -LiteralPath .env.example -Destination .env.local -Force
```

Expected:

```text
.env.local exists and is ignored by git
```

- [ ] **Step 6: Start Postgres and apply the first migration**

Run:

```powershell
docker compose up -d db
npm run prisma:generate
npm run prisma:migrate -- --name init_users
npm run prisma:seed
```

Expected:

```text
Postgres container is healthy
Prisma Client generated
Migration init_users applied
Seed script exits 0
```

- [ ] **Step 7: Verify generated and committed files**

Run:

```powershell
npm run typecheck
npm run lint
npm run test
git status --short
```

Expected:

```text
typecheck exits 0
lint exits 0
test exits 0
git shows schema, migration, seed, env example, compose, and server helper files
```

- [ ] **Step 8: Commit database foundation**

```powershell
git add .env.example docker-compose.yml prisma src/server/db.ts src/server/env.ts
git commit -m "feat: add database foundation and seed users"
```

---

### Task 4: Auth Domain Utilities

**Files:**
- Create: `src/server/auth/password.test.ts`
- Create: `src/server/auth/password.ts`
- Create: `src/server/auth/session.test.ts`
- Create: `src/server/auth/session.ts`
- Create: `src/server/auth/permissions.test.ts`
- Create: `src/server/auth/permissions.ts`

- [ ] **Step 1: Write failing password tests**

Create `src/server/auth/password.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password utilities", () => {
  it("verifies the original password against its hash", async () => {
    const hash = await hashPassword("Admin@12345");

    await expect(verifyPassword("Admin@12345", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("Admin@12345");

    await expect(verifyPassword("WrongPassword", hash)).resolves.toBe(false);
  });
});
```

Run:

```powershell
npm run test -- src/server/auth/password.test.ts
```

Expected:

```text
FAIL src/server/auth/password.test.ts
Cannot find module './password'
```

- [ ] **Step 2: Implement password utilities**

Create `src/server/auth/password.ts`:

```ts
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}
```

Run:

```powershell
npm run test -- src/server/auth/password.test.ts
```

Expected:

```text
PASS src/server/auth/password.test.ts
```

- [ ] **Step 3: Write failing session tests**

Create `src/server/auth/session.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { signSession, verifySessionToken } from "./session";

const secret = "12345678901234567890123456789012";

describe("session utilities", () => {
  it("round-trips a signed session token", async () => {
    const token = await signSession(
      {
        id: "user_1",
        email: "admin@example.com",
        name: "Admin User",
        role: "ADMIN"
      },
      secret
    );

    await expect(verifySessionToken(token, secret)).resolves.toMatchObject({
      id: "user_1",
      email: "admin@example.com",
      name: "Admin User",
      role: "ADMIN"
    });
  });

  it("returns null for an invalid token", async () => {
    await expect(verifySessionToken("not-a-token", secret)).resolves.toBeNull();
  });
});
```

Run:

```powershell
npm run test -- src/server/auth/session.test.ts
```

Expected:

```text
FAIL src/server/auth/session.test.ts
Cannot find module './session'
```

- [ ] **Step 4: Implement session utilities**

Create `src/server/auth/session.ts`:

```ts
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { getServerEnv } from "@/server/env";

export const SESSION_COOKIE_NAME = "ecrm_session";

const sessionUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["ADMIN", "SALES"])
});

export type SessionUser = z.infer<typeof sessionUserSchema>;

function encodeSecret(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function signSession(user: SessionUser, secret = getServerEnv().AUTH_SECRET) {
  return new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(encodeSecret(secret));
}

export async function verifySessionToken(token: string, secret = getServerEnv().AUTH_SECRET) {
  try {
    const { payload } = await jwtVerify(token, encodeSecret(secret));
    return sessionUserSchema.parse(payload);
  } catch {
    return null;
  }
}
```

Run:

```powershell
npm run test -- src/server/auth/session.test.ts
```

Expected:

```text
PASS src/server/auth/session.test.ts
```

- [ ] **Step 5: Write failing permission tests**

Create `src/server/auth/permissions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  canApproveIncentives,
  canFinalizeCosts,
  canManageAdminSettings,
  canViewCompanyRecords
} from "./permissions";

describe("permissions", () => {
  it("allows both roles to view company records", () => {
    expect(canViewCompanyRecords("ADMIN")).toBe(true);
    expect(canViewCompanyRecords("SALES")).toBe(true);
  });

  it("limits admin settings, cost finalization, and incentive approval to Admin", () => {
    expect(canManageAdminSettings("ADMIN")).toBe(true);
    expect(canFinalizeCosts("ADMIN")).toBe(true);
    expect(canApproveIncentives("ADMIN")).toBe(true);

    expect(canManageAdminSettings("SALES")).toBe(false);
    expect(canFinalizeCosts("SALES")).toBe(false);
    expect(canApproveIncentives("SALES")).toBe(false);
  });
});
```

Run:

```powershell
npm run test -- src/server/auth/permissions.test.ts
```

Expected:

```text
FAIL src/server/auth/permissions.test.ts
Cannot find module './permissions'
```

- [ ] **Step 6: Implement permission helpers**

Create `src/server/auth/permissions.ts`:

```ts
import type { UserRole } from "@prisma/client";

export function canViewCompanyRecords(role: UserRole) {
  return role === "ADMIN" || role === "SALES";
}

export function canManageAdminSettings(role: UserRole) {
  return role === "ADMIN";
}

export function canFinalizeCosts(role: UserRole) {
  return role === "ADMIN";
}

export function canApproveIncentives(role: UserRole) {
  return role === "ADMIN";
}
```

Run:

```powershell
npm run test -- src/server/auth/password.test.ts src/server/auth/session.test.ts src/server/auth/permissions.test.ts
```

Expected:

```text
PASS src/server/auth/password.test.ts
PASS src/server/auth/session.test.ts
PASS src/server/auth/permissions.test.ts
```

- [ ] **Step 7: Run foundation gate and commit**

Run:

```powershell
npm run typecheck
npm run lint
npm run test
```

Expected:

```text
typecheck exits 0
lint exits 0
test exits 0
```

Commit:

```powershell
git add src/server/auth
git commit -m "feat: add auth domain utilities"
```

---

### Task 5: Login, Logout, And Protected Dashboard

**Files:**
- Create: `src/server/auth/current-user.ts`
- Create: `src/server/auth/actions.ts`
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/login/login-form.tsx`
- Create: `src/app/(app)/layout.tsx`
- Create: `src/app/(app)/dashboard/page.tsx`
- Create: `src/components/app-shell.tsx`

- [ ] **Step 1: Write a failing route check**

Run:

```powershell
npm run build
```

Expected:

```text
Build succeeds, but /login and /dashboard are not implemented yet
```

This is a route-coverage failure for the foundation slice.

- [ ] **Step 2: Implement current user lookup**

Create `src/server/auth/current-user.ts`:

```ts
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./session";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await verifySessionToken(token);

  if (!session) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true
    }
  });

  if (!user?.active) {
    return null;
  }

  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
```

- [ ] **Step 3: Implement login and logout actions**

Create `src/server/auth/actions.ts`:

```ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { verifyPassword } from "./password";
import { SESSION_COOKIE_NAME, signSession } from "./session";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password.")
});

export type LoginState = {
  error?: string;
};

export async function loginAction(_previousState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your login details." };
  }

  const user = await db.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() }
  });

  if (!user?.active) {
    return { error: "Invalid email or password." };
  }

  const validPassword = await verifyPassword(parsed.data.password, user.passwordHash);

  if (!validPassword) {
    return { error: "Invalid email or password." };
  }

  const token = await signSession({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  });

  redirect("/dashboard");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
```

- [ ] **Step 4: Implement login UI**

Create `src/app/(auth)/login/login-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/server/auth/actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="surface mx-auto flex w-full max-w-sm flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Access the eCRM workspace.</p>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Email
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Password
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>

      {state.error ? <p className="text-sm font-medium text-red-700">{state.error}</p> : null}

      <button
        className="rounded-md bg-[var(--accent)] px-4 py-2 font-semibold text-white disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
```

Create `src/app/(auth)/login/page.tsx`:

```tsx
import { getCurrentUser } from "@/server/auth/current-user";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <LoginForm />
    </main>
  );
}
```

- [ ] **Step 5: Implement protected app shell**

Create `src/components/app-shell.tsx`:

```tsx
import Link from "next/link";
import type { UserRole } from "@prisma/client";
import { logoutAction } from "@/server/auth/actions";

type AppShellProps = {
  user: {
    name: string;
    email: string;
    role: UserRole;
  };
  children: React.ReactNode;
};

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/orders", label: "Orders" },
  { href: "/reports", label: "Reports" }
];

export function AppShell({ user, children }: AppShellProps) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <Link className="text-lg font-semibold" href="/dashboard">
              eCRM
            </Link>
            <p className="text-xs text-[var(--muted)]">Lead-to-cash workspace</p>
          </div>
          <nav className="hidden items-center gap-3 text-sm md:flex">
            {navItems.map((item) => (
              <Link className="rounded-md px-2 py-1 hover:bg-slate-100" href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <div className="hidden text-right sm:block">
              <p className="font-medium">{user.name}</p>
              <p className="text-xs text-[var(--muted)]">{user.role}</p>
            </div>
            <form action={logoutAction}>
              <button className="rounded-md border border-[var(--border)] px-3 py-2" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
```

Create `src/app/(app)/layout.tsx`:

```tsx
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/server/auth/current-user";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return <AppShell user={user}>{children}</AppShell>;
}
```

Create `src/app/(app)/dashboard/page.tsx`:

```tsx
import { requireUser } from "@/server/auth/current-user";

const cards = [
  { label: "Open opportunities", value: "0" },
  { label: "Upcoming follow-ups", value: "0" },
  { label: "Booked value", value: "INR 0" },
  { label: "Pending payments", value: "INR 0" },
  { label: "Production pending", value: "0" },
  { label: "Incentives pending", value: "INR 0" }
];

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Signed in as {user.name}. Foundation metrics are ready for CRM modules.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <article className="surface p-4" key={card.label}>
            <p className="text-sm text-[var(--muted)]">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold">{card.value}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 6: Verify protected routes compile**

Run:

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
```

Expected:

```text
typecheck exits 0
lint exits 0
test exits 0
build exits 0
```

- [ ] **Step 7: Commit login and protected dashboard**

```powershell
git add src/server/auth/current-user.ts src/server/auth/actions.ts src/app src/components
git commit -m "feat: add internal login and protected dashboard"
```

---

### Task 6: Browser Smoke Gate

**Files:**
- Create: `tests/e2e/auth.spec.ts`

- [ ] **Step 1: Install Playwright browser dependencies**

Run:

```powershell
npx playwright install chromium
```

Expected:

```text
Chromium browser installed or already present
```

- [ ] **Step 2: Write smoke test**

Create `tests/e2e/auth.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("seeded admin can sign in and see the dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Password").fill("Admin@12345");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Open opportunities")).toBeVisible();
  await expect(page.getByText("Pending payments")).toBeVisible();
  await expect(page.getByText("Production pending")).toBeVisible();
});

test("invalid login shows a safe error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Invalid email or password.")).toBeVisible();
});
```

- [ ] **Step 3: Run the smoke test**

Run:

```powershell
npm run test:e2e
```

Expected:

```text
2 passed
```

If the first run fails because the database is empty, run:

```powershell
npm run prisma:seed
npm run test:e2e
```

Expected:

```text
2 passed
```

- [ ] **Step 4: Run the full local gate**

Run:

```powershell
npm run gate
npm run test:e2e
git status --short --branch
```

Expected:

```text
typecheck exits 0
lint exits 0
unit tests pass
build exits 0
e2e tests pass
git shows only tests/e2e/auth.spec.ts as uncommitted
```

- [ ] **Step 5: Commit browser smoke gate**

```powershell
git add tests/e2e/auth.spec.ts playwright.config.ts
git commit -m "test: add auth browser smoke"
```

---

### Task 7: Foundation Documentation And Status Check

**Files:**
- Create: `docs/superpowers/status/2026-06-15-foundation-status.md`
- Modify: `README.md`

- [ ] **Step 1: Create README**

Create `README.md`:

```md
# eCRM

Single-company CRM for a small sales organization.

## Local Development

1. Install dependencies.

   ```powershell
   npm install
   ```

2. Create local environment.

   ```powershell
   Copy-Item -LiteralPath .env.example -Destination .env.local -Force
   ```

3. Start local Postgres.

   ```powershell
   docker compose up -d db
   ```

4. Apply database migration and seed users.

   ```powershell
   npm run prisma:migrate -- --name init_users
   npm run prisma:seed
   ```

5. Start the app.

   ```powershell
   npm run dev
   ```

6. Open `http://localhost:3000`.

## Seeded Local Users

- Admin: `admin@example.com` / `Admin@12345`
- Sales: `sales@example.com` / `Sales@12345`

## Gates

Run the local quality gate before every completion claim.

```powershell
npm run gate
npm run test:e2e
```

## Product Design

See `docs/superpowers/specs/2026-06-15-ecrm-design.md`.
```

- [ ] **Step 2: Create foundation status document**

Create `docs/superpowers/status/2026-06-15-foundation-status.md`:

```md
# eCRM Foundation Status

Date: 2026-06-15

## Completed

- Next.js App Router project baseline.
- TypeScript, ESLint, Vitest, Playwright, Tailwind.
- Local Postgres via Docker Compose.
- Prisma schema with User and Admin/Sales roles.
- Seeded Admin and Sales users.
- Internal email/password login.
- Signed session cookie.
- Protected dashboard shell.
- Admin/Sales permission helpers.
- Browser smoke test for login.

## Verification

Run from `c:\My Workspace\eCRM`:

```powershell
npm run gate
npm run test:e2e
git status --short --branch
```

Expected:

```text
typecheck passes
lint passes
unit tests pass
build passes
browser smoke passes
working tree is clean on main
```

## Next Plan

The next implementation plan should cover CRM core records:

- leads/customers
- branches
- contacts
- activities/follow-ups
- ownership and reassignment
- company-wide visibility for Sales
```

- [ ] **Step 3: Run final foundation verification**

Run:

```powershell
npm run gate
npm run test:e2e
git status --short --branch
```

Expected:

```text
typecheck exits 0
lint exits 0
unit tests pass
build exits 0
e2e tests pass
git shows README.md and status doc as uncommitted
```

- [ ] **Step 4: Commit documentation**

```powershell
git add README.md docs/superpowers/status/2026-06-15-foundation-status.md
git commit -m "docs: add foundation setup and status"
```

---

## Completion Gate

After all tasks are complete, run:

```powershell
npm run gate
npm run test:e2e
git status --short --branch
git log --oneline -5
```

Expected:

```text
typecheck exits 0
lint exits 0
unit tests pass
build exits 0
browser smoke passes
working tree is clean on main
recent commits show the foundation slice commits
```

Do not claim the foundation is complete unless every command above has been run in the current workspace and passed.

## Self-Review Notes

- Spec coverage for this plan is intentionally limited to the foundation implementation slice.
- This plan creates the app, local database, auth, users, roles, dashboard shell, gates, smoke test, and docs required before CRM feature modules.
- CRM business records are excluded from this plan and are listed as the next planned slice.
