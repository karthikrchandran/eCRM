import { describe, expect, it, vi } from "vitest";
import { loadMyDay, loadMyDayInsights } from "./queries";
import type { SalesDayUser } from "./permissions";

const salesUser: SalesDayUser = { id: "sales_1", role: "SALES" };
const selectedDate = new Date("2026-06-17T10:00:00.000Z");

function task(overrides: Record<string, unknown>) {
  return {
    id: "task_1",
    ownerId: "sales_1",
    title: "Call Acme",
    description: null,
    type: "CALL",
    priority: "MEDIUM",
    status: "OPEN",
    source: "MANUAL",
    dueAt: new Date("2026-06-17T15:00:00.000Z"),
    completedAt: null,
    createdAt: new Date("2026-06-16T15:00:00.000Z"),
    leadCustomer: { id: "lead_1", name: "Acme Learning" },
    opportunity: null,
    proposal: null,
    order: null,
    voiceNotes: [],
    ...overrides
  };
}

describe("sales-day queries", () => {
  it("loads only the signed-in salesperson's day and groups completed tasks separately", async () => {
    const database = {
      salesTask: {
        findMany: vi.fn().mockResolvedValue([
          task({ id: "open_high", priority: "HIGH", title: "High priority follow-up" }),
          task({
            id: "completed",
            title: "Done already",
            status: "COMPLETED",
            completedAt: new Date("2026-06-17T12:00:00.000Z")
          })
        ])
      }
    };

    const result = await loadMyDay(salesUser, selectedDate, database);

    expect(database.salesTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ownerId: "sales_1" })
      })
    );
    expect(result.openTasks.map((item) => item.id)).toEqual(["open_high"]);
    expect(result.completedTasks.map((item) => item.id)).toEqual(["completed"]);
    expect(result.openTasks[0].leadCustomer).toEqual({ id: "lead_1", label: "Acme Learning" });
  });

  it("returns overdue open tasks in the overdue section even when due before the selected day", async () => {
    const database = {
      salesTask: {
        findMany: vi.fn().mockResolvedValue([
          task({
            id: "overdue",
            title: "Follow up overdue proposal",
            dueAt: new Date("2026-06-16T09:00:00.000Z")
          })
        ])
      }
    };

    const result = await loadMyDay(salesUser, selectedDate, database);

    expect(result.overdueTasks.map((item) => item.id)).toEqual(["overdue"]);
    expect(result.openTasks).toEqual([]);
  });

  it("loads standalone voice notes created on the selected day", async () => {
    const database = {
      salesTask: {
        findMany: vi.fn().mockResolvedValue([])
      },
      salesVoiceNote: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "note_1",
            taskId: null,
            status: "FAILED",
            transcript: null,
            summary: null,
            customerAsk: null,
            nextStep: null,
            processingError: "Transcription provider is not configured.",
            createdAt: new Date("2026-06-17T11:00:00.000Z"),
            actions: []
          }
        ])
      }
    };

    const result = await loadMyDay(salesUser, selectedDate, database);

    expect(database.salesVoiceNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ownerId: "sales_1",
          taskId: null
        })
      })
    );
    expect(result.voiceNotes).toEqual([
      {
        id: "note_1",
        taskId: null,
        status: "FAILED",
        audioUrl: "/my-day/voice-notes/note_1/audio",
        transcript: null,
        summary: null,
        customerAsk: null,
        nextStep: null,
        processingError: "Transcription provider is not configured.",
        createdAt: new Date("2026-06-17T11:00:00.000Z"),
        actions: []
      }
    ]);
  });

  it("loads typed notes created by the signed-in salesperson on the selected day", async () => {
    const database = {
      salesTask: {
        findMany: vi.fn().mockResolvedValue([])
      },
      salesVoiceNote: {
        findMany: vi.fn().mockResolvedValue([])
      },
      salesTextNote: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "text_note_1",
            body: "Client wants a USD quote with manual tax.",
            createdAt: new Date("2026-06-17T11:30:00.000Z"),
            updatedAt: new Date("2026-06-17T11:45:00.000Z"),
            leadCustomer: { id: "lead_1", name: "Acme Learning" },
            opportunity: null,
            proposal: null,
            order: null,
            task: null
          }
        ])
      }
    };

    const result = await loadMyDay(salesUser, selectedDate, database);

    expect(database.salesTextNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ownerId: "sales_1",
          createdAt: expect.objectContaining({ gte: expect.any(Date), lt: expect.any(Date) })
        })
      })
    );
    expect(result.textNotes).toEqual([
      {
        id: "text_note_1",
        body: "Client wants a USD quote with manual tax.",
        createdAt: new Date("2026-06-17T11:30:00.000Z"),
        updatedAt: new Date("2026-06-17T11:45:00.000Z"),
        leadCustomer: { id: "lead_1", label: "Acme Learning" },
        opportunity: null,
        proposal: null,
        order: null,
        task: null
      }
    ]);
  });

  it("includes opportunity follow-up reminders in accounts needing attention", async () => {
    const database = {
      salesTask: {
        findMany: vi.fn().mockResolvedValue([])
      },
      salesVoiceNote: {
        findMany: vi.fn().mockResolvedValue([])
      },
      opportunity: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "opp_1",
            title: "LMS rollout",
            nextFollowUpAt: new Date("2026-06-17T09:00:00.000Z"),
            leadCustomer: { id: "lead_1", name: "Acme Learning" }
          }
        ])
      },
      salesVoiceNoteAction: {
        findMany: vi.fn().mockResolvedValue([])
      }
    };

    const result = await loadMyDayInsights(salesUser, selectedDate, database);

    expect(result.accountsNeedingAttention).toEqual([
      {
        id: "opp_1",
        title: "LMS rollout",
        detail: "Follow-up due for Acme Learning",
        linkedRecord: { id: "lead_1", label: "Acme Learning" }
      }
    ]);
  });
});
