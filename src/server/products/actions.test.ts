import { describe, expect, it } from "vitest";
import { parseProductServiceFormForTest } from "./actions";

describe("product service actions", () => {
  it("parses product catalog forms", () => {
    const formData = new FormData();
    formData.set("name", " Custom eLearning Module ");
    formData.set("code", " elm-001 ");
    formData.set("category", " eLearning ");
    formData.set("defaultGstRateBps", "1800");
    formData.set("defaultProductionTemplateKey", "elearning");
    formData.set("active", "on");
    formData.set("sortOrder", "10");

    expect(parseProductServiceFormForTest(formData)).toEqual({
      ok: true,
      data: {
        name: "Custom eLearning Module",
        code: "ELM-001",
        category: "eLearning",
        defaultGstRateBps: 1800,
        defaultProductionTemplateKey: "elearning",
        active: true,
        sortOrder: 10
      }
    });
  });

  it("returns product validation errors", () => {
    const formData = new FormData();
    formData.set("name", "");
    formData.set("category", "");
    formData.set("defaultGstRateBps", "2900");
    formData.set("sortOrder", "-1");

    expect(parseProductServiceFormForTest(formData)).toEqual({
      ok: false,
      fieldErrors: {
        name: ["Enter a product or service name."],
        category: ["Enter a product or service category."],
        defaultGstRateBps: ["Enter GST basis points from 0 to 2800."],
        sortOrder: ["Enter a sort order of 0 or greater."]
      }
    });
  });
});
