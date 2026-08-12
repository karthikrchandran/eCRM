import { describe, expect, it, vi } from "vitest";

import { reconcileCellProjection } from "./reconciliation";
import { createInMemoryIntegrationDeliveryRepository } from "./outbox";

describe("integration projection reconciliation", () => {
  it("persists a mismatch repair candidate without mutating source or destination records", async () => {
    const repository = createInMemoryIntegrationDeliveryRepository();
    await repository.withSourceMutation!(async (transaction) => {
      await transaction.writeSource("record_1", { version: 1 });
      await transaction.writeSource("record_2", { version: 1 });
    });
    const provider = { checkpoint: vi.fn().mockResolvedValue({ count: 1, version: 1, checkpoint: "destination:1" }) };

    const result = await reconcileCellProjection("cell_ara", "signalloop:workspace_ara", repository, provider, {
      actorId: "admin_1", correlationId: "corr_reconcile", reason: "Scheduled verification", now: new Date("2026-08-12T12:00:00Z"), stream: "SHARED_RECORD"
    });

    expect(result).toMatchObject({ matched: false, sourceCount: 2, destinationCount: 1, repairCandidateCreated: true });
    expect(await repository.repairCandidates("cell_ara")).toContainEqual(expect.objectContaining({ status: "OPEN", sourceCount: 2, destinationCount: 1 }));
    expect(provider.checkpoint).toHaveBeenCalledWith("signalloop:workspace_ara", "SHARED_RECORD");
    expect(await repository.status("cell_ara")).toMatchObject({ sourceCount: 2 });
  });

  it("reconciles each stream independently and deduplicates one open repair until resolution", async () => {
    const repository = createInMemoryIntegrationDeliveryRepository();
    await repository.withSourceMutation!(async (transaction) => {
      await transaction.writeSource("shared:1", { stream: "SHARED_RECORD", version: 2 });
      await transaction.writeSource("workflow:1", { stream: "WORKFLOW_EVENT", version: 1 });
    });
    const provider = { checkpoint: vi.fn().mockResolvedValue({ count: 0, version: 0, checkpoint: null }) };
    const context = { actorId: "admin_1", correlationId: "corr_reconcile", reason: "Scheduled verification", now: new Date("2026-08-12T12:00:00Z") };
    await reconcileCellProjection("cell_ara", "destination", repository, provider, { ...context, stream: "SHARED_RECORD" });
    await reconcileCellProjection("cell_ara", "destination", repository, provider, { ...context, stream: "SHARED_RECORD" });
    await reconcileCellProjection("cell_ara", "destination", repository, provider, { ...context, stream: "WORKFLOW_EVENT" });
    expect(await repository.repairCandidates("cell_ara")).toEqual(expect.arrayContaining([
      expect.objectContaining({ stream: "SHARED_RECORD", status: "OPEN", sourceVersion: 2 }),
      expect.objectContaining({ stream: "WORKFLOW_EVENT", status: "OPEN", sourceVersion: 1 })
    ]));
    expect((await repository.repairCandidates("cell_ara")).filter((candidate) => candidate.stream === "SHARED_RECORD")).toHaveLength(1);

    provider.checkpoint.mockResolvedValueOnce({ count: 1, version: 2, checkpoint: "source:SHARED_RECORD:1:2" });
    const matched = await reconcileCellProjection("cell_ara", "destination", repository, provider, { ...context, stream: "SHARED_RECORD", correlationId: "corr_resolve" });
    expect(matched.matched).toBe(true);
    expect(await repository.repairCandidates("cell_ara")).toContainEqual(expect.objectContaining({ stream: "SHARED_RECORD", status: "RESOLVED" }));
    expect(await repository.auditEvents()).toContainEqual(expect.objectContaining({ action: "integration-projection.repair-resolved", correlationId: "corr_resolve" }));
  });
});
