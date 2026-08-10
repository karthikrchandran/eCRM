import { describe, expect, it, vi } from "vitest";

import { ingestWorkflowEvent, listWorkflowEventsForEntity } from "./service";

describe("workflow event service", () => {
  it("persists workflow events and creates a CRM follow-up task for meeting bookings", async () => {
    const createMock = vi.fn().mockResolvedValue({ id: "event_1" });
    const salesTaskCreateMock = vi.fn().mockResolvedValue({ id: "task_1" });
    const database = {
      $queryRaw: vi.fn().mockResolvedValue([{ allowed: true }]),
      leadCustomer: { findFirst: vi.fn().mockResolvedValue({ id: "lead_1", ownerId: "sales_1" }) },
      workflowEvent: {
        create: createMock,
        findMany: vi.fn().mockResolvedValue([])
      },
      salesTask: {
        create: salesTaskCreateMock
      }
    } as never;

    const result = await ingestWorkflowEvent(
      "org_test",
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
          ownerId: "sales_1",
          type: "FOLLOW_UP",
          source: "CRM"
        })
      })
    );
  });

  it.each(["foreign", "inactive", "missing"])("rejects a %s lead actor before creating event or task", async () => {
    const database = {
      $queryRaw: vi.fn().mockResolvedValue([{ allowed: false }]),
      workflowEvent: { create: vi.fn(), findFirst: vi.fn().mockResolvedValue(null) },
      leadCustomer: { findFirst: vi.fn().mockResolvedValue({ id: "lead_1", ownerId: "bad_actor" }) },
      salesTask: { create: vi.fn() }
    };

    await expect(ingestWorkflowEvent("org_A", {
      sourceApp: "emailvoice", sourceEventId: "meeting-2", sourceEventType: "meeting_booked",
      entityType: "ACTIVITY", relatedRecordType: "LEAD", relatedRecordId: "lead_1", summary: "Meeting"
    }, database as never)).rejects.toThrow("Organization member was not found.");
    expect(database.workflowEvent.create).not.toHaveBeenCalled();
    expect(database.salesTask.create).not.toHaveBeenCalled();
  });

  it("lists workflow events for an entity by most recent first", async () => {
    const findManyMock = vi.fn().mockResolvedValue([{ id: "event_2" }, { id: "event_1" }]);
    const database = {
      workflowEvent: {
        findMany: findManyMock
      }
    } as never;

    const rows = await listWorkflowEventsForEntity("org_test", "lead_1", database);

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

  it("returns the existing event without creating a second follow-up for a repeated source event", async () => {
    const existing = { id: "event_1", sourceApp: "emailvoice", sourceEventId: "scheduling-booked:req_1" };
    const createMock = vi.fn();
    const salesTaskCreateMock = vi.fn();
    const database = {
      workflowEvent: {
        findFirst: vi.fn().mockResolvedValue(existing),
        create: createMock,
        findMany: vi.fn().mockResolvedValue([])
      },
      salesTask: { create: salesTaskCreateMock }
    } as never;

    const result = await ingestWorkflowEvent(
      "org_test",
      {
        sourceApp: "emailvoice",
        sourceEventId: "scheduling-booked:req_1",
        sourceEventType: "meeting_booked",
        entityType: "LEAD",
        summary: "Meeting booked in EmailVoice"
      },
      database
    );

    expect(result).toBe(existing);
    expect(createMock).not.toHaveBeenCalled();
    expect(salesTaskCreateMock).not.toHaveBeenCalled();
  });
});
