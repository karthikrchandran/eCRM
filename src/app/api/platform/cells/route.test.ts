import { describe, expect, it, vi } from "vitest";

import { createCellCollectionHandlers } from "./route";

const admin = { actor: "platform-admin@example.com" };
const validBody = {
  cellId: "cell_ara",
  cellKey: "ara-global",
  legalName: "ARA Global Inc.",
  displayName: "ARA Global",
  region: "us-east-1",
  desiredSubdomain: "ara",
  initialAdminEmail: "admin@ara.example",
  idempotencyKey: "idem_1",
  correlationId: "corr_1",
  reason: "New customer contract"
};

describe("platform cell collection API", () => {
  it("returns the mode/auth response without touching platform state", async () => {
    const denied = Response.json({ error: "Not found." }, { status: 404 });
    const listCells = vi.fn();
    const handlers = createCellCollectionHandlers({ authorize: () => denied, listCells, provision: vi.fn() });

    const response = await handlers.GET(new Request("http://localhost/api/platform/cells"));

    expect(response.status).toBe(404);
    expect(listCells).not.toHaveBeenCalled();
  });

  it("lists control-plane cells for an authorized platform administrator", async () => {
    const listCells = vi.fn().mockResolvedValue([{ id: "cell_ara", lifecycleStatus: "ACTIVE" }]);
    const handlers = createCellCollectionHandlers({ authorize: () => admin, listCells, provision: vi.fn() });

    const response = await handlers.GET(new Request("http://localhost/api/platform/cells"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ cells: [{ id: "cell_ara", lifecycleStatus: "ACTIVE" }] });
  });

  it("provisions with the authenticated actor and returns 201", async () => {
    const provision = vi.fn().mockResolvedValue({ cell: { id: "cell_ara", lifecycleStatus: "ACTIVE" }, attempt: { result: "SUCCEEDED" } });
    const handlers = createCellCollectionHandlers({ authorize: () => admin, listCells: vi.fn(), provision });
    const response = await handlers.POST(new Request("http://localhost/api/platform/cells", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validBody)
    }));

    expect(response.status).toBe(201);
    expect(provision).toHaveBeenCalledWith({ ...validBody, actor: admin.actor });
  });

  it("returns 400 for malformed provisioning input", async () => {
    const provision = vi.fn();
    const handlers = createCellCollectionHandlers({ authorize: () => admin, listCells: vi.fn(), provision });
    const response = await handlers.POST(new Request("http://localhost/api/platform/cells", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cellKey: "Not Valid" })
    }));

    expect(response.status).toBe(400);
    expect(provision).not.toHaveBeenCalled();
  });
});
