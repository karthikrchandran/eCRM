import { describe, expect, it } from "vitest";
import { demoProductionWorkItems } from "./seed-fixtures";

describe("seed production fixtures", () => {
  it("covers each default production product category", () => {
    expect(demoProductionWorkItems.map((item) => item.productCategorySnapshot)).toEqual([
      "eLearning",
      "Video shoot",
      "VR/AR",
      "Animation"
    ]);
  });

  it("keeps one or two production rows in progress for demo visibility", () => {
    expect(demoProductionWorkItems.filter((item) => item.status === "IN_PROGRESS")).toHaveLength(2);
  });
});
