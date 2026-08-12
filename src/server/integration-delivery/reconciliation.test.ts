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
    const provider = { checkpoint: vi.fn().mockResolvedValue({ count: 1, checkpoint: "destination:1" }) };

    const result = await reconcileCellProjection("cell_ara", "signalloop:workspace_ara", repository, provider, {
      actorId: "admin_1", correlationId: "corr_reconcile", reason: "Scheduled verification", now: new Date("2026-08-12T12:00:00Z")
    });

    expect(result).toMatchObject({ matched: false, sourceCount: 2, destinationCount: 1, repairCandidateCreated: true });
    expect(await repository.repairCandidates("cell_ara")).toContainEqual(expect.objectContaining({ status: "OPEN", sourceCount: 2, destinationCount: 1 }));
    expect(provider.checkpoint).toHaveBeenCalledTimes(1);
    expect(await repository.status("cell_ara")).toMatchObject({ sourceCount: 2 });
  });
});
