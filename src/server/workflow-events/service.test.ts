import { afterEach, describe, expect, it, vi } from "vitest";

import { ingestWorkflowEvent, listWorkflowEventsForEntity } from "./service";

describe("workflow event service", () => {
  afterEach(() => delete process.env.WORKFLOW_AUTOMATION_USER_ID);

  it("persists workflow events and creates a CRM follow-up task for meeting bookings", async () => {
    process.env.WORKFLOW_AUTOMATION_USER_ID = "automation_1";
    const createMock = vi.fn().mockResolvedValue({ id: "event_1" });
    const salesTaskCreateMock = vi.fn().mockResolvedValue({ id: "task_1" });
    const database = {
      $queryRaw: vi.fn().mockResolvedValue([{ allowed: true }]),
      contact: { findFirst: vi.fn().mockResolvedValue({ id: "contact_1" }) },
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
          ownerId: "automation_1",
          type: "FOLLOW_UP",
          source: "CRM"
        })
      })
    );
  });

  it.each(["foreign", "inactive", "missing"])("rejects a %s lead actor before creating event or task", async () => {
    process.env.WORKFLOW_AUTOMATION_USER_ID = "bad_actor";
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

  it("fails closed before persisting when the automation actor is not configured", async () => {
    const database = {
      workflowEvent: { create: vi.fn() },
      leadCustomer: { findFirst: vi.fn().mockResolvedValue({ id: "lead_1", ownerId: "sales_1" }) },
      salesTask: { create: vi.fn() }
    };
    await expect(ingestWorkflowEvent("org_A", {
      sourceApp: "emailvoice", sourceEventType: "meeting_booked", entityType: "ACTIVITY",
      relatedRecordType: "LEAD", relatedRecordId: "lead_1", summary: "Meeting"
    }, database as never)).rejects.toThrow("Workflow automation actor is not configured.");
    expect(database.workflowEvent.create).not.toHaveBeenCalled();
  });

  it.each([
    ["entity", { entityType: "OPPORTUNITY", entityId: "opportunity_B" }, "opportunity"],
    ["related", { relatedRecordType: "CONTACT", relatedRecordId: "contact_B" }, "contact"]
  ] as const)("rejects a tenant-B %s workflow attachment", async (_label, attachment, delegate) => {
    const database = {
      [delegate]: { findFirst: vi.fn().mockResolvedValue(null) },
      workflowEvent: { create: vi.fn(), findFirst: vi.fn().mockResolvedValue(null) }
    };
    await expect(ingestWorkflowEvent("org_A", {
      sourceApp: "emailvoice",
      sourceEventId: `foreign-${_label}`,
      sourceEventType: "sync",
      entityType: "EXTERNAL",
      summary: "Foreign attachment",
      ...attachment
    }, database as never)).rejects.toThrow("Related record was not found.");
    expect(database.workflowEvent.create).not.toHaveBeenCalled();
  });

  it("requires unknown external workflow identifiers to be source-namespaced", async () => {
    const database = { workflowEvent: { create: vi.fn(), findFirst: vi.fn().mockResolvedValue(null) } };
    await expect(ingestWorkflowEvent("org_A", {
      sourceApp: "emailvoice",
      sourceEventId: "external-unscoped",
      sourceEventType: "sync",
      entityType: "EXTERNAL_CONTACT",
      entityId: "tenant_B_guessable_id",
      summary: "Unscoped external identifier"
    }, database as never)).rejects.toThrow("External workflow identifiers must be source-namespaced.");
    expect(database.workflowEvent.create).not.toHaveBeenCalled();
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

  it("refetches the winning event after a concurrent idempotency conflict", async () => {
    const winner = { id: "event_winner", sourceApp: "emailvoice", sourceEventId: "request_1" };
    const database = {
      workflowEvent: {
        findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(winner),
        create: vi.fn().mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }))
      },
      salesTask: { create: vi.fn() }
    };

    await expect(ingestWorkflowEvent("org_A", {
      sourceApp: "emailvoice", sourceEventId: "request_1", sourceEventType: "sync",
      entityType: "EXTERNAL", summary: "Concurrent event"
    }, database as never)).resolves.toBe(winner);
    expect(database.workflowEvent.findFirst).toHaveBeenCalledTimes(2);
    expect(database.salesTask.create).not.toHaveBeenCalled();
  });

  it.each([
    ["type without an identifier", { relatedRecordType: "LEAD" }],
    ["a tenant-B identifier without a type", { relatedRecordId: "lead_B" }]
  ])("rejects related record %s before idempotency lookup or persistence", async (_label, relatedRecord) => {
    const database = {
      workflowEvent: {
        findFirst: vi.fn().mockResolvedValue({ id: "existing_event" }),
        create: vi.fn()
      }
    };

    await expect(ingestWorkflowEvent("org_A", {
      sourceApp: "emailvoice",
      sourceEventId: "existing-source-event",
      sourceEventType: "sync",
      entityType: "EXTERNAL",
      summary: "Malformed related record",
      ...relatedRecord
    }, database as never)).rejects.toThrow("Workflow related record type and identifier must be provided together.");
    expect(database.workflowEvent.findFirst).not.toHaveBeenCalled();
    expect(database.workflowEvent.create).not.toHaveBeenCalled();
  });
});
