import { describe, expect, it, vi } from "vitest";

import { createCellItemHandlers } from "./route";

describe("platform cell lifecycle API", () => {
  it("returns 404 in cell mode", async () => {
    const transitionCell = vi.fn();
    const handlers = createCellItemHandlers({
      authorize: () => Response.json({ error: "Not found." }, { status: 404 }),
      transitionCell,
      deleteCell: vi.fn()
    });
    const response = await handlers.PATCH(
      new Request("http://localhost/api/platform/cells/cell_ara", { method: "PATCH" }),
      { params: Promise.resolve({ cellId: "cell_ara" }) }
    );
    expect(response.status).toBe(404);
    expect(transitionCell).not.toHaveBeenCalled();
  });

  it("returns 409 for a rejected lifecycle transition", async () => {
    const handlers = createCellItemHandlers({
      authorize: () => ({ actor: "platform-admin@example.com" }),
      transitionCell: vi.fn().mockRejectedValue(new Error("Cannot transition customer cell from ACTIVE to DELETED")),
      deleteCell: vi.fn()
    });
    const response = await handlers.PATCH(
      new Request("http://localhost/api/platform/cells/cell_ara", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "SUSPENDED", correlationId: "corr_1", reason: "Billing hold" })
      }),
      { params: Promise.resolve({ cellId: "cell_ara" }) }
    );
    expect(response.status).toBe(409);
  });

  it("passes provisioning evidence for a controlled activation", async () => {
    const transitionCell = vi.fn().mockResolvedValue({ id: "cell_ara", lifecycleStatus: "ACTIVE" });
    const handlers = createCellItemHandlers({
      authorize: () => ({ actor: "platform-admin@example.com" }),
      transitionCell,
      deleteCell: vi.fn()
    });
    const response = await handlers.PATCH(
      new Request("http://localhost/api/platform/cells/cell_ara", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: "ACTIVE",
          correlationId: "corr_activation",
          reason: "Provisioning checks completed",
          provisioningAttemptId: "attempt_1"
        })
      }),
      { params: Promise.resolve({ cellId: "cell_ara" }) }
    );

    expect(response.status).toBe(200);
    expect(transitionCell).toHaveBeenCalledWith("cell_ara", "ACTIVE", {
      actor: "platform-admin@example.com",
      correlationId: "corr_activation",
      reason: "Provisioning checks completed",
      provisioningAttemptId: "attempt_1"
    });
  });

  it("requires evidence and returns 200 for guarded deletion", async () => {
    const deleteCell = vi.fn().mockResolvedValue({ id: "cell_ara", lifecycleStatus: "DELETED" });
    const handlers = createCellItemHandlers({
      authorize: () => ({ actor: "platform-admin@example.com" }),
      transitionCell: vi.fn(),
      deleteCell
    });
    const response = await handlers.DELETE(
      new Request("http://localhost/api/platform/cells/cell_ara", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          correlationId: "corr_2",
          reason: "Contract complete",
          retentionEvidence: "retention://complete",
          backupEvidence: "backup://verified"
        })
      }),
      { params: Promise.resolve({ cellId: "cell_ara" }) }
    );
    expect(response.status).toBe(200);
    expect(deleteCell).toHaveBeenCalledWith("cell_ara", expect.objectContaining({ actor: "platform-admin@example.com" }));
  });
});
