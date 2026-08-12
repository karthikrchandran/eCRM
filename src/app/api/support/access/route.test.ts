import { describe, expect, it, vi } from "vitest";

import { createSupportAccessHandler } from "./route";

describe("cell support access API", () => {
  it("returns only the resource authorized by the explicit capability", async () => {
    const authorize = vi.fn().mockResolvedValue({ operatorId: "support@example.com" });
    const readConfiguration = vi.fn().mockResolvedValue({ displayName: "Acme" });
    const readUsers = vi.fn();
    const GET = createSupportAccessHandler({ authorize, readConfiguration, readUsers });

    const response = await GET(new Request("http://cell/api/support/access?capability=configuration:read"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ result: { displayName: "Acme" } });
    expect(readConfiguration).toHaveBeenCalledOnce();
    expect(readUsers).not.toHaveBeenCalled();
  });

  it("preserves a denied authorization as 403 without reading cell data", async () => {
    const readConfiguration = vi.fn();
    const GET = createSupportAccessHandler({
      authorize: vi.fn().mockRejectedValue(new Error("denied")), readConfiguration, readUsers: vi.fn()
    });
    const response = await GET(new Request("http://cell/api/support/access?capability=configuration:read"));
    expect(response.status).toBe(403);
    expect(readConfiguration).not.toHaveBeenCalled();
  });
});
