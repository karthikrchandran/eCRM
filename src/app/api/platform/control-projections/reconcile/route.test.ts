import { describe, expect, it, vi } from "vitest";

import { createControlProjectionReconciliationHandler } from "./route";

describe("platform control-projection reconciliation API", () => {
  it("is hidden outside platform mode and does not run reconciliation", async () => {
    const reconcile = vi.fn();
    const handler = createControlProjectionReconciliationHandler({
      authorize: () => Response.json({ error: "Not found." }, { status: 404 }),
      reconcile
    });

    const response = await handler(new Request("http://localhost/api/platform/control-projections/reconcile", { method: "POST" }));

    expect(response.status).toBe(404);
    expect(reconcile).not.toHaveBeenCalled();
  });

  it("runs one authenticated bounded batch without accepting a caller-selected worker identity", async () => {
    const reconcile = vi.fn().mockResolvedValue({ attempted: 2, converged: 2, failed: 0, deadLettered: 0 });
    const handler = createControlProjectionReconciliationHandler({
      authorize: () => ({ actor: "platform-worker@example.com" }),
      reconcile,
      createWorkerId: () => "worker-route"
    });

    const response = await handler(new Request("http://localhost/api/platform/control-projections/reconcile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ batchSize: 2, workerId: "attacker-selected" })
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ attempted: 2, converged: 2, failed: 0, deadLettered: 0 });
    expect(reconcile).toHaveBeenCalledWith(expect.objectContaining({ workerId: "worker-route", batchSize: 2 }));
  });
});
