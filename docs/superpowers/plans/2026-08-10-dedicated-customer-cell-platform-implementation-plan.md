# Dedicated Customer-Cell Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build dedicated eCRM customer cells with separate databases, files, secrets, and SignalLoop workspaces, coordinated by a platform-admin control plane.

**Architecture:** The Next.js codebase runs in `platform` mode against a control-plane database or `cell` mode against exactly one customer database. No request supplies a customer ID to choose a database. Cell-local users and business records stay in the cell database; SignalLoop resolves its matching eCRM cell from its authenticated workspace.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, Prisma 6/PostgreSQL, Zod, jose, bcryptjs, Vitest, Playwright, SignalLoop FastAPI/SQLAlchemy/Pytest.

---

## Delivery boundaries and files

- `C:\My Workspace\eCRM` owns runtime mode, control-plane lifecycle, local customer administration, and eCRM integration credentials.
- `C:\Users\K.Ramachandran\eMailVoice` owns SignalLoop workspace-to-cell binding.
- The first driver is local and deterministic. A provider driver is added only after cloud, DNS, storage, secrets, and backup authority are selected.

| Path | Responsibility |
|---|---|
| `prisma/platform.schema.prisma` | Dedicated control-plane schema. |
| `src/server/runtime/cell-config.ts` | Validated platform/cell runtime identity. |
| `src/server/platform/provisioning.ts` | Idempotent cell lifecycle orchestration. |
| `src/server/platform/drivers/local-driver.ts` | Local provision/health implementation. |
| `src/server/cell-admin/` | Customer-admin users, branding, modules, and local settings. |
| `src/server/integrations/cell-credential.ts` | Cell-local issue, hash, rotate, and auth operations. |
| `src/server/shared-records/api-auth.ts` | Cell credential authentication. |
| `apps/api/app/integrations/ecrm_cell.py` | SignalLoop workspace-to-cell client. |

### Task 1: Add a platform/cell runtime boundary

**Files:**
- Create: `src/server/runtime/cell-config.ts`
- Create: `src/server/runtime/cell-config.test.ts`
- Modify: `src/server/env.ts`, `.env.example`
- Test: `src/server/runtime/cell-config.test.ts`

- [ ] **Step 1: Write the failing tests.**

```ts
import { describe, expect, it } from "vitest";
import { parseRuntimeConfig } from "./cell-config";

describe("parseRuntimeConfig", () => {
  it("requires CELL_ID in cell mode", () => {
    expect(() => parseRuntimeConfig({ APP_MODE: "cell" })).toThrow("CELL_ID is required");
  });
  it("accepts platform mode without a customer identity", () => {
    expect(parseRuntimeConfig({ APP_MODE: "platform" })).toEqual({ mode: "platform" });
  });
  it("returns immutable cell identity", () => {
    expect(parseRuntimeConfig({ APP_MODE: "cell", CELL_ID: "cell_ara", CELL_KEY: "ara-global" }))
      .toEqual({ mode: "cell", cellId: "cell_ara", cellKey: "ara-global" });
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails.**

Run: `npm test -- src/server/runtime/cell-config.test.ts`

Expected: FAIL because the parser does not exist.

- [ ] **Step 3: Implement the smallest parser and environment extension.**

```ts
import { z } from "zod";

const schema = z.discriminatedUnion("APP_MODE", [
  z.object({ APP_MODE: z.literal("platform") }),
  z.object({ APP_MODE: z.literal("cell"), CELL_ID: z.string().min(1), CELL_KEY: z.string().regex(/^[a-z0-9-]+$/) })
]);

export function parseRuntimeConfig(input: Record<string, string | undefined>) {
  const value = schema.parse(input);
  return value.APP_MODE === "platform"
    ? { mode: "platform" as const }
    : { mode: "cell" as const, cellId: value.CELL_ID, cellKey: value.CELL_KEY };
}
```

Extend `getServerEnv()` to expose this result. Add neutral `APP_MODE`, `CELL_ID`, and `CELL_KEY` examples. Do not add any browser-controlled cell selector.

- [ ] **Step 4: Verify and commit.**

Run: `npm test -- src/server/runtime/cell-config.test.ts && npm run typecheck`

Expected: PASS.

```powershell
git add src/server/runtime/cell-config.ts src/server/runtime/cell-config.test.ts src/server/env.ts .env.example
git commit -m "feat: add platform and customer-cell runtime modes"
```

### Task 2: Build the control-plane lifecycle core

**Files:**
- Create: `prisma/platform.schema.prisma`, `src/server/platform/db.ts`, `src/server/platform/types.ts`
- Create: `src/server/platform/provisioning.ts`, `src/server/platform/provisioning.test.ts`
- Create: `src/server/platform/drivers/local-driver.ts`, `src/server/platform/drivers/local-driver.test.ts`
- Modify: `package.json`, `.gitignore`
- Test: `src/server/platform/provisioning.test.ts`

- [ ] **Step 1: Write failing idempotency and lifecycle tests.**

```ts
it("returns the existing cell on a provisioning retry", async () => {
  const first = await provisionCell(request, dependencies);
  const retry = await provisionCell(request, dependencies);
  expect(retry.cell.id).toBe(first.cell.id);
  expect(dependencies.driver.createCell).toHaveBeenCalledTimes(1);
});

it("does not activate a cell after a failed health check", async () => {
  dependencies.driver.healthCheck.mockResolvedValue({ ok: false, detail: "database unreachable" });
  await expect(provisionCell(request, dependencies)).rejects.toThrow("database unreachable");
  expect(dependencies.cells.update).toHaveBeenCalledWith(expect.objectContaining({ status: "PROVISIONING_FAILED" }));
});
```

- [ ] **Step 2: Run the test and confirm it fails.**

Run: `npm test -- src/server/platform/provisioning.test.ts`

Expected: FAIL because the platform schema/service is absent.

- [ ] **Step 3: Add a separately generated control-plane client and tables.**

```prisma
generator client { provider = "prisma-client-js"; output = "../src/generated/platform-client" }
datasource db { provider = "postgresql"; url = env("PLATFORM_DATABASE_URL") }

model CustomerCell {
  id String @id @default(cuid())
  key String @unique
  legalName String
  displayName String
  status CellStatus @default(PROVISIONING)
  appUrl String? @unique
  planCode String
  region String
  attempts ProvisioningAttempt[]
}
```

Define `CellStatus` as `PROVISIONING`, `ACTIVE`, `SUSPENDED`, `OFFBOARDING`, `DELETED`, and `PROVISIONING_FAILED`. Add `ProvisioningAttempt` with idempotency key, request hash, timestamps, result/error, and one `SupportGrant` with actor, case reference, expiry, and revocation. Add scripts `prisma:platform:generate` and `prisma:platform:migrate` that pass `--schema prisma/platform.schema.prisma`.

- [ ] **Step 4: Implement the driver contract and orchestrator.**

```ts
export type CellDriver = {
  createCell(input: { cellId: string; cellKey: string; region: string }): Promise<{ appUrl: string }>;
  createInitialAdmin(input: { cellId: string; email: string; name: string }): Promise<void>;
  createSignalLoopBinding(input: { cellId: string; cellKey: string }): Promise<void>;
  healthCheck(input: { cellId: string }): Promise<{ ok: true } | { ok: false; detail: string }>;
};
```

`provisionCell` must transactionally reserve/find the customer key, call the driver only for a new attempt, persist every outcome, and transition to `ACTIVE` only after health verification. `local-driver` returns deterministic cell URLs and test database names without calling cloud APIs.

- [ ] **Step 5: Verify and commit.**

Run: `npm run prisma:platform:generate && npm test -- src/server/platform/provisioning.test.ts src/server/platform/drivers/local-driver.test.ts && npm run typecheck`

Expected: PASS.

```powershell
git add prisma/platform.schema.prisma src/server/platform package.json .gitignore
git commit -m "feat: add customer-cell control-plane lifecycle"
```

### Task 3: Add platform-admin lifecycle APIs and audited support grants

**Files:**
- Create: `src/server/platform/authorization.ts`, `src/server/platform/authorization.test.ts`
- Create: `src/server/platform/support-grants.ts`, `src/server/platform/support-grants.test.ts`
- Create: `src/app/api/platform/cells/route.ts`, `src/app/api/platform/cells/[cellId]/route.ts`
- Create: `src/app/api/platform/cells/route.test.ts`

- [ ] **Step 1: Write failing platform API tests.**

```ts
it("rejects a cell-mode request", async () => {
  expect((await POST(cellModeRequest)).status).toBe(404);
});

it("suspends only the requested cell", async () => {
  expect((await PATCH(suspendRequest, { params: Promise.resolve({ cellId: "cell_ai" }) })).status).toBe(200);
  expect(platform.cells.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "cell_ai" }, data: { status: "SUSPENDED" } }));
});
```

- [ ] **Step 2: Run the test and confirm it fails.**

Run: `npm test -- src/server/platform/authorization.test.ts src/app/api/platform/cells/route.test.ts`

Expected: FAIL because platform-only routes are absent.

- [ ] **Step 3: Implement authorization, routes, and grants.**

Use `PLATFORM_ADMIN_TOKEN` only for the initial local increment, compare it in constant time, and reject if `APP_MODE !== "platform"`. `POST /api/platform/cells` accepts `key`, names, region, plan, and initial admin. `PATCH` permits only `ACTIVE -> SUSPENDED`, `SUSPENDED -> ACTIVE`, and `ACTIVE|SUSPENDED -> OFFBOARDING`. Each transition and support grant emits an append-only control-plane audit entry. A grant must have an expiry and cannot create a standing global session.

- [ ] **Step 4: Verify and commit.**

Run: `npm test -- src/server/platform/authorization.test.ts src/server/platform/support-grants.test.ts src/app/api/platform/cells/route.test.ts && npm run lint -- src/server/platform src/app/api/platform`

Expected: PASS.

```powershell
git add src/server/platform src/app/api/platform/cells
git commit -m "feat: add platform customer-cell operations"
```

### Task 4: Deliver customer-admin branding, modules, settings, and users

**Files:**
- Modify: `prisma/schema.prisma`, `src/server/settings/settings.ts`, `src/app/(app)/admin/settings/page.tsx`, `src/components/settings/business-settings-form.tsx`
- Create: `prisma/migrations/<timestamp>_add_cell_configuration/migration.sql`
- Create: `src/server/cell-admin/configuration.ts`, `src/server/cell-admin/configuration.test.ts`
- Create: `src/server/cell-admin/users.ts`, `src/server/cell-admin/users.test.ts`
- Create: `src/app/api/admin/configuration/route.ts`, `src/app/api/admin/users/route.ts`

- [ ] **Step 1: Write failing local-admin tests.**

```ts
it("allows a local admin to enable an included module", async () => {
  await updateCellConfiguration(admin, { enabledModules: ["CRM", "PROPOSALS"] }, database);
  expect(database.cellConfiguration.upsert).toHaveBeenCalled();
});

it("rejects a module outside the plan", async () => {
  await expect(updateCellConfiguration(admin, { enabledModules: ["FINANCE"] }, database))
    .rejects.toThrow("FINANCE is not included in this cell plan");
});

it("prevents a sales rep from inviting users", async () => {
  await expect(inviteCellUser(salesUser, invite, database)).rejects.toThrow("Only Admin can manage users");
});
```

- [ ] **Step 2: Run the tests and confirm they fail.**

Run: `npm test -- src/server/cell-admin/configuration.test.ts src/server/cell-admin/users.test.ts`

Expected: FAIL because configuration and user-management services are absent.

- [ ] **Step 3: Add cell-local models and services.**

Add `CellConfiguration` keyed by `id = "default"` with name, logo URL, colors, support/legal URLs, locale, timezone, currency, and enabled modules. Add `CellAuditEvent`. Keep `User` and business records in the customer database; do not add a customer chooser. `updateCellConfiguration` uses Zod validation, enforces the immutable plan allowance from provisioning, and records an audit event. User services require local `ADMIN` and reject deactivation of the final active local admin.

- [ ] **Step 4: Implement the customer-admin routes/UI.**

Expose the admin routes only in `cell` mode. Refactor the existing singleton business-settings read/write to use `CellConfiguration`, preserving the current default-currency behavior. Render neutral fallback branding if configuration is missing and never hardcode ARA Global as an application default.

- [ ] **Step 5: Verify and commit.**

Run: `npm run prisma:generate && npm test -- src/server/cell-admin src/server/settings src/components/settings && npm run typecheck`

Expected: PASS.

```powershell
git add prisma src/server/cell-admin src/server/settings src/app/api/admin src/app/(app)/admin/settings src/components/settings
git commit -m "feat: add customer-cell self-service administration"
```

### Task 5: Replace the static shared-data token with a cell-local credential

**Files:**
- Create: `src/server/integrations/cell-credential.ts`, `src/server/integrations/cell-credential.test.ts`
- Modify: `src/server/shared-records/api-auth.ts`, `src/server/shared-records/api-auth.test.ts`
- Modify: `src/server/workflow-events/service.ts`, `src/server/workflow-events/service.test.ts`
- Modify: `src/app/api/shared-records/route.test.ts`, `src/app/api/workflow-events/route.test.ts`

- [ ] **Step 1: Write failing credential tests.**

```ts
it("accepts an active credential in its own cell", async () => {
  await expect(authenticateCellCredential(requestWithAraSecret, database)).resolves.toMatchObject({ credentialId: "cred_ara" });
});

it("rejects another cell credential", async () => {
  await expect(authenticateCellCredential(requestWithAiSecret, database)).rejects.toThrow("Unauthorized");
});

it("treats workflow-event duplicates as cell-local", async () => {
  await expect(ingestWorkflowEvent(event, { cellId: "cell_ara" }, database)).resolves.toMatchObject({ duplicate: false });
  await expect(ingestWorkflowEvent(event, { cellId: "cell_ara" }, database)).resolves.toMatchObject({ duplicate: true });
});
```

- [ ] **Step 2: Run the tests and confirm they fail.**

Run: `npm test -- src/server/integrations/cell-credential.test.ts src/server/shared-records/api-auth.test.ts src/server/workflow-events/service.test.ts`

Expected: FAIL because `SHARED_DATA_API_TOKEN` is the only authentication path.

- [ ] **Step 3: Implement issue/rotate/authenticate.**

Generate one secret, retain only a bcrypt hash, display it once during creation/rotation, and authenticate with `bcrypt.compare`. Credentials carry name, capabilities, status, expiry, rotation time, and last-use time. The cell runtime chooses the local credential table; a header, query parameter, or payload cannot choose another cell. Change shared-record/workflow-event uniqueness so replay and audit data are local to the cell. Permit the legacy static token only behind a development-only flag that fails closed in production.

- [ ] **Step 4: Verify and commit.**

Run: `npm test -- src/server/integrations src/server/shared-records src/server/workflow-events src/app/api/shared-records src/app/api/workflow-events && npm run lint -- src/server/integrations src/server/shared-records src/server/workflow-events`

Expected: PASS; a credential from a second cell is rejected.

```powershell
git add prisma src/server/integrations src/server/shared-records src/server/workflow-events src/app/api/shared-records src/app/api/workflow-events
git commit -m "feat: scope eCRM integrations to customer cells"
```

### Task 6: Bind each SignalLoop workspace to one eCRM cell

**Repository:** `C:\Users\K.Ramachandran\eMailVoice`

**Files:**
- Create: `apps/api/app/integrations/ecrm_cell.py`, `apps/api/tests/unit/test_ecrm_cell.py`
- Modify: `apps/api/app/core/config.py`
- Modify: the existing eCRM shared-record and workflow-event adapter routes
- Modify: `docs/developer-guide/environment-variables.md`

- [ ] **Step 1: Write failing workspace-binding tests.**

```python
def test_workspace_uses_its_bound_cell_credential(settings):
    client = EcrmCellClient(settings, workspace_id="ws_ara")
    assert client.build_request("/api/shared-records").headers["Authorization"] == "Bearer ara-secret"

def test_workspace_cannot_override_its_ecrm_base_url(settings):
    client = EcrmCellClient(settings, workspace_id="ws_ara")
    with pytest.raises(ForbiddenCellOverride):
        client.build_request("https://ai.example.test/api/shared-records")
```

- [ ] **Step 2: Run the tests and confirm they fail.**

Run: `uv run pytest apps/api/tests/unit/test_ecrm_cell.py -q`

Expected: FAIL because `EcrmCellClient` is absent.

- [ ] **Step 3: Implement binding and secret resolution.**

Add `ECRM_CELL_BINDINGS_JSON`, keyed by authenticated SignalLoop workspace ID. Each entry contains `ecrm_cell_key`, `base_url`, and `credential_secret_ref`. Production resolves the secret reference from deployment secrets; tests inject a deterministic resolver. The client derives binding from workspace identity and never accepts an eCRM URL, cell key, or credential from a request body.

- [ ] **Step 4: Verify and commit.**

Run: `uv run pytest apps/api/tests/unit/test_ecrm_cell.py apps/api/tests/unit/test_ecrm_shared_records.py -q && uv run ruff check apps/api/app/integrations/ecrm_cell.py apps/api/tests/unit/test_ecrm_cell.py`

Expected: PASS.

```powershell
git -C 'C:\Users\K.Ramachandran\eMailVoice' add apps/api/app/integrations/ecrm_cell.py apps/api/tests/unit/test_ecrm_cell.py apps/api/app/core/config.py apps/api/app/api docs/developer-guide/environment-variables.md
git -C 'C:\Users\K.Ramachandran\eMailVoice' commit -m "feat: bind SignalLoop workspaces to eCRM cells"
```

### Task 7: Prove isolation, lifecycle safety, and operational recovery

**Files:**
- Create: `tests/e2e/dedicated-cell-isolation.spec.ts`
- Create: `docs/operations/customer-cell-onboarding.md`, `docs/operations/customer-cell-suspension-and-support.md`
- Modify: `README.md`, `docs/getting-started.md`

- [ ] **Step 1: Write the failing two-cell test.**

```ts
test("ARA and AI Consulting remain isolated", async ({ request }) => {
  const araResponse = await request.get(`${process.env.ARA_CELL_URL}/api/shared-records/ai-only-id`, { headers: { Authorization: "Bearer ara-secret" } });
  expect(araResponse.status()).toBe(404);
  const aiResponse = await request.get(`${process.env.AI_CELL_URL}/api/shared-records/ai-only-id`, { headers: { Authorization: "Bearer ai-secret" } });
  expect(aiResponse.status()).toBe(200);
});
```

- [ ] **Step 2: Run the test and confirm it fails.**

Run: `npm run test:e2e -- tests/e2e/dedicated-cell-isolation.spec.ts`

Expected: FAIL until the local driver creates two separate test cells.

- [ ] **Step 3: Implement the local two-cell harness and runbooks.**

The local driver creates separate databases, credentials, storage prefixes, base URLs, and initial admins for `ara-global` and `ai-consulting`. Add acceptance cases for retry, failed health, wrong credential, module rejection, suspension, expiring support grant, and restore to the original cell only. Write runbooks with preflight, onboarding, verification, rotation, suspension, support, backup/restore, and offboarding. State explicitly that `prisma/seed.ts` resets demo data and is not an onboarding command.

- [ ] **Step 4: Run complete gates and commit.**

Run in eCRM: `npm run gate && npm run test:e2e -- tests/e2e/dedicated-cell-isolation.spec.ts`

Run in SignalLoop: `uv run pytest apps/api/tests/unit/test_ecrm_cell.py apps/api/tests/unit/test_ecrm_shared_records.py -q && uv run ruff check apps/api/app/integrations/ecrm_cell.py`

Expected: PASS. Report production-provider verification separately because the local driver does not create cloud resources.

```powershell
git add tests/e2e/dedicated-cell-isolation.spec.ts docs/operations/customer-cell-onboarding.md docs/operations/customer-cell-suspension-and-support.md README.md docs/getting-started.md
git commit -m "test: verify dedicated customer-cell isolation"
```

## Plan self-review

- The plan covers platform onboarding (Tasks 1-3), customer-admin self-service (Task 4), credential and SignalLoop boundaries (Tasks 5-6), and isolation/lifecycle/recovery evidence (Task 7).
- It intentionally avoids pooled business-record storage and customer-specific source forks.
- `cellId`/`cellKey` are deployment-derived; `workspace_id` is SignalLoop-authenticated; neither is client-selected authorization input.

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-08-10-dedicated-customer-cell-platform-implementation-plan.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — a fresh agent executes each task and receives a review before the next task.
2. **Inline Execution** — execute the tasks in this session using `superpowers:executing-plans`, in small batches with checkpoints.
