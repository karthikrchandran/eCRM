import { describe, expect, it, vi } from "vitest";

import { createSupportGrantCollectionHandlers } from "./route";

describe("platform support-grant API", () => {
  it("creates a time-bound grant with case and audit context", async () => {
    const createSupportGrant = vi.fn().mockResolvedValue({ id: "grant_1", cellId: "cell_ara" });
    const handlers = createSupportGrantCollectionHandlers({
      authorize: () => ({ actor: "platform-admin@example.com" }),
      createSupportGrant
    });
    const response = await handlers.POST(new Request("http://localhost/api/platform/support-grants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cellId: "cell_ara",
        operatorId: "support@example.com",
        caseReference: "CASE-101",
        reason: "Investigate login issue",
        expiresAt: "2026-08-12T00:00:00Z",
        correlationId: "corr_3"
      })
    }));
    expect(response.status).toBe(201);
    expect(createSupportGrant).toHaveBeenCalledWith(expect.objectContaining({ actor: "platform-admin@example.com", expiresAt: new Date("2026-08-12T00:00:00Z") }));
  });
});
