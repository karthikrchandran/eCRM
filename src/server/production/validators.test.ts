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

  it("normalizes assignment and due date stage inputs", () => {
    const parsed = productionStageStatusInputSchema.parse({
      assignedToId: "user_sales",
      dueAt: "2026-08-15",
      status: "IN_PROGRESS"
    });

    expect(parsed.assignedToId).toBe("user_sales");
    expect(parsed.dueAt).toEqual(new Date("2026-08-15"));
  });
});
