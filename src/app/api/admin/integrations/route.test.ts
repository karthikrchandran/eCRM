import { describe, expect, it, vi } from "vitest";

import { createIntegrationAdminHandlers } from "./route";

const authorized = { user: { id: "admin_1", role: "ADMIN" as const }, cellId: "cell_ara", cellKey: "ara" };

describe("cell integration administration API", () => {
  it("is cell-admin, active-lifecycle, and module guarded through authorization dependencies", async () => {
    const list = vi.fn();
    const denied = createIntegrationAdminHandlers({
      authorize: vi.fn().mockResolvedValue(Response.json({ error: "Customer cell is not active." }, { status: 423 })),
      requireModule: vi.fn(), list, issue: vi.fn(), status: vi.fn(), deadLetters: vi.fn(), repairCandidates: vi.fn(), replay: vi.fn(), reconcile: vi.fn()
    });
    expect((await denied.GET(new Request("http://cell/api/admin/integrations"))).status).toBe(423);
    expect(list).not.toHaveBeenCalled();

    const moduleDenied = createIntegrationAdminHandlers({
      authorize: vi.fn().mockResolvedValue(authorized), requireModule: vi.fn().mockRejectedValue(new Error("Module crm is not enabled")),
      list, issue: vi.fn(), status: vi.fn(), deadLetters: vi.fn(), repairCandidates: vi.fn(), replay: vi.fn(), reconcile: vi.fn()
    });
    expect((await moduleDenied.GET(new Request("http://cell/api/admin/integrations"))).status).toBe(403);
  });

  it("issues a credential and returns its generated secret exactly in the creation response", async () => {
    const issue = vi.fn().mockResolvedValue({ credential: { id: "cred_1", status: "ACTIVE" }, secret: "ecrm_cred_1.once" });
    const handlers = createIntegrationAdminHandlers({
      authorize: vi.fn().mockResolvedValue(authorized), requireModule: vi.fn(), list: vi.fn(), issue,
      status: vi.fn(), deadLetters: vi.fn(), repairCandidates: vi.fn(), replay: vi.fn(), reconcile: vi.fn()
    });
    const response = await handlers.POST(new Request("http://cell/api/admin/integrations", {
      method: "POST", body: JSON.stringify({ action: "issue", name: "SignalLoop", capabilities: ["WORKFLOW_EVENTS_WRITE"], expiresAt: "2026-12-01T00:00:00Z", correlationId: "corr_1", reason: "Install" })
    }));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ credential: { id: "cred_1", status: "ACTIVE" }, secret: "ecrm_cred_1.once" });
    expect(issue).toHaveBeenCalledWith(authorized.user, expect.objectContaining({ name: "SignalLoop", capabilities: ["WORKFLOW_EVENTS_WRITE"] }));
  });

  it("returns payload-free delivery status and requires a reason for dead-letter replay", async () => {
    const status = vi.fn().mockResolvedValue({
      pending: 1, claimed: 2, failed: 3, delivered: 4, deadLetter: 1, checkpoint: "cp_1", sourceCount: 4, degraded: true,
      circuits: [{
        id: "circuit_internal", cellId: "cell_ara", destinationInstallation: "signalloop:ara", state: "HALF_OPEN", failureCount: 5,
        lastFailureAt: new Date("2026-08-12T11:00:00Z"), openedAt: new Date("2026-08-12T11:01:00Z"), openUntil: new Date("2026-08-12T12:01:00Z"),
        probeFenceToken: "secret-fence", probeLeaseOwner: "worker-secret", probeLeaseUntil: new Date("2026-08-12T12:00:00Z"),
        windowStartedAt: new Date("2026-08-12T10:00:00Z"), createdAt: new Date("2026-08-12T10:00:00Z"), updatedAt: new Date("2026-08-12T11:01:00Z")
      }]
    });
    const deadLetters = vi.fn().mockResolvedValue([{ id: "outbox_1", attempts: 5, errorCode: "REMOTE_503", payload: { secret: "must not leak" } }]);
    const handlers = createIntegrationAdminHandlers({
      authorize: vi.fn().mockResolvedValue(authorized), requireModule: vi.fn(), list: vi.fn().mockResolvedValue([]), issue: vi.fn(),
      status, deadLetters, repairCandidates: vi.fn().mockResolvedValue([]), replay: vi.fn(), reconcile: vi.fn()
    });
    const response = await handlers.GET(new Request("http://cell/api/admin/integrations"));
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("must not leak");
    expect(JSON.stringify(body.status)).not.toContain("secret-fence");
    expect(JSON.stringify(body.status)).not.toContain("worker-secret");
    expect(body.status).toEqual({
      pending: 1, claimed: 2, failed: 3, delivered: 4, deadLetter: 1, checkpoint: "cp_1", sourceCount: 4, degraded: true,
      circuits: [{
        destinationInstallation: "signalloop:ara", state: "HALF_OPEN", failureCount: 5,
        lastFailureAt: "2026-08-12T11:00:00.000Z", openedAt: "2026-08-12T11:01:00.000Z", openUntil: "2026-08-12T12:01:00.000Z"
      }]
    });
    expect(body.deadLetters[0]).toEqual({ id: "outbox_1", attempts: 5, errorCode: "REMOTE_503" });

    const replay = await handlers.POST(new Request("http://cell/api/admin/integrations", { method: "POST", body: JSON.stringify({ action: "replay", outboxId: "outbox_1", reason: "" }) }));
    expect(replay.status).toBe(400);
  });

  it("scopes replay to the authenticated cell id", async () => {
    const replay = vi.fn();
    const handlers = createIntegrationAdminHandlers({
      authorize: vi.fn().mockResolvedValue(authorized), requireModule: vi.fn(), list: vi.fn(), issue: vi.fn(),
      status: vi.fn(), deadLetters: vi.fn(), repairCandidates: vi.fn(), replay, reconcile: vi.fn()
    });
    const response = await handlers.POST(new Request("http://cell/api/admin/integrations", {
      method: "POST", body: JSON.stringify({ action: "replay", outboxId: "outbox_other", reason: "Operator retry" })
    }));
    expect(response.status).toBe(200);
    expect(replay).toHaveBeenCalledWith("cell_ara", "outbox_other", "admin_1", "Operator retry", expect.any(Date));
  });
});
