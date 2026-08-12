import { compare, hash } from "bcryptjs";
import { describe, expect, it } from "vitest";

import {
  IntegrationCredentialService,
  createInMemoryIntegrationCredentialRepository
} from "./credentials";

const runtime = { mode: "cell", cellId: "cell_ara", cellKey: "ara" } as const;
const actor = { id: "admin_1", role: "ADMIN" as const };
const fastHash = (secret: string) => hash(secret, 4);

describe("cell integration credentials", () => {
  it("returns a generated secret once and persists only its bcrypt hash", async () => {
    const repository = createInMemoryIntegrationCredentialRepository();
    const service = new IntegrationCredentialService(repository, { runtime, now: () => new Date("2026-08-12T12:00:00Z"), hashSecret: fastHash });

    const issued = await service.issue(actor, {
      name: "SignalLoop",
      capabilities: ["SHARED_RECORDS_READ", "WORKFLOW_EVENTS_WRITE"],
      expiresAt: new Date("2026-12-01T00:00:00Z"),
      correlationId: "corr_issue",
      reason: "Initial installation binding"
    });

    expect(issued.secret).toMatch(/^ecrm_[^.]+\.[A-Za-z0-9_-]+$/);
    const stored = await repository.findById(issued.credential.id);
    expect(stored).toBeDefined();
    expect(stored).not.toHaveProperty("secret");
    await expect(compare(issued.secret, stored!.secretHash)).resolves.toBe(true);
    expect((await repository.auditEvents())[0]).toMatchObject({
      action: "integration-credential.issue",
      result: "SUCCEEDED",
      after: { capabilities: ["SHARED_RECORDS_READ", "WORKFLOW_EVENTS_WRITE"], status: "ACTIVE" }
    });
    expect(JSON.stringify(await repository.auditEvents())).not.toContain(issued.secret);
  });

  it("authenticates only the current cell, active lifetime, and requested capability with a constant denial", async () => {
    const repository = createInMemoryIntegrationCredentialRepository();
    const now = new Date("2026-08-12T12:00:00Z");
    const service = new IntegrationCredentialService(repository, { runtime, now: () => now, hashSecret: fastHash });
    const { secret } = await service.issue(actor, {
      name: "SignalLoop",
      capabilities: ["SHARED_RECORDS_READ"],
      expiresAt: new Date("2026-09-01T00:00:00Z"),
      correlationId: "corr_issue",
      reason: "Read projection"
    });

    await expect(service.authenticate(secret, "SHARED_RECORDS_READ")).resolves.toMatchObject({ cellId: "cell_ara" });
    const denied = await Promise.all([
      service.authenticate(secret, "WORKFLOW_EVENTS_WRITE").catch((error) => error.message),
      new IntegrationCredentialService(repository, { runtime: { ...runtime, cellId: "cell_other" }, now: () => now })
        .authenticate(secret, "SHARED_RECORDS_READ").catch((error) => error.message),
      service.authenticate("ecrm_missing.invalid", "SHARED_RECORDS_READ").catch((error) => error.message)
    ]);
    expect(new Set(denied)).toEqual(new Set(["Unauthorized integration credential"]));
  });

  it("invalidates rotated, revoked, and expired credentials and audits lifecycle changes without secrets", async () => {
    const repository = createInMemoryIntegrationCredentialRepository();
    let now = new Date("2026-08-12T12:00:00Z");
    const service = new IntegrationCredentialService(repository, { runtime, now: () => now, hashSecret: fastHash });
    const first = await service.issue(actor, {
      name: "SignalLoop", capabilities: ["WORKFLOW_EVENTS_WRITE"], expiresAt: new Date("2026-08-13T00:00:00Z"),
      correlationId: "corr_issue", reason: "Initial binding"
    });
    const rotated = await service.rotate(actor, first.credential.id, {
      expiresAt: new Date("2026-08-14T00:00:00Z"), correlationId: "corr_rotate", reason: "Scheduled rotation"
    });
    await expect(service.authenticate(first.secret, "WORKFLOW_EVENTS_WRITE")).rejects.toThrow("Unauthorized integration credential");
    await expect(service.authenticate(rotated.secret, "WORKFLOW_EVENTS_WRITE")).resolves.toBeDefined();
    await service.revoke(actor, rotated.credential.id, { correlationId: "corr_revoke", reason: "Disconnect installation" });
    await expect(service.authenticate(rotated.secret, "WORKFLOW_EVENTS_WRITE")).rejects.toThrow("Unauthorized integration credential");

    const short = await service.issue(actor, {
      name: "Temporary", capabilities: ["SHARED_RECORDS_READ"], expiresAt: new Date("2026-08-12T13:00:00Z"),
      correlationId: "corr_short", reason: "Temporary reconciliation"
    });
    now = new Date("2026-08-12T14:00:00Z");
    await expect(service.authenticate(short.secret, "SHARED_RECORDS_READ")).rejects.toThrow("Unauthorized integration credential");
    expect(JSON.stringify(await repository.auditEvents())).not.toContain(first.secret);
    expect(JSON.stringify(await repository.auditEvents())).not.toContain(rotated.secret);
  });

  it("permits the legacy shared token only behind an explicit development flag", async () => {
    const service = new IntegrationCredentialService(createInMemoryIntegrationCredentialRepository(), {
      runtime,
      environment: { NODE_ENV: "development", ALLOW_LEGACY_SHARED_DATA_TOKEN: "true", SHARED_DATA_API_TOKEN: "legacy" }
    });
    await expect(service.authenticate("legacy", "SHARED_RECORDS_READ")).resolves.toMatchObject({ legacy: true, cellId: "cell_ara" });

    for (const environment of [
      { NODE_ENV: "production", ALLOW_LEGACY_SHARED_DATA_TOKEN: "true", SHARED_DATA_API_TOKEN: "legacy" },
      { NODE_ENV: "development", ALLOW_LEGACY_SHARED_DATA_TOKEN: "false", SHARED_DATA_API_TOKEN: "legacy" }
    ]) {
      const productionSafe = new IntegrationCredentialService(createInMemoryIntegrationCredentialRepository(), { runtime, environment });
      await expect(productionSafe.authenticate("legacy", "SHARED_RECORDS_READ")).rejects.toThrow("Unauthorized integration credential");
    }
  });
});
