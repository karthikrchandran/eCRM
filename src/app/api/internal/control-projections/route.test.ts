// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { createControlProjectionHandler } from "./route";

describe("cell control projection endpoint", () => {
  it("requires a signature and acknowledges durable application", async () => {
    const apply = vi.fn().mockResolvedValue({ applied: true, duplicate: false, version: 4 });
    const POST = createControlProjectionHandler({ apply });
    const payload = {
      cellId: "cell_ara", version: 4, type: "LIFECYCLE", correlationId: "corr_4",
      idempotencyKey: "lifecycle:cell_ara:SUSPENDED:corr_4", issuedAt: "2026-08-11T12:00:00.000Z",
      payload: { lifecycleStatus: "SUSPENDED", sourceEventId: "event_4" }
    };

    const missing = await POST(new Request("http://cell/api/internal/control-projections", {
      method: "POST", body: JSON.stringify(payload)
    }));
    expect(missing.status).toBe(401);
    expect(apply).not.toHaveBeenCalled();

    const response = await POST(new Request("http://cell/api/internal/control-projections", {
      method: "POST", body: JSON.stringify(payload), headers: { "x-cell-control-signature": "signed" }
    }));
    expect(response.status).toBe(200);
    expect(apply).toHaveBeenCalledWith(payload, "signed");
    await expect(response.json()).resolves.toEqual({ acknowledged: true, applied: true, duplicate: false, version: 4 });
  });

  it("fails closed without exposing verification details", async () => {
    const POST = createControlProjectionHandler({ apply: vi.fn().mockRejectedValue(new Error("Invalid control projection signature")) });
    const response = await POST(new Request("http://cell/api/internal/control-projections", {
      method: "POST", body: "{}", headers: { "x-cell-control-signature": "bad" }
    }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "Control projection rejected." });
  });
});
