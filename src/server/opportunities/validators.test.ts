import { describe, expect, it } from "vitest";
import {
  opportunityFilterSchema,
  opportunityInputSchema,
  pipelineStageInputSchema,
  salesTargetInputSchema
} from "./validators";

describe("opportunity validators", () => {
  it("normalizes opportunity input", () => {
    const parsed = opportunityInputSchema.parse({
      leadCustomerId: "lead_1",
      branchId: "",
      stageId: "stage_qualified",
      ownerId: "user_sales",
      title: "  eLearning rollout  ",
      productInterest: " Custom LMS ",
      estimatedValueInr: "125000.50",
      probability: "60",
      lastReachAt: "2026-06-14T10:00",
      nextFollowUpAt: "2026-06-20T10:00",
      notes: " Needs proposal "
    });

    expect(parsed).toMatchObject({
      leadCustomerId: "lead_1",
      branchId: undefined,
      stageId: "stage_qualified",
      ownerId: "user_sales",
      title: "eLearning rollout",
      productInterest: "Custom LMS",
      estimatedValueInr: "125000.50",
      probability: 60,
      notes: "Needs proposal"
    });
    expect(parsed.lastReachAt).toBeInstanceOf(Date);
    expect(parsed.nextFollowUpAt).toBeInstanceOf(Date);
  });

  it("requires title, lead/customer, stage, and owner", () => {
    const result = opportunityInputSchema.safeParse({
      leadCustomerId: "",
      stageId: "",
      ownerId: "",
      title: " "
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.leadCustomerId).toContain("Choose a lead or customer.");
      expect(errors.stageId).toContain("Choose a pipeline stage.");
      expect(errors.ownerId).toContain("Choose an owner.");
      expect(errors.title).toContain("Enter an opportunity title.");
    }
  });

  it("rejects invalid probability and amount", () => {
    const result = opportunityInputSchema.safeParse({
      leadCustomerId: "lead_1",
      stageId: "stage_1",
      ownerId: "user_sales",
      title: "VR training",
      estimatedValueInr: "-1",
      probability: "101"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.estimatedValueInr).toContain("Enter a non-negative estimated value.");
      expect(errors.probability).toContain("Enter probability from 0 to 100.");
    }
  });

  it("normalizes stage and target input", () => {
    expect(
      pipelineStageInputSchema.parse({
        name: " Proposal Sent ",
        sortOrder: "30",
        kind: "OPEN",
        active: "on"
      })
    ).toEqual({ name: "Proposal Sent", sortOrder: 30, kind: "OPEN", active: true });

    expect(
      salesTargetInputSchema.parse({
        ownerId: "user_sales",
        financialYear: "2026",
        quarter: "1",
        targetValueInr: "500000"
      })
    ).toEqual({ ownerId: "user_sales", financialYear: 2026, quarter: 1, targetValueInr: "500000.00" });
  });

  it("parses list filters", () => {
    expect(
      opportunityFilterSchema.parse({
        q: " acme ",
        ownerId: "user_sales",
        stageId: "stage_1",
        followUp: "upcoming",
        view: "board"
      })
    ).toEqual({
      q: "acme",
      ownerId: "user_sales",
      stageId: "stage_1",
      followUp: "upcoming",
      view: "board"
    });
  });
});
