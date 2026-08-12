import { describe, expect, it, vi } from "vitest";

import { createCellConfigurationHandlers } from "./route";

const authorized = { user: { id: "admin_1", role: "ADMIN" as const }, cellId: "cell_ara", cellKey: "ara-global" };

describe("cell configuration API", () => {
  it("returns cell-mode authorization responses without reading configuration", async () => {
    const getConfiguration = vi.fn();
    const handlers = createCellConfigurationHandlers({
      authorize: vi.fn().mockResolvedValue(Response.json({ error: "Not found." }, { status: 404 })),
      getConfiguration,
      updateConfiguration: vi.fn()
    });
    const response = await handlers.GET(new Request("http://localhost/api/admin/cell-configuration"));
    expect(response.status).toBe(404);
    expect(getConfiguration).not.toHaveBeenCalled();
  });

  it("updates branding/modules and returns 200", async () => {
    const updateConfiguration = vi.fn().mockResolvedValue({ displayName: "Acme CRM", enabledModules: ["crm"] });
    const handlers = createCellConfigurationHandlers({
      authorize: vi.fn().mockResolvedValue(authorized),
      getConfiguration: vi.fn(),
      updateConfiguration
    });
    const response = await handlers.PATCH(new Request("http://localhost/api/admin/cell-configuration", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: "Acme CRM",
        enabledModules: ["crm"],
        correlationId: "corr_1",
        reason: "Approved branding update"
      })
    }));
    expect(response.status).toBe(200);
    expect(updateConfiguration).toHaveBeenCalledWith(authorized.user, { displayName: "Acme CRM", enabledModules: ["crm"] }, {
      correlationId: "corr_1",
      reason: "Approved branding update"
    });
  });

  it("returns 409 when a module is excluded by plan", async () => {
    const handlers = createCellConfigurationHandlers({
      authorize: vi.fn().mockResolvedValue(authorized),
      getConfiguration: vi.fn(),
      updateConfiguration: vi.fn().mockRejectedValue(new Error("Module finance is not included in this plan"))
    });
    const response = await handlers.PATCH(new Request("http://localhost/api/admin/cell-configuration", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabledModules: ["finance"], correlationId: "corr_1", reason: "Enable finance" })
    }));
    expect(response.status).toBe(409);
  });
});
