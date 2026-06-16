import { describe, expect, it, vi } from "vitest";
import { acceptSuggestedAction, completeSalesTask, reopenSalesTask, saveEndOfDayReview } from "./mutations";
import type { SalesDayUser } from "./permissions";

const salesUser: SalesDayUser = { id: "sales_1", role: "SALES" };

describe("sales-day mutations", () => {
  it("completes a salesperson's task with completed timestamp", async () => {
    const database = {
      salesTask: {
        findUnique: vi.fn().mockResolvedValue({ id: "task_1", ownerId: "sales_1" }),
        update: vi.fn().mockResolvedValue({ id: "task_1" })
      }
    };

    await completeSalesTask(salesUser, "task_1", database);

    expect(database.salesTask.update).toHaveBeenCalledWith({
      where: { id: "task_1" },
      data: {
        status: "COMPLETED",
        completedAt: expect.any(Date),
        cancelledAt: null
      },
      select: { id: true }
    });
  });

  it("reopens a completed task and clears completion state", async () => {
    const database = {
      salesTask: {
        findUnique: vi.fn().mockResolvedValue({ id: "task_1", ownerId: "sales_1" }),
        update: vi.fn().mockResolvedValue({ id: "task_1" })
      }
    };

    await reopenSalesTask(salesUser, "task_1", database);

    expect(database.salesTask.update).toHaveBeenCalledWith({
      where: { id: "task_1" },
      data: {
        status: "OPEN",
        completedAt: null,
        cancelledAt: null
      },
      select: { id: true }
    });
  });

  it("accepts a draft suggested action by creating one task and marking the action accepted", async () => {
    const database = {
      salesVoiceNoteAction: {
        findUnique: vi.fn().mockResolvedValue({
          id: "action_1",
          status: "DRAFT",
          title: "Send pricing sheet",
          description: "Client asked for commercial options",
          type: "SEND_MATERIAL",
          suggestedDueAt: new Date("2026-06-18T09:00:00.000Z"),
          createdTaskId: null,
          voiceNote: {
            id: "note_1",
            ownerId: "sales_1",
            leadCustomerId: "lead_1",
            opportunityId: "opp_1",
            proposalId: null,
            orderId: null
          }
        }),
        update: vi.fn().mockResolvedValue({ id: "action_1" })
      },
      salesTask: {
        create: vi.fn().mockResolvedValue({ id: "created_task" })
      }
    };

    const result = await acceptSuggestedAction(salesUser, "action_1", database);

    expect(database.salesTask.create).toHaveBeenCalledWith({
      data: {
        ownerId: "sales_1",
        leadCustomerId: "lead_1",
        opportunityId: "opp_1",
        proposalId: null,
        orderId: null,
        title: "Send pricing sheet",
        description: "Client asked for commercial options",
        type: "SEND_MATERIAL",
        priority: "MEDIUM",
        source: "VOICE_NOTE",
        dueAt: new Date("2026-06-18T09:00:00.000Z"),
        createdFromNoteId: "note_1"
      },
      select: { id: true }
    });
    expect(database.salesVoiceNoteAction.update).toHaveBeenCalledWith({
      where: { id: "action_1" },
      data: { status: "ACCEPTED", acceptedAt: expect.any(Date), createdTaskId: "created_task" },
      select: { id: true }
    });
    expect(result).toEqual({ id: "created_task" });
  });

  it("does not create a second task when accepting an already accepted action", async () => {
    const database = {
      salesVoiceNoteAction: {
        findUnique: vi.fn().mockResolvedValue({
          id: "action_1",
          status: "ACCEPTED",
          createdTaskId: "existing_task",
          voiceNote: { ownerId: "sales_1" }
        }),
        update: vi.fn()
      },
      salesTask: {
        create: vi.fn()
      }
    };

    await expect(acceptSuggestedAction(salesUser, "action_1", database)).resolves.toEqual({ id: "existing_task" });
    expect(database.salesTask.create).not.toHaveBeenCalled();
  });

  it("saves end-of-day carry-forward without deleting the original task", async () => {
    const database = {
      salesDayReview: {
        upsert: vi.fn().mockResolvedValue({ id: "review_1" })
      },
      salesDayReviewItem: {
        upsert: vi.fn().mockResolvedValue({ id: "item_1" })
      },
      salesTask: {
        findUnique: vi.fn().mockResolvedValue({
          id: "task_1",
          ownerId: "sales_1",
          leadCustomerId: "lead_1",
          opportunityId: null,
          proposalId: null,
          orderId: null,
          title: "Call client",
          description: "Discuss revised proposal",
          type: "CALL",
          priority: "HIGH"
        }),
        create: vi.fn().mockResolvedValue({ id: "tomorrow_task" }),
        update: vi.fn().mockResolvedValue({ id: "task_1" })
      }
    };

    await saveEndOfDayReview(
      salesUser,
      {
        reviewDate: new Date("2026-06-17T00:00:00.000Z"),
        notes: "Move one call",
        items: [{ taskId: "task_1", status: "MOVE_TO_TOMORROW", note: "Client asked to talk tomorrow" }]
      },
      database
    );

    expect(database.salesTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: "sales_1",
        title: "Call client",
        source: "CARRY_FORWARD",
        dueAt: new Date("2026-06-18T09:00:00.000Z")
      }),
      select: { id: true }
    });
    expect(database.salesTask.update).toHaveBeenCalledWith({
      where: { id: "task_1" },
      data: { status: "CARRIED_FORWARD" },
      select: { id: true }
    });
  });

  it("rejects mutation attempts for another salesperson's task", async () => {
    const database = {
      salesTask: {
        findUnique: vi.fn().mockResolvedValue({ id: "task_1", ownerId: "other_sales" }),
        update: vi.fn()
      }
    };

    await expect(completeSalesTask(salesUser, "task_1", database)).rejects.toThrow(
      "You can only update your own My Day tasks."
    );
    expect(database.salesTask.update).not.toHaveBeenCalled();
  });
});
