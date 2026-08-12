import { describe, expect, it, vi } from "vitest";

import { runControlProjectionWorker } from "./control-projection-worker";

describe("control projection worker", () => {
  it("runs a real bounded reconciliation batch with worker-safe defaults", async () => {
    const reconcileControlProjections = vi.fn().mockResolvedValue({
      attempted: 3, converged: 2, failed: 1, deadLettered: 0
    });

    const result = await runControlProjectionWorker({ reconcileControlProjections }, {
      workerId: "worker-script", batchSize: 3, maxAttempts: 5, leaseDurationMs: 30_000, baseBackoffMs: 1_000
    });

    expect(result).toEqual({ attempted: 3, converged: 2, failed: 1, deadLettered: 0 });
    expect(reconcileControlProjections).toHaveBeenCalledWith({
      workerId: "worker-script", batchSize: 3, maxAttempts: 5, leaseDurationMs: 30_000, baseBackoffMs: 1_000
    });
  });
});
