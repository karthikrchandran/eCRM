import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";
import { requireSharedDataApiToken } from "@/server/shared-records/api-auth";
import { ingestWorkflowEvent } from "@/server/workflow-events/service";

vi.mock("@/server/shared-records/api-auth", () => ({
  getSharedDataOrganizationId: vi.fn(() => "org_test"),
  requireSharedDataApiToken: vi.fn()
}));

vi.mock("@/server/workflow-events/service", () => ({
  ingestWorkflowEvent: vi.fn()
}));

const requireSharedDataApiTokenMock = vi.mocked(requireSharedDataApiToken);
const ingestWorkflowEventMock = vi.mocked(ingestWorkflowEvent);

describe("workflow-events route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSharedDataApiTokenMock.mockReturnValue(null);
    ingestWorkflowEventMock.mockResolvedValue({ id: "event_1" } as never);
  });

  it("accepts a booking at the dedicated workflow endpoint", async () => {
    const response = await POST(
      new Request("http://localhost/api/workflow-events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceApp: "emailvoice",
          sourceEventType: "meeting_booked",
          entityType: "LEAD",
          entityId: "contact_1",
          relatedRecordType: "LEAD",
          relatedRecordId: "lead_1",
          summary: "Meeting booked in EmailVoice"
        })
      })
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ event: { id: "event_1" } });
    expect(ingestWorkflowEventMock).toHaveBeenCalledWith(
      "org_test",
      expect.objectContaining({ sourceEventType: "meeting_booked" })
    );
  });

  it("does not ingest an event when bearer authentication fails", async () => {
    requireSharedDataApiTokenMock.mockReturnValue(Response.json({ error: "Unauthorized." }, { status: 401 }));

    const response = await POST(new Request("http://localhost/api/workflow-events", { method: "POST" }));

    expect(response.status).toBe(401);
    expect(ingestWorkflowEventMock).not.toHaveBeenCalled();
  });

  it("rejects an event that does not identify its source and type", async () => {
    const response = await POST(
      new Request("http://localhost/api/workflow-events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ summary: "Incomplete event" })
      })
    );

    expect(response.status).toBe(400);
    expect(ingestWorkflowEventMock).not.toHaveBeenCalled();
  });

  it.each([
    ["type without an identifier", { relatedRecordType: "LEAD" }],
    ["a tenant-B identifier without a type", { relatedRecordId: "lead_B" }]
  ])("rejects related record %s before calling the service", async (_label, relatedRecord) => {
    const response = await POST(
      new Request("http://localhost/api/workflow-events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceApp: "emailvoice",
          sourceEventType: "sync",
          entityType: "EXTERNAL",
          summary: "Malformed related record",
          ...relatedRecord
        })
      })
    );

    expect(response.status).toBe(400);
    expect(ingestWorkflowEventMock).not.toHaveBeenCalled();
  });
});
