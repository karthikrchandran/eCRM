import { describe, expect, it, vi } from "vitest";

import { ingestWorkflowEvent, listWorkflowEventsForEntity } from "./service";

describe("workflow event service", () => {
  it("persists workflow events and creates a CRM follow-up task for meeting bookings", async () => {
    const createMock = vi.fn().mockResolvedValue({ id: "event_1" });
    const salesTaskCreateMock = vi.fn().mockResolvedValue({ id: "task_1" });
    const database = {
      workflowEvent: {
        create: createMock,
        findMany: vi.fn().mockResolvedValue([])
      },
      salesTask: {
        create: salesTaskCreateMock
      }
    } as never;

    const result = await ingestWorkflowEvent(
      {
        sourceApp: "emailvoice",
        sourceEventType: "meeting_booked",
        entityType: "CONTACT",
        entityId: "contact_1",
        relatedRecordType: "LEAD",
        relatedRecordId: "lead_1",
        summary: "Meeting booked in EmailVoice",
        payload: { meetingTime: "2026-07-08T10:00:00Z" },
        occurredAt: new Date("2026-07-08T10:00:00Z")
      },
      database
    );

    expect(result.id).toBe("event_1");
    expect(salesTaskCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Follow-up from EmailVoice meeting",
          leadCustomerId: "lead_1",
          type: "FOLLOW_UP",
          source: "CRM"
        })
      })
    );
  });

  it("lists workflow events for an entity by most recent first", async () => {
    const findManyMock = vi.fn().mockResolvedValue([{ id: "event_2" }, { id: "event_1" }]);
    const database = {
      workflowEvent: {
        findMany: findManyMock
      }
    } as never;

    const rows = await listWorkflowEventsForEntity("lead_1", database);

    expect(rows).toHaveLength(2);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.any(Array)
        }),
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }]
      })
    );
  });
});
