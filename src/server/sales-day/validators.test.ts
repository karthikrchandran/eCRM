import { describe, expect, it } from "vitest";
import {
  acceptSuggestedActionSchema,
  salesDayReviewSchema,
  salesTaskInputSchema,
  salesTaskUpdateSchema,
  salesVoiceNoteUploadMetadataSchema
} from "./validators";

describe("sales-day validators", () => {
  it("normalizes task input for manual daily planning", () => {
    const parsed = salesTaskInputSchema.parse({
      title: "  Call Acme Learning  ",
      description: " Discuss LMS proposal ",
      type: "CALL",
      priority: "HIGH",
      dueAt: "2026-06-17T16:00",
      leadCustomerId: "lead_1",
      opportunityId: "",
      proposalId: "",
      orderId: ""
    });

    expect(parsed).toMatchObject({
      title: "Call Acme Learning",
      description: "Discuss LMS proposal",
      type: "CALL",
      priority: "HIGH",
      leadCustomerId: "lead_1",
      opportunityId: undefined,
      proposalId: undefined,
      orderId: undefined
    });
    expect(parsed.dueAt).toBeInstanceOf(Date);
  });

  it("requires a title and valid task enum values", () => {
    const result = salesTaskInputSchema.safeParse({
      title: " ",
      type: "UNKNOWN",
      priority: "IMPORTANT"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.title).toContain("Enter a task title.");
      expect(errors.type).toBeDefined();
      expect(errors.priority).toBeDefined();
    }
  });

  it("normalizes task updates without forcing all fields", () => {
    expect(
      salesTaskUpdateSchema.parse({
        title: " Send pricing sheet ",
        description: "",
        dueAt: "",
        priority: "URGENT"
      })
    ).toEqual({
      title: "Send pricing sheet",
      description: undefined,
      dueAt: undefined,
      priority: "URGENT"
    });
  });

  it("validates voice note upload metadata", () => {
    expect(
      salesVoiceNoteUploadMetadataSchema.parse({
        taskId: "task_1",
        leadCustomerId: "",
        durationSeconds: "134"
      })
    ).toEqual({
      taskId: "task_1",
      leadCustomerId: undefined,
      durationSeconds: 134
    });
  });

  it("normalizes missing FormData voice note metadata fields", () => {
    expect(
      salesVoiceNoteUploadMetadataSchema.parse({
        taskId: null,
        leadCustomerId: null,
        opportunityId: null,
        proposalId: null,
        orderId: null,
        durationSeconds: null
      })
    ).toEqual({
      taskId: undefined,
      leadCustomerId: undefined,
      opportunityId: undefined,
      proposalId: undefined,
      orderId: undefined,
      durationSeconds: undefined
    });
  });

  it("validates suggested action acceptance", () => {
    expect(acceptSuggestedActionSchema.parse({ actionId: "action_1" })).toEqual({
      actionId: "action_1"
    });
    expect(acceptSuggestedActionSchema.safeParse({ actionId: "" }).success).toBe(false);
  });

  it("requires review statuses for selected end-of-day tasks", () => {
    const parsed = salesDayReviewSchema.parse({
      reviewDate: "2026-06-17",
      notes: "  Good follow-up day  ",
      items: [
        { taskId: "task_1", status: "DONE", note: "" },
        { taskId: "task_2", status: "MOVE_TO_TOMORROW", note: "Send revised commercial" }
      ]
    });

    expect(parsed.notes).toBe("Good follow-up day");
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0]).toEqual({ taskId: "task_1", status: "DONE", note: undefined });
    expect(parsed.reviewDate).toBeInstanceOf(Date);
  });
});
