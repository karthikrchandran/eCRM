import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/shared-records/route";
import { requireSharedDataApiToken } from "@/server/shared-records/api-auth";
import { upsertSharedRecord } from "@/server/shared-records/mutations";
import { listSharedRecords } from "@/server/shared-records/queries";

vi.mock("@/server/shared-records/api-auth", () => ({
  getSharedDataOrganizationId: vi.fn(() => "org_test"),
  requireSharedDataApiToken: vi.fn()
}));

vi.mock("@/server/shared-records/mutations", () => ({
  upsertSharedRecord: vi.fn()
}));

vi.mock("@/server/shared-records/queries", () => ({
  listSharedRecords: vi.fn()
}));

const requireSharedDataApiTokenMock = vi.mocked(requireSharedDataApiToken);
const upsertSharedRecordMock = vi.mocked(upsertSharedRecord);
const listSharedRecordsMock = vi.mocked(listSharedRecords);

describe("shared records route handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSharedDataApiTokenMock.mockReturnValue(null);
  });

  it("returns list responses with parsed filters", async () => {
    listSharedRecordsMock.mockResolvedValue([
      {
        id: "shared_1",
        entityType: "CUSTOMER",
        displayName: "Acme Learning",
        status: "ACTIVE",
        ownerId: null,
        parentId: null,
        relatedLeadId: null,
        relatedCustomerId: null,
        relatedContactId: null,
        relatedOpportunityId: null,
        sourceApp: "ecrm",
        ecrmLegacyId: "lead_1",
        emailVoiceLegacyId: null,
        externalKey: null,
        email: null,
        phone: null,
        companyName: null,
        searchText: "acme learning active",
        data: {},
        archivedAt: null,
        createdAt: "2026-06-24T12:00:00.000Z",
        updatedAt: "2026-06-24T12:00:00.000Z"
      }
    ]);

    const response = await GET(
      new Request("http://localhost/api/shared-records?entityType=CUSTOMER&q=acme&status=ACTIVE&limit=5")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      records: [{ id: "shared_1" }]
    });
    expect(listSharedRecordsMock).toHaveBeenCalledWith("org_test", {
      entityType: "CUSTOMER",
      q: "acme",
      status: "ACTIVE",
      limit: 5
    });
  });

  it("returns 400 for malformed JSON in POST requests", async () => {
    const response = await POST(
      new Request("http://localhost/api/shared-records", {
        method: "POST",
        body: "{not-json",
        headers: { "content-type": "application/json" }
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON." });
    expect(upsertSharedRecordMock).not.toHaveBeenCalled();
  });

  it("returns 201 for creates and 200 for updates", async () => {
    upsertSharedRecordMock
      .mockResolvedValueOnce({
        created: true,
        record: {
          id: "created_1",
          entityType: "LEAD",
          displayName: "New lead",
          status: "OPEN",
          ownerId: null,
          parentId: null,
          relatedLeadId: null,
          relatedCustomerId: null,
          relatedContactId: null,
          relatedOpportunityId: null,
          sourceApp: "emailvoice",
          ecrmLegacyId: null,
          emailVoiceLegacyId: "lead_1",
          externalKey: null,
          email: null,
          phone: null,
          companyName: null,
          searchText: "new lead open lead_1",
          data: {},
          archivedAt: null,
          createdAt: "2026-06-24T12:00:00.000Z",
          updatedAt: "2026-06-24T12:00:00.000Z"
        }
      })
      .mockResolvedValueOnce({
        created: false,
        record: {
          id: "created_1",
          entityType: "LEAD",
          displayName: "Updated lead",
          status: "OPEN",
          ownerId: null,
          parentId: null,
          relatedLeadId: null,
          relatedCustomerId: null,
          relatedContactId: null,
          relatedOpportunityId: null,
          sourceApp: "emailvoice",
          ecrmLegacyId: null,
          emailVoiceLegacyId: "lead_1",
          externalKey: null,
          email: null,
          phone: null,
          companyName: null,
          searchText: "updated lead open lead_1",
          data: {},
          archivedAt: null,
          createdAt: "2026-06-24T12:00:00.000Z",
          updatedAt: "2026-06-24T12:30:00.000Z"
        }
      });

    const createResponse = await POST(
      new Request("http://localhost/api/shared-records", {
        method: "POST",
        body: JSON.stringify({ entityType: "LEAD", displayName: "New lead", status: "OPEN", sourceApp: "emailvoice" })
      })
    );
    const updateResponse = await POST(
      new Request("http://localhost/api/shared-records", {
        method: "POST",
        body: JSON.stringify({ entityType: "LEAD", displayName: "Updated lead", status: "OPEN", sourceApp: "emailvoice" })
      })
    );

    expect(createResponse.status).toBe(201);
    expect(updateResponse.status).toBe(200);
  });
});
