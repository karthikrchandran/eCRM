# eCRM Demo Cell Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden ARA Global and AI Consulting demo-cell verification for the current Vercel and Supabase deployment path.

**Architecture:** Add a small server-side contract validator that checks one deployment environment against the approved demo-cell identities and reports blocking errors plus operator warnings. Expose it through a `npm run verify:demo-cell` script, then update the Vercel/Supabase deployment runbook so operators can verify each cell before seeding, deploying, or wiring SignalLoop.

**Tech Stack:** TypeScript, Vitest, tsx, Prisma tenant seed fixtures, Next.js/Vercel environment variables, Supabase PostgreSQL.

---

## File Structure

- Create `src/server/deployment/demo-cell-contract.ts`
  - Owns the approved demo-cell environment contract and pure validation function.
  - Returns structured `errors`, `warnings`, and normalized `cell` metadata.
- Create `src/server/deployment/demo-cell-contract.test.ts`
  - Verifies ARA/AI success cases, cross-cell mixups, missing durable storage warnings, production auth checks, and SignalLoop destination checks.
- Create `src/scripts/verify-demo-cell.ts`
  - CLI entry point for operators and CI-like manual checks.
  - Exits non-zero only when blocking errors exist.
- Modify `package.json`
  - Adds `verify:demo-cell`.
- Modify `deploymentplan.md`
  - Adds the verification command before migration/seed/deploy steps.
- Modify `docs/operations/customer-cell-onboarding.md`
  - Adds a demo-cell verification section and clarifies the Vercel/Supabase path.

---

### Task 1: Add Pure Demo-Cell Contract Validation

**Files:**
- Create: `src/server/deployment/demo-cell-contract.ts`
- Create: `src/server/deployment/demo-cell-contract.test.ts`

- [ ] **Step 1: Write failing tests**

Add `src/server/deployment/demo-cell-contract.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { validateDemoCellContract } from "./demo-cell-contract";

const baseAraEnv = {
  APP_MODE: "cell",
  CELL_ID: "cell_ara_global",
  CELL_KEY: "ara-global",
  TENANT_SEED: "ara-global",
  DATABASE_URL: "postgresql://postgres:secret@db.ara.supabase.co:5432/postgres",
  AUTH_SECRET: "a".repeat(32),
  APP_BASE_URL: "https://ecrm-ara-global-demo.vercel.app",
  AUTH_MODE: "oidc",
  BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_ara",
  INTEGRATION_DESTINATION_URL: "https://signalloop-ara.example.com",
  INTEGRATION_DESTINATION_INSTALLATION: "workspace_ara_global",
  INTEGRATION_DESTINATION_TOKEN: "signalloop-delivery-token"
};

describe("validateDemoCellContract", () => {
  it("accepts a complete ARA Global demo-cell contract", () => {
    const result = validateDemoCellContract(baseAraEnv);

    expect(result.ok).toBe(true);
    expect(result.cell).toEqual({
      key: "ara-global",
      cellId: "cell_ara_global",
      displayName: "ARA Global"
    });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("rejects cross-cell identity mixups before deployment or seeding", () => {
    const result = validateDemoCellContract({
      ...baseAraEnv,
      CELL_ID: "cell_ai_consulting"
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("CELL_ID must be cell_ara_global for ara-global.");
  });

  it("warns when durable Vercel Blob storage is not configured", () => {
    const { BLOB_READ_WRITE_TOKEN: _token, ...withoutBlob } = baseAraEnv;

    const result = validateDemoCellContract(withoutBlob);

    expect(result.ok).toBe(true);
    expect(result.warnings).toContain("BLOB_READ_WRITE_TOKEN is not configured; durable deployed voice-note audio storage is not proven.");
  });

  it("rejects production local-test auth for demo deployments", () => {
    const result = validateDemoCellContract({
      ...baseAraEnv,
      NODE_ENV: "production",
      AUTH_MODE: "local-test"
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("AUTH_MODE=local-test is not allowed when NODE_ENV=production.");
  });

  it("requires a complete SignalLoop destination when any destination setting is present", () => {
    const { INTEGRATION_DESTINATION_TOKEN: _token, ...missingToken } = baseAraEnv;

    const result = validateDemoCellContract(missingToken);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("INTEGRATION_DESTINATION_TOKEN is required when configuring SignalLoop delivery.");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
npm test -- src/server/deployment/demo-cell-contract.test.ts
```

Expected: FAIL because `src/server/deployment/demo-cell-contract.ts` does not exist.

- [ ] **Step 3: Implement validator**

Create `src/server/deployment/demo-cell-contract.ts`:

```ts
import { tenantSeedFixtures, type TenantSeedKey } from "../../../prisma/tenant-seed-fixtures";

type DemoCellContractResult = {
  ok: boolean;
  cell?: {
    key: TenantSeedKey;
    cellId: string;
    displayName: string;
  };
  errors: string[];
  warnings: string[];
};

const demoCells = {
  "ara-global": {
    cellId: "cell_ara_global",
    signalLoopWorkspaceId: "workspace_ara_global"
  },
  "ai-consulting": {
    cellId: "cell_ai_consulting",
    signalLoopWorkspaceId: "workspace_ai_consulting"
  }
} satisfies Record<TenantSeedKey, { cellId: string; signalLoopWorkspaceId: string }>;

export function validateDemoCellContract(environment: Record<string, string | undefined>): DemoCellContractResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const tenantSeed = environment.TENANT_SEED as TenantSeedKey | undefined;

  if (!tenantSeed || !(tenantSeed in tenantSeedFixtures)) {
    errors.push("TENANT_SEED must be ara-global or ai-consulting.");
    return { ok: false, errors, warnings };
  }

  const fixture = tenantSeedFixtures[tenantSeed];
  const expected = demoCells[tenantSeed];

  requireEqual(environment.APP_MODE, "cell", "APP_MODE", errors);
  requireEqual(environment.CELL_ID, expected.cellId, "CELL_ID", errors, `CELL_ID must be ${expected.cellId} for ${tenantSeed}.`);
  requireEqual(environment.CELL_KEY, tenantSeed, "CELL_KEY", errors, `CELL_KEY must be ${tenantSeed}.`);
  requirePostgresUrl(environment.DATABASE_URL, "DATABASE_URL", errors);
  requireMinLength(environment.AUTH_SECRET, 32, "AUTH_SECRET", errors);
  requireUrl(environment.APP_BASE_URL, "APP_BASE_URL", errors);

  if (environment.NODE_ENV === "production" && environment.AUTH_MODE === "local-test") {
    errors.push("AUTH_MODE=local-test is not allowed when NODE_ENV=production.");
  }

  if (!environment.BLOB_READ_WRITE_TOKEN) {
    warnings.push("BLOB_READ_WRITE_TOKEN is not configured; durable deployed voice-note audio storage is not proven.");
  }

  validateSignalLoopDestination(environment, expected.signalLoopWorkspaceId, errors, warnings);

  return {
    ok: errors.length === 0,
    cell: {
      key: tenantSeed,
      cellId: expected.cellId,
      displayName: fixture.displayName
    },
    errors,
    warnings
  };
}

function requireEqual(actual: string | undefined, expected: string, field: string, errors: string[], message = `${field} must be ${expected}.`) {
  if (actual !== expected) errors.push(message);
}

function requireMinLength(actual: string | undefined, length: number, field: string, errors: string[]) {
  if (!actual || actual.length < length) errors.push(`${field} must be at least ${length} characters.`);
}

function requirePostgresUrl(actual: string | undefined, field: string, errors: string[]) {
  if (!actual || !/^postgres(ql)?:\/\//.test(actual)) errors.push(`${field} must be a PostgreSQL connection URL.`);
}

function requireUrl(actual: string | undefined, field: string, errors: string[]) {
  if (!actual) {
    errors.push(`${field} must be a valid URL.`);
    return;
  }
  try {
    new URL(actual);
  } catch {
    errors.push(`${field} must be a valid URL.`);
  }
}

function validateSignalLoopDestination(
  environment: Record<string, string | undefined>,
  expectedWorkspaceId: string,
  errors: string[],
  warnings: string[]
) {
  const keys = ["INTEGRATION_DESTINATION_URL", "INTEGRATION_DESTINATION_INSTALLATION", "INTEGRATION_DESTINATION_TOKEN"] as const;
  const provided = keys.filter((key) => Boolean(environment[key]));
  if (provided.length === 0) {
    warnings.push("SignalLoop delivery destination is not configured; integration delivery smoke is not proven.");
    return;
  }
  for (const key of keys) {
    if (!environment[key]) errors.push(`${key} is required when configuring SignalLoop delivery.`);
  }
  if (environment.INTEGRATION_DESTINATION_URL && !environment.INTEGRATION_DESTINATION_URL.startsWith("https://")) {
    errors.push("INTEGRATION_DESTINATION_URL must use https://.");
  }
  if (environment.INTEGRATION_DESTINATION_INSTALLATION && environment.INTEGRATION_DESTINATION_INSTALLATION !== expectedWorkspaceId) {
    errors.push(`INTEGRATION_DESTINATION_INSTALLATION must be ${expectedWorkspaceId}.`);
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```powershell
npm test -- src/server/deployment/demo-cell-contract.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/server/deployment/demo-cell-contract.ts src/server/deployment/demo-cell-contract.test.ts
git commit -m "feat: add demo cell contract validator"
```

---

### Task 2: Add Operator Verification CLI

**Files:**
- Create: `src/scripts/verify-demo-cell.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing CLI test by running the intended command**

Run:

```powershell
npm run verify:demo-cell
```

Expected: FAIL because the script is not defined.

- [ ] **Step 2: Add package script**

Modify `package.json` scripts:

```json
"verify:demo-cell": "tsx src/scripts/verify-demo-cell.ts"
```

Place it near the existing `prisma:seed:tenant` script.

- [ ] **Step 3: Create CLI file**

Create `src/scripts/verify-demo-cell.ts`:

```ts
import { validateDemoCellContract } from "@/server/deployment/demo-cell-contract";

const result = validateDemoCellContract(process.env);

if (result.cell) {
  console.log(`Demo cell: ${result.cell.displayName} (${result.cell.cellId})`);
}

for (const warning of result.warnings) {
  console.warn(`WARN: ${warning}`);
}

for (const error of result.errors) {
  console.error(`ERROR: ${error}`);
}

if (!result.ok) {
  process.exitCode = 1;
} else {
  console.log("Demo cell contract verified.");
}
```

- [ ] **Step 4: Run CLI failure case**

Run:

```powershell
npm run verify:demo-cell
```

Expected: FAIL with `TENANT_SEED must be ara-global or ai-consulting.`

- [ ] **Step 5: Run CLI success case**

Run:

```powershell
$env:APP_MODE="cell"
$env:CELL_ID="cell_ara_global"
$env:CELL_KEY="ara-global"
$env:TENANT_SEED="ara-global"
$env:DATABASE_URL="postgresql://postgres:secret@db.ara.supabase.co:5432/postgres"
$env:AUTH_SECRET="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
$env:APP_BASE_URL="https://ecrm-ara-global-demo.vercel.app"
$env:AUTH_MODE="oidc"
$env:BLOB_READ_WRITE_TOKEN="vercel_blob_rw_ara"
$env:INTEGRATION_DESTINATION_URL="https://signalloop-ara.example.com"
$env:INTEGRATION_DESTINATION_INSTALLATION="workspace_ara_global"
$env:INTEGRATION_DESTINATION_TOKEN="signalloop-delivery-token"
npm run verify:demo-cell
```

Expected: PASS with `Demo cell contract verified.`

- [ ] **Step 6: Commit**

```powershell
git add package.json src/scripts/verify-demo-cell.ts
git commit -m "feat: add demo cell verification command"
```

---

### Task 3: Update Vercel and Supabase Runbooks

**Files:**
- Modify: `deploymentplan.md`
- Modify: `docs/operations/customer-cell-onboarding.md`

- [ ] **Step 1: Update deployment plan with verification before migration and seed**

In `deploymentplan.md`, add this block after the per-cell `.env.local` example and before `### Step 1.2: Run Prisma Migrations on Supabase`:

```md
### Step 1.1a: Verify the demo-cell contract

Before running migrations or tenant seed commands, verify the active shell is pointed at exactly one approved demo cell:

```powershell
$env:APP_MODE="cell"
$env:CELL_ID="cell_ara_global"
$env:CELL_KEY="ara-global"
$env:TENANT_SEED="ara-global"
$env:DATABASE_URL="postgresql://postgres:[ARA_PASSWORD]@[ARA_HOST]:5432/postgres"
$env:AUTH_SECRET="[GENERATE_32_PLUS_CHAR_SECRET]"
$env:APP_BASE_URL="https://[ARA_VERCEL_URL]"
$env:AUTH_MODE="oidc"
$env:BLOB_READ_WRITE_TOKEN="[VERCEL_BLOB_TOKEN]"
$env:INTEGRATION_DESTINATION_URL="https://[ARA_SIGNALLOOP_API_URL]"
$env:INTEGRATION_DESTINATION_INSTALLATION="workspace_ara_global"
$env:INTEGRATION_DESTINATION_TOKEN="[ARA_SIGNALLOOP_DELIVERY_TOKEN]"
npm run verify:demo-cell
```

Repeat with `CELL_ID=cell_ai_consulting`, `CELL_KEY=ai-consulting`, `TENANT_SEED=ai-consulting`, and `INTEGRATION_DESTINATION_INSTALLATION=workspace_ai_consulting` for the AI Consulting cell. Do not continue to migration, seed, or Vercel deployment if this command prints any `ERROR:` lines.
```

- [ ] **Step 2: Update customer-cell onboarding runbook**

In `docs/operations/customer-cell-onboarding.md`, add this section after `## Preflight`:

```md
## Demo-cell verification for Vercel and Supabase

For ARA Global and AI Consulting demos, use the current Vercel and Supabase path. AWS runtime work is not part of this runbook. Each cell must have its own Supabase database/project and its own Vercel deployment.

Run `npm run verify:demo-cell` in the same shell that will run migrations or tenant seeding. The command checks `APP_MODE=cell`, the approved `CELL_ID`/`CELL_KEY`, `TENANT_SEED`, PostgreSQL `DATABASE_URL`, `AUTH_SECRET`, `APP_BASE_URL`, Vercel Blob storage configuration, and optional SignalLoop delivery destination settings.

Warnings are allowed only when deliberately running a local rehearsal. For a deployed demo cell, resolve warnings for Vercel Blob storage and SignalLoop delivery before calling the cell demo-ready.
```

- [ ] **Step 3: Run markdown and focused tests**

Run:

```powershell
npm test -- src/server/deployment/demo-cell-contract.test.ts
git diff --check
```

Expected: PASS and no whitespace errors.

- [ ] **Step 4: Commit**

```powershell
git add deploymentplan.md docs/operations/customer-cell-onboarding.md
git commit -m "docs: add demo cell verification runbook"
```

---

### Task 4: Final Verification

**Files:**
- No new files beyond prior tasks.

- [ ] **Step 1: Run focused verification**

Run:

```powershell
npm test -- src/server/deployment/demo-cell-contract.test.ts prisma/tenant-seed.test.ts src/server/integration-delivery/credentials.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Inspect status**

Run:

```powershell
git status --short --branch
```

Expected: only the two intentionally untracked visual-materials superpowers files remain, unless new implementation commits are still ahead of remote.

- [ ] **Step 4: Push implementation commits if requested**

Run only after confirming staged/committed scope:

```powershell
git push origin main
git rev-parse HEAD
git rev-parse origin/main
```

Expected: local and remote hashes match.

---

## Self-Review

- Spec coverage: The plan covers the demo-cell contract, fail-closed checks, tenant seed identity, storage warning, SignalLoop destination verification, runbook updates, and focused verification.
- Placeholder scan: No task contains placeholder markers or an unbounded "add appropriate" step.
- Type consistency: The validator returns `ok`, `cell`, `errors`, and `warnings`; the CLI consumes those exact fields.
