import { describe, expect, it, vi } from "vitest";
import {
  acceptSuggestedAction,
  completeSalesTask,
  createSalesTask,
  createSalesTextNote,
  createSalesVoiceNote,
  deleteSalesTextNote,
  reopenSalesTask,
  saveEndOfDayReview,
  updateSalesTask,
  updateSalesTextNote
} from "./mutations";
import type { SalesDayUser } from "./permissions";

const salesUser: SalesDayUser = { id: "sales_1", organizationId: "org_test", role: "SALES" };

describe("sales-day mutations", () => {
  it("completes a salesperson's task with completed timestamp", async () => {
    const database = {
      $queryRaw: vi.fn().mockResolvedValue([{ allowed: true }]),
      salesTask: {
        findFirst: vi.fn().mockResolvedValue({ id: "task_1", ownerId: "sales_1" }),
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
      $queryRaw: vi.fn().mockResolvedValue([{ allowed: true }]),
      salesTask: {
        findFirst: vi.fn().mockResolvedValue({ id: "task_1", ownerId: "sales_1" }),
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
      $queryRaw: vi.fn().mockResolvedValue([{ allowed: true }]),
      salesVoiceNoteAction: {
        findFirst: vi.fn().mockResolvedValue({
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
        organizationId: "org_test",
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
      $queryRaw: vi.fn().mockResolvedValue([{ allowed: true }]),
      salesVoiceNoteAction: {
        findFirst: vi.fn().mockResolvedValue({
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
      $queryRaw: vi.fn().mockResolvedValue([{ allowed: true }]),
      salesDayReview: {
        upsert: vi.fn().mockResolvedValue({ id: "review_1" })
      },
      salesDayReviewItem: {
        upsert: vi.fn().mockResolvedValue({ id: "item_1" })
      },
      salesTask: {
        findFirst: vi.fn().mockResolvedValue({
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
      $queryRaw: vi.fn().mockResolvedValue([{ allowed: true }]),
      salesTask: {
        findFirst: vi.fn().mockResolvedValue({ id: "task_1", ownerId: "other_sales" }),
        update: vi.fn()
      }
    };

    await expect(completeSalesTask(salesUser, "task_1", database)).rejects.toThrow(
      "You can only update your own My Day tasks."
    );
    expect(database.salesTask.update).not.toHaveBeenCalled();
  });

  it("creates a typed My Day note linked to CRM records", async () => {
    const database = {
      $queryRaw: vi.fn().mockResolvedValue([{ allowed: true }]),
      leadCustomer: { findFirst: vi.fn().mockResolvedValue({ id: "lead_1" }) },
      opportunity: { findFirst: vi.fn().mockResolvedValue({ id: "opp_1" }) },
      salesTextNote: {
        create: vi.fn().mockResolvedValue({ id: "text_note_1" })
      }
    };

    await createSalesTextNote(
      salesUser,
      {
        body: "Client prefers USD pricing with tax entered manually.",
        leadCustomerId: "lead_1",
        opportunityId: "opp_1"
      },
      database
    );

    expect(database.salesTextNote.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org_test",
        body: "Client prefers USD pricing with tax entered manually.",
        ownerId: "sales_1",
        leadCustomerId: "lead_1",
        opportunityId: "opp_1",
        proposalId: null,
        orderId: null,
        taskId: null
      },
      select: { id: true }
    });
  });

  it("updates and deletes only notes owned by the signed-in salesperson", async () => {
    const database = {
      $queryRaw: vi.fn().mockResolvedValue([{ allowed: true }]),
      order: { findFirst: vi.fn().mockResolvedValue({ id: "order_1" }) },
      salesTextNote: {
        findFirst: vi.fn().mockResolvedValue({ id: "text_note_1", ownerId: "sales_1" }),
        update: vi.fn().mockResolvedValue({ id: "text_note_1" }),
        delete: vi.fn().mockResolvedValue({ id: "text_note_1" })
      }
    };

    await updateSalesTextNote(salesUser, "text_note_1", { body: "Updated note", orderId: "order_1" }, database);
    await deleteSalesTextNote(salesUser, "text_note_1", database);

    expect(database.salesTextNote.update).toHaveBeenCalledWith({
      where: { id: "text_note_1" },
      data: {
        body: "Updated note",
        leadCustomerId: null,
        opportunityId: null,
        proposalId: null,
        orderId: "order_1",
        taskId: null
      },
      select: { id: true }
    });
    expect(database.salesTextNote.delete).toHaveBeenCalledWith({
      where: { id: "text_note_1" },
      select: { id: true }
    });
  });

  it.each([
    ["task create", (database: unknown) => createSalesTask(salesUser, {
      title: "Call", type: "CALL", priority: "MEDIUM", leadCustomerId: "lead_B"
    } as never, database as never), "salesTask"],
    ["task update", (database: unknown) => updateSalesTask(salesUser, "task_A", {
      opportunityId: "opportunity_B"
    } as never, database as never), "salesTask"],
    ["text note", (database: unknown) => createSalesTextNote(salesUser, {
      body: "Private", proposalId: "proposal_B"
    }, database as never), "salesTextNote"],
    ["voice note", (database: unknown) => createSalesVoiceNote(salesUser, {
      audioStorageKey: "audio/A", fileSizeBytes: 1, mimeType: "audio/webm",
      originalFileName: "note.webm", orderId: "order_B", taskId: "task_B"
    }, database as never), "salesVoiceNote"]
  ])("rejects cross-organization optional foreign IDs for %s", async (_name, mutate, writeModel) => {
    const database = {
      $queryRaw: vi.fn().mockResolvedValue([{ allowed: true }]),
      leadCustomer: { findFirst: vi.fn().mockResolvedValue(null) },
      opportunity: { findFirst: vi.fn().mockResolvedValue(null) },
      proposal: { findFirst: vi.fn().mockResolvedValue(null) },
      order: { findFirst: vi.fn().mockResolvedValue(null) },
      salesTask: {
        findFirst: vi.fn().mockImplementation(({ where }) =>
          where.id === "task_A" ? Promise.resolve({ id: "task_A", ownerId: "sales_1" }) : Promise.resolve(null)),
        create: vi.fn(), update: vi.fn()
      },
      salesTextNote: { create: vi.fn() },
      salesVoiceNote: { create: vi.fn() }
    };

    await expect(mutate(database)).rejects.toThrow("Related record was not found.");
    expect((database as Record<string, { create?: ReturnType<typeof vi.fn>; update?: ReturnType<typeof vi.fn> }>)[writeModel].create ??
      (database as Record<string, { update?: ReturnType<typeof vi.fn> }>)[writeModel].update).not.toHaveBeenCalled();
  });

  it.each([
    ["task", (database: unknown) => createSalesTask(salesUser, { title: "Call", type: "CALL", priority: "MEDIUM" } as never, database as never)],
    ["text note", (database: unknown) => createSalesTextNote(salesUser, { body: "Note" }, database as never)],
    ["voice note", (database: unknown) => createSalesVoiceNote(salesUser, {
      audioStorageKey: "audio/A", fileSizeBytes: 1, mimeType: "audio/webm", originalFileName: "note.webm"
    }, database as never)]
  ])("rejects a revoked current owner before creating %s", async (_name, mutate) => {
    const database = {
      $queryRaw: vi.fn().mockResolvedValue([{ allowed: false }]),
      salesTask: { create: vi.fn() },
      salesTextNote: { create: vi.fn() },
      salesVoiceNote: { create: vi.fn() }
    };
    await expect(mutate(database)).rejects.toThrow("Organization member was not found.");
    expect(database.salesTask.create).not.toHaveBeenCalled();
    expect(database.salesTextNote.create).not.toHaveBeenCalled();
    expect(database.salesVoiceNote.create).not.toHaveBeenCalled();
  });
});
