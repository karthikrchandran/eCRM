import { describe, expect, it, vi } from "vitest";

import { mutateWithCellOutbox } from "./source-outbox";

describe("transactional source outbox", () => {
  it("uses runtime cell identity and one database transaction for source and outbox writes", async () => {
    const sourceCreate = vi.fn().mockResolvedValue({ id: "source_1", version: 2 });
    const outboxCreate = vi.fn().mockResolvedValue({ id: "outbox_1" });
    const transaction = { source: { create: sourceCreate }, cellIntegrationOutbox: { upsert: outboxCreate } };
    const database = { $transaction: vi.fn(async (operation) => operation(transaction)) };

    const result = await mutateWithCellOutbox({
      database,
      runtime: { mode: "cell", cellId: "cell_ara", cellKey: "ara" },
      destinationInstallation: "signalloop:workspace_ara",
      eventType: "shared-record.changed",
      correlationId: "corr_1",
      idempotencyKey: "shared_1:2",
      mutate: (tx) => (tx.source as typeof transaction.source).create({ data: { id: "source_1" } }),
      payload: (record: { id: string; version: number }) => ({ recordId: record.id }),
      payloadVersion: (record: { id: string; version: number }) => record.version
    });

    expect(result).toEqual({ id: "source_1", version: 2 });
    expect(database.$transaction).toHaveBeenCalledTimes(1);
    expect(outboxCreate).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ cellId: "cell_ara", destinationInstallation: "signalloop:workspace_ara", payloadVersion: 2 }),
      update: {}
    }));
  });

  it("rejects platform mode and missing server-owned destination before writing", async () => {
    const database = { $transaction: vi.fn() };
    const base = {
      database,
      eventType: "record.changed", correlationId: "corr", idempotencyKey: "key",
      mutate: vi.fn(), payload: vi.fn(), payloadVersion: vi.fn()
    };
    await expect(mutateWithCellOutbox({ ...base, runtime: { mode: "platform" }, destinationInstallation: "destination" })).rejects.toThrow("Cell runtime required");
    await expect(mutateWithCellOutbox({ ...base, runtime: { mode: "cell", cellId: "cell_1", cellKey: "one" }, destinationInstallation: "" })).rejects.toThrow("Destination installation is not configured");
    expect(database.$transaction).not.toHaveBeenCalled();
  });
});
