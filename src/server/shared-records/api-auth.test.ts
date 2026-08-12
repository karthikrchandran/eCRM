import { describe, expect, it, vi } from "vitest";

import { requireIntegrationCapability } from "./api-auth";

describe("integration API authentication", () => {
  it("passes the bearer secret and exact route capability to cell-local authentication", async () => {
    const authenticate = vi.fn().mockResolvedValue({ cellId: "cell_ara" });
    const response = await requireIntegrationCapability(new Request("http://cell/api/shared-records", {
      headers: { authorization: "Bearer generated-secret" }
    }), "SHARED_RECORDS_WRITE", { isCellActive: async () => true, authenticate });

    expect(response).toBeNull();
    expect(authenticate).toHaveBeenCalledWith("generated-secret", "SHARED_RECORDS_WRITE");
  });

  it("returns the same unauthorized response for missing, wrong-capability, expired, revoked, rotated, or cross-cell credentials", async () => {
    for (const reason of ["missing", "wrong capability", "expired", "revoked", "rotated", "cross cell"]) {
      const response = await requireIntegrationCapability(new Request("http://cell/api/shared-records"), "SHARED_RECORDS_READ", {
        isCellActive: async () => true,
        authenticate: vi.fn().mockRejectedValue(new Error(reason))
      });
      expect(response?.status).toBe(401);
      await expect(response?.json()).resolves.toEqual({ error: "Unauthorized." });
    }
  });

  it("denies before credential lookup when the durable cell lifecycle is not active", async () => {
    const authenticate = vi.fn();
    const response = await requireIntegrationCapability(new Request("http://cell/api/workflow-events"), "WORKFLOW_EVENTS_WRITE", {
      isCellActive: async () => false,
      authenticate
    });
    expect(response?.status).toBe(423);
    expect(authenticate).not.toHaveBeenCalled();
  });
});
