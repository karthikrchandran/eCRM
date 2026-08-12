import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { HttpDestinationProvider } from "./provider";

describe("HttpDestinationProvider SignalLoop delivery contract", () => {
  it("posts the versioned eCRM envelope to the public installation route and translates its ACK", async () => {
    const contract = JSON.parse(readFileSync(join(process.cwd(), "docs/contracts/signalloop-ecrm-installation-delivery-v1.json"), "utf8")) as {
      route: string;
      request: { headers: Record<string, string>; body: Record<string, unknown> };
      acknowledgement: Record<string, unknown>;
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(contract.acknowledgement), {
      status: 202,
      headers: { "content-type": "application/json" }
    }));
    const provider = new HttpDestinationProvider(
      "http://127.0.0.1:8765",
      "route-token",
      { cellId: "cell-ara", cellKey: "ara-global" },
      fetcher
    );

    const acknowledgement = await provider.deliver("workspace-ara", {
      eventType: "shared-record.changed",
      payloadVersion: 7,
      payload: { recordId: "record-1" },
      correlationId: "corr-1",
      idempotencyKey: "shared-record:record-1:7"
    });

    expect(fetcher).toHaveBeenCalledWith(
      `http://127.0.0.1:8765${contract.route}`,
      expect.objectContaining({
        method: "POST",
        headers: {
          authorization: "Bearer route-token",
          "content-type": "application/json",
          "idempotency-key": "shared-record:record-1:7",
          "x-correlation-id": "corr-1",
          "x-ecrm-cell-id": "cell-ara",
          "x-ecrm-cell-key": "ara-global",
          "x-workspace-id": "workspace-ara"
        },
        body: JSON.stringify(contract.request.body)
      })
    );
    expect(acknowledgement).toEqual({ acknowledgementId: contract.acknowledgement.receipt_id });
  });

  it("fails closed when the destination ACK does not match the sent event and version", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      receipt_id: "receipt-1",
      workspace_id: "workspace-other",
      source_event_id: "shared-record:record-1:7",
      source_version: 7,
      status: "RECEIVED"
    }), { status: 202, headers: { "content-type": "application/json" } }));
    const provider = new HttpDestinationProvider(
      "http://127.0.0.1:8765",
      "route-token",
      { cellId: "cell-ara", cellKey: "ara-global" },
      fetcher
    );

    await expect(provider.deliver("workspace-ara", {
      eventType: "shared-record.changed",
      payloadVersion: 7,
      payload: { recordId: "record-1" },
      correlationId: "corr-1",
      idempotencyKey: "shared-record:record-1:7"
    })).rejects.toMatchObject({ code: "INVALID_ACK" });
  });

  it("does not call legacy SignalLoop routes for replay lookup or checkpoint reconciliation", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const provider = new HttpDestinationProvider(
      "http://127.0.0.1:8765",
      "route-token",
      { cellId: "cell-ara", cellKey: "ara-global" },
      fetcher
    );

    await expect(provider.reconcileIdempotency("workspace-ara", "event-1")).resolves.toBeUndefined();
    await expect(provider.checkpoint("workspace-ara", "SHARED_RECORD")).rejects.toMatchObject({
      code: "CHECKPOINT_CONTRACT_UNAVAILABLE"
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
