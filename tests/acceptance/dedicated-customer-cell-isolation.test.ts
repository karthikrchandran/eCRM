// @vitest-environment node
import { describe, expect, it } from "vitest";

import { SupportAccessDeniedError } from "@/server/cell-admin/support-access";
import { IntegrationCredentialDeniedError } from "@/server/integration-delivery/credentials";

import { createSyntheticCustomerCellAcceptanceHarness } from "./support/synthetic-customer-cells";

describe("dedicated customer-cell enterprise acceptance", () => {
  it("provisions ARA and AI Consulting with isolated infrastructure and local admins", async () => {
    const harness = await createSyntheticCustomerCellAcceptanceHarness();
    const ara = harness.cell("ara-global");
    const ai = harness.cell("ai-consulting");

    expect(ara.cell.lifecycleStatus).toBe("ACTIVE");
    expect(ai.cell.lifecycleStatus).toBe("ACTIVE");
    expect(ara.identity).toEqual({
      databaseName: "ecrm_ara_global",
      schemaName: "cell_ara_global",
      storagePrefix: "local://storage/ara-global",
      credentialReference: "local://secret/ara-global",
      baseUrl: "http://ara-global.localhost",
      workspaceId: "workspace-ara-global",
      initialAdmin: "admin@ara.synthetic.invalid"
    });
    expect(new Set([
      ara.identity.databaseName, ai.identity.databaseName,
      ara.identity.schemaName, ai.identity.schemaName,
      ara.identity.storagePrefix, ai.identity.storagePrefix,
      ara.identity.credentialReference, ai.identity.credentialReference,
      ara.identity.baseUrl, ai.identity.baseUrl,
      ara.identity.workspaceId, ai.identity.workspaceId,
      ara.identity.initialAdmin, ai.identity.initialAdmin
    ])).toHaveLength(14);
    await expect(ara.admin.listUsers({ id: "ara-owner", role: "ADMIN" })).resolves.toEqual([
      expect.objectContaining({ email: "admin@ara.synthetic.invalid", role: "ADMIN" })
    ]);
    await expect(ai.admin.listUsers({ id: "ai-owner", role: "ADMIN" })).resolves.toEqual([
      expect.objectContaining({ email: "admin@ai.synthetic.invalid", role: "ADMIN" })
    ]);
  });

  it("contains provider health failure and restore to the intended cell", async () => {
    const harness = await createSyntheticCustomerCellAcceptanceHarness();

    const failed = await harness.provisionHealthFailure("health-failure");
    expect(failed.cell.lifecycleStatus).toBe("PROVISIONING_FAILED");
    expect(harness.cell("ara-global").cell.lifecycleStatus).toBe("ACTIVE");
    expect(harness.cell("ai-consulting").cell.lifecycleStatus).toBe("ACTIVE");

    const araBackup = harness.backup("ara-global");
    await expect(harness.restore("ai-consulting", araBackup)).rejects.toThrow("Restore reference belongs to another customer cell");
    await harness.restore("ara-global", araBackup);
    expect(harness.cell("ara-global").restoreGeneration).toBe(1);
    expect(harness.cell("ai-consulting").restoreGeneration).toBe(0);
  });

  it("rotates credentials without permitting cross-cell or retired-secret access", async () => {
    const harness = await createSyntheticCustomerCellAcceptanceHarness();
    const ara = harness.cell("ara-global");
    const ai = harness.cell("ai-consulting");

    await expect(ara.credentials.authenticate(ai.secret, "PROJECTION_DELIVER")).rejects.toBeInstanceOf(IntegrationCredentialDeniedError);
    const rotated = await harness.rotateCredential("ara-global");
    await expect(ara.credentials.authenticate(ara.secret, "PROJECTION_DELIVER")).rejects.toBeInstanceOf(IntegrationCredentialDeniedError);
    await expect(ara.credentials.authenticate(rotated.secret, "PROJECTION_DELIVER")).resolves.toMatchObject({ cellId: ara.cell.id });
  });

  it("expires and revokes support grants without crossing cell identity", async () => {
    const harness = await createSyntheticCustomerCellAcceptanceHarness();
    const grant = await harness.supportGrant("ara-global");

    await expect(harness.authorizeSupport("ara-global", grant, "2026-08-12T12:01:00Z")).resolves.toMatchObject({ grantId: grant.id });
    await expect(harness.authorizeSupport("ai-consulting", grant, "2026-08-12T12:01:00Z")).rejects.toBeInstanceOf(SupportAccessDeniedError);
    await expect(harness.authorizeSupport("ara-global", grant, "2026-08-12T12:06:00Z")).rejects.toBeInstanceOf(SupportAccessDeniedError);
    grant.revokedAt = new Date("2026-08-12T12:02:00Z");
    await expect(harness.authorizeSupport("ara-global", grant, "2026-08-12T12:02:01Z")).rejects.toBeInstanceOf(SupportAccessDeniedError);
  });

  it("dead-letters timed-out delivery, opens its circuit, replays, and reconciles only ARA", async () => {
    const harness = await createSyntheticCustomerCellAcceptanceHarness();
    const delivery = await harness.enqueue("ara-global", { installation: "ara-global", version: 1 });
    harness.destination.timeout("workspace-ara-global", 2);

    await harness.runDelivery("ara-global", "2026-08-12T12:00:00Z");
    await harness.runDelivery("ara-global", "2026-08-12T12:00:01Z");

    await expect(harness.cell("ara-global").outbox.deadLetters(harness.cell("ara-global").cell.id)).resolves.toEqual([
      expect.objectContaining({ id: delivery.id, status: "DEAD_LETTER", errorCode: "REQUEST_TIMEOUT" })
    ]);
    await expect(harness.cell("ai-consulting").outbox.deadLetters(harness.cell("ai-consulting").cell.id)).resolves.toEqual([]);
    expect((await harness.cell("ara-global").outbox.status(harness.cell("ara-global").cell.id)).circuits[0]).toMatchObject({ state: "OPEN" });

    await harness.replay("ara-global", delivery.id, "CASE-ARA-42");
    harness.destination.recover("workspace-ara-global");
    await harness.runDelivery("ara-global", "2026-08-12T12:01:00Z");
    await expect(harness.cell("ara-global").outbox.status(harness.cell("ara-global").cell.id)).resolves.toMatchObject({ delivered: 1, deadLetter: 0 });

    const mismatch = await harness.reconcile("ara-global", { count: 0, version: 0, checkpoint: null });
    expect(mismatch).toMatchObject({ matched: false, repairCandidateCreated: true });
    await expect(harness.cell("ai-consulting").outbox.repairCandidates(harness.cell("ai-consulting").cell.id)).resolves.toEqual([]);
  });
});
