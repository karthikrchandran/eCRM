import { beforeEach, describe, expect, it, vi } from "vitest";

import { PATCH } from "./route";
import { requireSharedDataApiToken } from "@/server/shared-records/api-auth";
import { ingestWorkflowEvent } from "@/server/workflow-events/service";

vi.mock("@/server/shared-records/api-auth", () => ({
  requireSharedDataApiToken: vi.fn()
}));

vi.mock("@/server/workflow-events/service", () => ({
  ingestWorkflowEvent: vi.fn()
}));

const requireSharedDataApiTokenMock = vi.mocked(requireSharedDataApiToken);
const ingestWorkflowEventMock = vi.mocked(ingestWorkflowEvent);

describe("shared-records workflow-event route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSharedDataApiTokenMock.mockReturnValue(null);
    ingestWorkflowEventMock.mockResolvedValue({
      id: "event_1",
      sourceApp: "emailvoice",
      sourceEventType: "meeting_booked",
      entityType: "CONTACT",
      entityId: "contact_1",
      relatedRecordType: "LEAD",
      relatedRecordId: "lead_1",
      summary: "Meeting booked in EmailVoice",
      payload: { meetingTime: "2026-07-08T10:00:00Z" },
      occurredAt: new Date("2026-07-08T10:00:00Z"),
      createdAt: new Date("2026-07-08T10:00:00Z"),
      updatedAt: new Date("2026-07-08T10:00:00Z")
    });
  });

  it("ingests workflow events from EmailVoice and returns the created event", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/shared-records", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceApp: "emailvoice",
          sourceEventType: "meeting_booked",
          entityType: "CONTACT",
          entityId: "contact_1",
          relatedRecordType: "LEAD",
          relatedRecordId: "lead_1",
          summary: "Meeting booked in EmailVoice"
        })
      })
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        event: expect.objectContaining({ id: "event_1" })
      })
    );
    expect(ingestWorkflowEventMock).toHaveBeenCalledWith(expect.objectContaining({ sourceEventType: "meeting_booked" }));
  });

  it("rejects requests blocked by shared-data auth", async () => {
    requireSharedDataApiTokenMock.mockReturnValue(new Response("blocked", { status: 401 }));

    const response = await PATCH(new Request("http://localhost/api/shared-records", { method: "PATCH" }));

    expect(response.status).toBe(401);
    expect(ingestWorkflowEventMock).not.toHaveBeenCalled();
  });
});
