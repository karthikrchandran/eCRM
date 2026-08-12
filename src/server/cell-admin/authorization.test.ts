import { describe, expect, it, vi } from "vitest";

import { authorizeCellAdmin } from "./authorization";

describe("cell administration authorization", () => {
  it("returns 404 in platform mode without resolving a local session", async () => {
    const getUser = vi.fn();
    const result = await authorizeCellAdmin({ mode: "platform" }, getUser);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(404);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("returns 401 without a valid active local session", async () => {
    const result = await authorizeCellAdmin(
      { mode: "cell", cellId: "cell_ara", cellKey: "ara-global" },
      vi.fn().mockResolvedValue(null)
    );
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });

  it("returns 403 for Sales and accepts Admin without a customer selector", async () => {
    const runtime = { mode: "cell", cellId: "cell_ara", cellKey: "ara-global" } as const;
    const denied = await authorizeCellAdmin(runtime, vi.fn().mockResolvedValue({ id: "sales_1", role: "SALES" }));
    expect((denied as Response).status).toBe(403);

    await expect(authorizeCellAdmin(runtime, vi.fn().mockResolvedValue({ id: "admin_1", role: "ADMIN" }))).resolves.toEqual({
      user: { id: "admin_1", role: "ADMIN" },
      cellId: "cell_ara",
      cellKey: "ara-global"
    });
  });
});
