import { describe, expect, it, vi } from "vitest";

import { createLocalUserItemHandlers } from "./route";

describe("local user item API", () => {
  it("returns 409 when final Admin protection rejects an update", async () => {
    const handlers = createLocalUserItemHandlers({
      authorize: vi.fn().mockResolvedValue({ user: { id: "admin_1", role: "ADMIN" }, cellId: "cell_ara", cellKey: "ara-global" }),
      updateUser: vi.fn().mockRejectedValue(new Error("The final active Admin cannot be deactivated or changed to Sales"))
    });
    const response = await handlers.PATCH(
      new Request("http://localhost/api/admin/users/admin_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: false, correlationId: "corr_3", reason: "Deactivate account" })
      }),
      { params: Promise.resolve({ userId: "admin_1" }) }
    );
    expect(response.status).toBe(409);
  });
});
