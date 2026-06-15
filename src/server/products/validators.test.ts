import { describe, expect, it } from "vitest";
import { productServiceInputSchema } from "./validators";

describe("product service validators", () => {
  it("normalizes catalog input and defaults GST to 18 percent", () => {
    const parsed = productServiceInputSchema.parse({
      name: "  Custom eLearning Module  ",
      code: " elm-001 ",
      category: " eLearning ",
      description: "  Storyboard, build, and review  ",
      defaultGstRateBps: "",
      defaultProductionTemplateKey: " elearning ",
      active: "on",
      sortOrder: "10"
    });

    expect(parsed).toEqual({
      name: "Custom eLearning Module",
      code: "ELM-001",
      category: "eLearning",
      description: "Storyboard, build, and review",
      defaultGstRateBps: 1800,
      defaultProductionTemplateKey: "elearning",
      active: true,
      sortOrder: 10
    });
  });

  it("requires core catalog fields and GST basis points in range", () => {
    const result = productServiceInputSchema.safeParse({
      name: " ",
      category: " ",
      defaultGstRateBps: "2900",
      active: "on",
      sortOrder: "-1"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain("Enter a product or service name.");
      expect(result.error.flatten().fieldErrors.category).toContain("Enter a product or service category.");
      expect(result.error.flatten().fieldErrors.defaultGstRateBps).toContain("Enter GST basis points from 0 to 2800.");
      expect(result.error.flatten().fieldErrors.sortOrder).toContain("Enter a sort order of 0 or greater.");
    }
  });
});
