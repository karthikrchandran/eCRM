import { describe, expect, it } from "vitest";

import { ProductionCellProvider } from "./production-driver";

describe("ProductionCellProvider", () => {
  it("rejects aggregated missing database storage secret and backup configuration before resource creation", async () => {
    let invocations = 0;
    const provider = new ProductionCellProvider({
      config: {},
      adapters: {
        createDatabase: async () => {
          invocations += 1;
          return { reference: "should-not-run" };
        }
      }
    });

    await expect(provider.createDatabase({ cellId: "cell_ara", customerKey: "ara-global", correlationId: "corr-1" })).rejects.toThrow(
      /database.*storage.*secret.*backup/i
    );
    expect(invocations).toBe(0);
  });
});
