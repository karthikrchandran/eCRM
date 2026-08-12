// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import {
  CellControlProjectionService,
  createInMemoryCellControlProjectionRepository,
  signControlProjection
} from "./projection";

const secret = "cell-control-projection-secret-at-least-32-bytes";
const issuedAt = "2026-08-11T12:00:00.000Z";

describe("cell control projections", () => {
  it("durably applies a correctly signed lifecycle projection for this cell", async () => {
    const repository = createInMemoryCellControlProjectionRepository();
    const service = new CellControlProjectionService({
      cellId: "cell_ara",
      secret,
      repository,
      now: () => new Date("2026-08-11T12:01:00.000Z")
    });
    const projection = {
      cellId: "cell_ara",
      version: 1,
      type: "LIFECYCLE" as const,
      correlationId: "corr_suspend",
      idempotencyKey: "lifecycle:cell_ara:SUSPENDED:corr_suspend",
      issuedAt,
      payload: { lifecycleStatus: "SUSPENDED" as const, sourceEventId: "event_suspend" }
    };

    await expect(service.apply(projection, signControlProjection(projection, secret))).resolves.toEqual({
      applied: true,
      duplicate: false,
      version: 1
    });
    await expect(repository.getControl("cell_ara")).resolves.toMatchObject({
      cellId: "cell_ara",
      lifecycleStatus: "SUSPENDED",
      version: 1,
      sourceEventId: "event_suspend",
      sourceIdempotencyKey: projection.idempotencyKey
    });
  });

  it("rejects tampering, a request-selected different cell, replay, and out-of-order delivery", async () => {
    const repository = createInMemoryCellControlProjectionRepository();
    const audit = vi.spyOn(repository, "appendAudit");
    const service = new CellControlProjectionService({ cellId: "cell_ara", secret, repository });
    const first = lifecycle(1, "ACTIVE", "corr_1");
    await service.apply(first, signControlProjection(first, secret));

    const duplicate = await service.apply(first, signControlProjection(first, secret));
    expect(duplicate).toEqual({ applied: false, duplicate: true, version: 1 });

    const gap = lifecycle(3, "SUSPENDED", "corr_3");
    await expect(service.apply(gap, signControlProjection(gap, secret))).rejects.toThrow("out of order");

    const otherCell = { ...lifecycle(2, "SUSPENDED", "corr_other"), cellId: "cell_other" };
    await expect(service.apply(otherCell, signControlProjection(otherCell, secret))).rejects.toThrow("cell identity");

    const next = lifecycle(2, "SUSPENDED", "corr_2");
    await expect(service.apply(next, signControlProjection({ ...next, version: 99 }, secret))).rejects.toThrow("signature");
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ result: "FAILED" }));
  });

  it("projects grant creation and revocation into durable local state", async () => {
    const repository = createInMemoryCellControlProjectionRepository();
    const service = new CellControlProjectionService({ cellId: "cell_ara", secret, repository });
    const active = lifecycle(1, "ACTIVE", "corr_active");
    await service.apply(active, signControlProjection(active, secret));
    const create = {
      cellId: "cell_ara", version: 2, type: "SUPPORT_GRANT" as const,
      correlationId: "corr_grant", idempotencyKey: "grant:create:grant_1", issuedAt,
      payload: {
        operation: "UPSERT" as const,
        grant: {
          id: "grant_1", cellId: "cell_ara", operatorId: "support@example.com", caseReference: "CASE-101",
          capabilities: ["configuration:read"], startsAt: issuedAt, expiresAt: "2026-08-11T13:00:00.000Z"
        }
      }
    };
    await service.apply(create, signControlProjection(create, secret));
    expect((await repository.getGrant("grant_1"))?.revokedAt).toBeUndefined();

    const revoke = {
      cellId: "cell_ara", version: 3, type: "SUPPORT_GRANT" as const,
      correlationId: "corr_revoke", idempotencyKey: "grant:revoke:grant_1", issuedAt,
      payload: { operation: "REVOKE" as const, grantId: "grant_1", revokedAt: "2026-08-11T12:30:00.000Z" }
    };
    await service.apply(revoke, signControlProjection(revoke, secret));
    await expect(repository.getGrant("grant_1")).resolves.toMatchObject({ revokedAt: new Date("2026-08-11T12:30:00.000Z") });
  });
});

function lifecycle(version: number, lifecycleStatus: "ACTIVE" | "SUSPENDED", correlationId: string) {
  return {
    cellId: "cell_ara", version, type: "LIFECYCLE" as const, correlationId,
    idempotencyKey: `lifecycle:cell_ara:${lifecycleStatus}:${correlationId}`, issuedAt,
    payload: { lifecycleStatus, sourceEventId: `event_${correlationId}` }
  };
}
