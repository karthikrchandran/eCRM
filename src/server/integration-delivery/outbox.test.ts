import { describe, expect, it, vi } from "vitest";

import {
  CellIntegrationDeliveryService,
  createInMemoryIntegrationDeliveryRepository,
  type DestinationProvider
} from "./outbox";

const now = new Date("2026-08-12T12:00:00Z");
const source = {
  cellId: "cell_ara",
  eventType: "shared-record.changed",
  payloadVersion: 1,
  payload: { recordId: "shared_1", customerName: "secret business data" },
  correlationId: "corr_1",
  idempotencyKey: "shared_1:1",
  destinationInstallation: "signalloop:workspace_ara"
};

describe("cell integration outbox", () => {
  it("stores a source mutation and outbox intent atomically and never copies payload into audit", async () => {
    const repository = createInMemoryIntegrationDeliveryRepository();
    await expect(repository.withSourceMutation!(async (transaction) => {
      await transaction.writeSource("shared_1", { version: 1 });
      await transaction.enqueue(source);
      throw new Error("source failed");
    })).rejects.toThrow("source failed");
    expect(await repository.status("cell_ara")).toMatchObject({ pending: 0, sourceCount: 0 });

    await repository.withSourceMutation!(async (transaction) => {
      await transaction.writeSource("shared_1", { version: 1 });
      await transaction.enqueue(source);
    });
    const status = await repository.status("cell_ara");
    expect(status).toMatchObject({ pending: 1, sourceCount: 1 });
    expect(JSON.stringify(await repository.auditEvents())).not.toContain("secret business data");
  });

  it("uses leased compare-and-swap claims so concurrent workers cannot own one event", async () => {
    const repository = createInMemoryIntegrationDeliveryRepository();
    await repository.enqueue(source);
    const [first, second] = await Promise.all([
      repository.claim("cell_ara", "worker_a", now, 30_000),
      repository.claim("cell_ara", "worker_b", now, 30_000)
    ]);
    expect([first, second].filter(Boolean)).toHaveLength(1);
    const claimed = first ?? second!;
    const staleFence = claimed.fenceToken!;
    const heartbeated = await repository.heartbeat(claimed.id, staleFence, new Date(now.getTime() + 1_000), 30_000);
    expect(heartbeated.fenceToken).not.toBe(staleFence);
    await expect(repository.ack(claimed.id, staleFence, new Date())).rejects.toThrow("Lease fence rejected");
  });

  it("commits delivered only after remote acknowledgement and safely retries an ambiguous acknowledgement", async () => {
    const repository = createInMemoryIntegrationDeliveryRepository();
    await repository.enqueue(source);
    const provider: DestinationProvider = {
      deliver: vi.fn()
        .mockRejectedValueOnce(Object.assign(new Error("timeout after send"), { code: "AMBIGUOUS_ACK" }))
        .mockResolvedValueOnce({ acknowledgementId: "ack_1", checkpoint: "cp_1" }),
      reconcileIdempotency: vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce({ acknowledgementId: "ack_1", checkpoint: "cp_1" }),
      checkpoint: vi.fn()
    };
    const worker = new CellIntegrationDeliveryService(repository, provider, {
      now: () => now, random: () => 0, maxAttempts: 3, baseDelayMs: 1_000, maxDelayMs: 10_000, leaseMs: 30_000
    });

    await worker.runOnce("cell_ara", "worker_a");
    expect(await repository.status("cell_ara")).toMatchObject({ delivered: 0, failed: 1 });
    await worker.runOnce("cell_ara", "worker_a", new Date(now.getTime() + 1_000));
    expect(await repository.status("cell_ara")).toMatchObject({ delivered: 1, failed: 0, checkpoint: "cp_1" });
    expect(provider.deliver).toHaveBeenCalledTimes(1);
    expect(provider.reconcileIdempotency).toHaveBeenLastCalledWith(source.destinationInstallation, source.idempotencyKey);
  });

  it("dead-letters after bounded retry exhaustion and replays only with an operator reason", async () => {
    const repository = createInMemoryIntegrationDeliveryRepository();
    await repository.enqueue(source);
    const provider: DestinationProvider = {
      deliver: vi.fn().mockRejectedValue(Object.assign(new Error("destination unavailable"), { code: "REMOTE_503" })),
      reconcileIdempotency: vi.fn(), checkpoint: vi.fn()
    };
    const worker = new CellIntegrationDeliveryService(repository, provider, {
      now: () => now, random: () => 0, maxAttempts: 2, baseDelayMs: 100, maxDelayMs: 1_000, leaseMs: 30_000
    });
    await worker.runOnce("cell_ara", "worker_a", now);
    await worker.runOnce("cell_ara", "worker_a", new Date(now.getTime() + 100));
    expect(await repository.status("cell_ara")).toMatchObject({ deadLetter: 1, degraded: true });
    const dead = (await repository.deadLetters("cell_ara"))[0];
    await expect(repository.replay(dead.id, "admin_1", "", now)).rejects.toThrow("Replay reason is required");
    await repository.replay(dead.id, "admin_1", "Destination restored", now);
    expect(await repository.status("cell_ara")).toMatchObject({ pending: 1, deadLetter: 0 });
    expect(await repository.auditEvents()).toContainEqual(expect.objectContaining({ action: "integration-outbox.replay", reason: "Destination restored" }));
  });
});
