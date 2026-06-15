import { describe, expect, it } from "vitest";
import { productionFiltersSchema, productionStageStatusInputSchema } from "./validators";

describe("production validators", () => {
  it("requires skipped reason when skipping a stage", () => {
    expect(productionStageStatusInputSchema.safeParse({ status: "SKIPPED" }).success).toBe(false);
    expect(productionStageStatusInputSchema.safeParse({ skippedReason: "Client cancelled step", status: "SKIPPED" }).success).toBe(true);
  });

  it("normalizes empty production filters", () => {
    const parsed = productionFiltersSchema.parse({ assignedToId: "", q: "", status: "" });

    expect(parsed).toEqual({});
  });
});
