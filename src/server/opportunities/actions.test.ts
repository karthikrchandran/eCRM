import { describe, expect, it } from "vitest";
import {
  parseOpportunityFormForTest,
  parsePipelineStageFormForTest,
  parseSalesTargetFormForTest,
  parseSplitsFormForTest
} from "./actions";

describe("opportunity actions", () => {
  it("parses opportunity form data and split rows", () => {
    const formData = new FormData();
    formData.set("leadCustomerId", "lead_1");
    formData.set("branchId", "");
    formData.set("stageId", "stage_qualified");
    formData.set("ownerId", "user_sales");
    formData.set("title", " eLearning rollout ");
    formData.set("productInterest", " Custom LMS ");
    formData.set("estimatedValueInr", "125000");
    formData.set("probability", "60");
    formData.append("splitUserId", "user_sales");
    formData.append("splitUserId", "user_admin");
    formData.append("splitPercent", "70");
    formData.append("splitPercent", "30");

    expect(parseOpportunityFormForTest(formData)).toMatchObject({
      ok: true,
      data: {
        leadCustomerId: "lead_1",
        branchId: undefined,
        stageId: "stage_qualified",
        ownerId: "user_sales",
        title: "eLearning rollout",
        productInterest: "Custom LMS",
        estimatedValueInr: "125000.00",
        probability: 60
      }
    });
    expect(parseSplitsFormForTest(formData)).toEqual([
      { userId: "user_sales", percent: 70 },
      { userId: "user_admin", percent: 30 }
    ]);
  });

  it("returns opportunity validation errors", () => {
    const formData = new FormData();
    formData.set("leadCustomerId", "");
    formData.set("stageId", "");
    formData.set("ownerId", "");
    formData.set("title", "");

    expect(parseOpportunityFormForTest(formData)).toEqual({
      ok: false,
      fieldErrors: {
        leadCustomerId: ["Choose a lead or customer."],
        stageId: ["Choose a pipeline stage."],
        ownerId: ["Choose an owner."],
        title: ["Enter an opportunity title."]
      }
    });
  });

  it("parses pipeline stage and target forms", () => {
    const stage = new FormData();
    stage.set("name", " Proposal Sent ");
    stage.set("sortOrder", "30");
    stage.set("kind", "OPEN");
    stage.set("active", "on");

    expect(parsePipelineStageFormForTest(stage)).toEqual({
      ok: true,
      data: { name: "Proposal Sent", sortOrder: 30, kind: "OPEN", active: true }
    });

    const target = new FormData();
    target.set("ownerId", "user_sales");
    target.set("financialYear", "2026");
    target.set("quarter", "2");
    target.set("targetValueInr", "750000");

    expect(parseSalesTargetFormForTest(target)).toEqual({
      ok: true,
      data: { ownerId: "user_sales", financialYear: 2026, quarter: 2, targetValueInr: "750000.00" }
    });
  });
});
