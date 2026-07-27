import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/shared-records/export/route";
import { requireSharedDataApiToken } from "@/server/shared-records/api-auth";
import { buildSharedRecordExportPage, SharedRecordExportError } from "@/server/shared-records/export";

vi.mock("@/server/shared-records/api-auth", () => ({
  requireSharedDataApiToken: vi.fn()
}));

vi.mock("@/server/shared-records/export", () => ({
  buildSharedRecordExportPage: vi.fn(),
  exportableSharedRecordTypes: ["LEAD", "CUSTOMER", "CONTACT", "ORDER"],
  MAX_SHARED_RECORD_EXPORT_PAGE_SIZE: 500,
  SharedRecordExportError: class SharedRecordExportError extends Error {}
}));

const requireSharedDataApiTokenMock = vi.mocked(requireSharedDataApiToken);
const buildSharedRecordExportPageMock = vi.mocked(buildSharedRecordExportPage);

describe("shared-record export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSharedDataApiTokenMock.mockReturnValue(null);
    buildSharedRecordExportPageMock.mockResolvedValue({ items: [], nextCursor: null });
  });

  it("passes through auth failures", async () => {
    requireSharedDataApiTokenMock.mockReturnValue(new Response("blocked", { status: 401 }));

    const response = await GET(new Request("http://localhost/api/shared-records/export"));

    expect(response.status).toBe(401);
    expect(buildSharedRecordExportPageMock).not.toHaveBeenCalled();
  });

  it("treats an empty limit as unset and trims empty entityType", async () => {
    const response = await GET(new Request("http://localhost/api/shared-records/export?entityType=%20%20&limit="));

    expect(response.status).toBe(200);
    expect(buildSharedRecordExportPageMock).toHaveBeenCalledWith({
      entityType: undefined,
      cursor: null,
      limit: undefined
    });
  });

  it("rejects invalid or out-of-range limits", async () => {
    const zero = await GET(new Request("http://localhost/api/shared-records/export?limit=0"));
    const tooLarge = await GET(new Request("http://localhost/api/shared-records/export?limit=501"));
    const fractional = await GET(new Request("http://localhost/api/shared-records/export?limit=1.5"));

    await expect(zero.json()).resolves.toEqual({ error: "Invalid limit." });
    await expect(tooLarge.json()).resolves.toEqual({ error: "Invalid limit." });
    await expect(fractional.json()).resolves.toEqual({ error: "Invalid limit." });
    expect(zero.status).toBe(400);
    expect(tooLarge.status).toBe(400);
    expect(fractional.status).toBe(400);
    expect(buildSharedRecordExportPageMock).not.toHaveBeenCalled();
  });

  it("rejects entity types outside the approved export scope", async () => {
    const response = await GET(new Request("http://localhost/api/shared-records/export?entityType=OPPORTUNITY"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid entityType." });
    expect(buildSharedRecordExportPageMock).not.toHaveBeenCalled();
  });

  it("rejects a blank cursor instead of silently restarting the export", async () => {
    const response = await GET(new Request("http://localhost/api/shared-records/export?cursor=%20%20"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid export cursor." });
    expect(buildSharedRecordExportPageMock).not.toHaveBeenCalled();
  });

  it("returns a bad request for invalid cursors from the helper", async () => {
    buildSharedRecordExportPageMock.mockRejectedValue(new SharedRecordExportError("Invalid export cursor."));

    const response = await GET(new Request("http://localhost/api/shared-records/export?cursor=bad"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid export cursor." });
  });
});
