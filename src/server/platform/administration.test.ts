import { describe, expect, it, vi } from "vitest";

import { verifyControlProjectionSignature } from "@/server/cell-control/projection";

import {
  PlatformAdministrationService,
  createInMemoryPlatformAdministrationRepository
} from "./administration";
import type { CellControlProjectionClient } from "./administration";
import type { CustomerCellRecord } from "./types";

const activeCell: CustomerCellRecord = {
  id: "cell_ara",
  cellKey: "ara-global",
  legalName: "ARA Global Inc.",
  displayName: "ARA Global",
  region: "us-east-1",
  desiredSubdomain: "ara",
  planCode: "ENTERPRISE",
  allowedModules: ["crm", "finance"],
  lifecycleStatus: "ACTIVE",
  backupReference: "backup://ara/daily",
  createdAt: new Date("2026-08-11T12:00:00Z"),
  updatedAt: new Date("2026-08-11T12:00:00Z")
};

const command = {
  actor: "platform-admin@example.com",
  correlationId: "corr_1",
  reason: "Customer case CASE-101"
};

describe("platform lifecycle administration", () => {
  it("does not report suspension until the cell durably acknowledges the signed projection", async () => {
    const repository = createInMemoryPlatformAdministrationRepository([activeCell]);
    const deliver = vi.fn().mockResolvedValue({ acknowledged: true, version: 1 });
    const service = projectedService(repository, deliver);

    const updated = await service.transitionCell(activeCell.id, "SUSPENDED", command);

    expect(updated.lifecycleStatus).toBe("SUSPENDED");
    const [projection, signature] = deliver.mock.calls[0]!;
    expect(projection).toMatchObject({
      cellId: activeCell.id, version: 1, type: "LIFECYCLE", correlationId: command.correlationId,
      payload: { lifecycleStatus: "SUSPENDED" }
    });
    expect(verifyControlProjectionSignature(projection, signature, projectionSecret)).toBe(true);
    await expect(repository.projectionDeliveriesForCell(activeCell.id)).resolves.toEqual([
      expect.objectContaining({ status: "DELIVERED", version: 1, idempotencyKey: expect.any(String) })
    ]);
  });

  it("keeps platform state unchanged when projection delivery fails and retries idempotently", async () => {
    const repository = createInMemoryPlatformAdministrationRepository([activeCell]);
    const deliver = vi.fn()
      .mockRejectedValueOnce(new Error("cell unavailable"))
      .mockResolvedValueOnce({ acknowledged: true, version: 1 });
    const service = projectedService(repository, deliver);

    await expect(service.transitionCell(activeCell.id, "SUSPENDED", command)).rejects.toThrow("cell unavailable");
    expect((await repository.getCell(activeCell.id))?.lifecycleStatus).toBe("SUSPENDING");
    expect((await repository.getCell(activeCell.id))?.desiredLifecycleStatus).toBe("SUSPENDED");
    await expect(repository.projectionDeliveriesForCell(activeCell.id)).resolves.toEqual([
      expect.objectContaining({ status: "FAILED", attempts: 1, lastError: "cell unavailable" })
    ]);

    await expect(service.transitionCell(activeCell.id, "SUSPENDED", command)).resolves.toMatchObject({ lifecycleStatus: "SUSPENDED" });
    expect(deliver.mock.calls[0]?.[0]).toEqual(deliver.mock.calls[1]?.[0]);
    await expect(repository.projectionDeliveriesForCell(activeCell.id)).resolves.toEqual([
      expect.objectContaining({ status: "DELIVERED", attempts: 2 })
    ]);
  });

  it("keeps resume authority suspended until ACK finalization and reconciles a crash after ACK", async () => {
    const repository = createInMemoryPlatformAdministrationRepository([{ ...activeCell, lifecycleStatus: "SUSPENDED" }]);
    const finalize = repository.finalizeLifecycleProjection.bind(repository);
    let crash = true;
    repository.finalizeLifecycleProjection = async (...args) => {
      if (crash) {
        crash = false;
        throw new Error("database unavailable after acknowledgement");
      }
      return finalize(...args);
    };
    const deliver = vi.fn(async (envelope) => ({ acknowledged: true as const, version: envelope.version }));
    const service = projectedService(repository, deliver);

    await expect(service.transitionCell(activeCell.id, "ACTIVE", command)).rejects.toThrow("database unavailable");
    await expect(repository.getCell(activeCell.id)).resolves.toMatchObject({
      lifecycleStatus: "SUSPENDED", desiredLifecycleStatus: "ACTIVE"
    });

    await expect(service.reconcileControlProjections()).resolves.toEqual({ attempted: 1, converged: 1, failed: 0 });
    await expect(repository.getCell(activeCell.id)).resolves.toMatchObject({
      lifecycleStatus: "ACTIVE", desiredLifecycleStatus: undefined
    });
    expect(deliver).toHaveBeenCalledTimes(2);
    expect(deliver.mock.calls[0]?.[0]).toEqual(deliver.mock.calls[1]?.[0]);
  });

  it.each([
    ["ACTIVE", "SUSPENDED"],
    ["SUSPENDED", "ACTIVE"],
    ["ACTIVE", "OFFBOARDING"],
    ["SUSPENDED", "OFFBOARDING"]
  ] as const)("allows %s to %s and appends tenant-scoped audit", async (from, to) => {
    const repository = createInMemoryPlatformAdministrationRepository([{ ...activeCell, lifecycleStatus: from }]);
    const service = projectedService(repository);

    const updated = await service.transitionCell(activeCell.id, to, command);

    expect(updated.lifecycleStatus).toBe(to);
    expect(await repository.auditEventsForCell(activeCell.id)).toEqual([
      expect.objectContaining({
        cellId: activeCell.id,
        actor: command.actor,
        correlationId: command.correlationId,
        reason: command.reason,
        action: `cell.lifecycle.${to.toLowerCase()}`,
        result: "SUCCEEDED"
      })
    ]);
  });

  it("rejects an invalid transition without changing the cell and audits the failure", async () => {
    const repository = createInMemoryPlatformAdministrationRepository([activeCell]);
    const service = projectedService(repository);

    await expect(service.transitionCell(activeCell.id, "DELETED" as never, command)).rejects.toThrow(
      "Cannot transition customer cell from ACTIVE to DELETED"
    );

    expect((await repository.getCell(activeCell.id))?.lifecycleStatus).toBe("ACTIVE");
    expect(await repository.auditEventsForCell(activeCell.id)).toEqual([
      expect.objectContaining({ result: "FAILED", error: "INVALID_LIFECYCLE_TRANSITION" })
    ]);
  });

  it("atomically accepts only one of two conflicting transitions and audits the rejected loser", async () => {
    const repository = createInMemoryPlatformAdministrationRepository([activeCell]);
    const service = projectedService(repository);

    const results = await Promise.allSettled([
      service.transitionCell(activeCell.id, "SUSPENDED", { ...command, correlationId: "corr_suspend" }),
      service.transitionCell(activeCell.id, "OFFBOARDING", { ...command, correlationId: "corr_offboard" })
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await repository.auditEventsForCell(activeCell.id)).toEqual(expect.arrayContaining([
      expect.objectContaining({ result: "SUCCEEDED" }),
      expect.objectContaining({ result: "FAILED", error: "Customer cell lifecycle changed concurrently" })
    ]));
  });

  it("activates a provisioning cell only with persisted completion and health evidence", async () => {
    const provisioningCell = { ...activeCell, lifecycleStatus: "PROVISIONING" as const };
    const repository = createInMemoryPlatformAdministrationRepository([provisioningCell], {
      [activeCell.id]: { provisioningAttemptId: "attempt_1", provisioningComplete: true, healthCheckPassed: true }
    });
    const service = projectedService(repository);

    const activated = await service.transitionCell(activeCell.id, "ACTIVE", {
      ...command,
      provisioningAttemptId: "attempt_1"
    });

    expect(activated.lifecycleStatus).toBe("ACTIVE");
    expect(await repository.auditEventsForCell(activeCell.id)).toContainEqual(
      expect.objectContaining({ action: "cell.lifecycle.active", result: "SUCCEEDED", reason: command.reason })
    );
  });

  it("rejects provisioning activation without completion and health evidence", async () => {
    const provisioningCell = { ...activeCell, lifecycleStatus: "PROVISIONING" as const };
    const repository = createInMemoryPlatformAdministrationRepository([provisioningCell]);
    const service = projectedService(repository);

    await expect(service.transitionCell(activeCell.id, "ACTIVE", command)).rejects.toThrow(
      "Provisioning completion and health evidence are required"
    );
    expect((await repository.getCell(activeCell.id))?.lifecycleStatus).toBe("PROVISIONING");
    expect(await repository.auditEventsForCell(activeCell.id)).toContainEqual(
      expect.objectContaining({ result: "FAILED", error: "MISSING_PROVISIONING_EVIDENCE" })
    );
  });

  it("requires backup and retention evidence before terminal deletion", async () => {
    const repository = createInMemoryPlatformAdministrationRepository([{ ...activeCell, lifecycleStatus: "OFFBOARDING" }]);
    const service = projectedService(repository);

    await expect(service.deleteCell(activeCell.id, { ...command, retentionEvidence: "", backupEvidence: "" })).rejects.toThrow(
      "Retention and backup evidence are required"
    );

    const deleted = await service.deleteCell(activeCell.id, {
      ...command,
      retentionEvidence: "retention-complete://CASE-101",
      backupEvidence: "backup-verified://ara/2026-08-11"
    });
    expect(deleted.lifecycleStatus).toBe("DELETED");
  });
});

describe("support grants", () => {
  it("returns the same committed grant and deterministic token after an ambiguous ACK success", async () => {
    const repository = createInMemoryPlatformAdministrationRepository([activeCell]);
    const finalize = repository.finalizeSupportGrantProjection.bind(repository);
    let crash = true;
    repository.finalizeSupportGrantProjection = async (...args) => {
      if (crash) {
        crash = false;
        throw new Error("lost response after cell acknowledgement");
      }
      return finalize(...args);
    };
    const deliver = vi.fn(async (envelope) => ({ acknowledged: true as const, version: envelope.version }));
    const service = projectedService(repository, deliver);
    const input = {
      ...command, cellId: activeCell.id, operatorId: "support@example.com", caseReference: "CASE-101",
      capabilities: ["configuration:read"], expiresAt: new Date("2026-08-11T13:00:00Z")
    };

    await expect(service.createSupportGrant(input)).rejects.toThrow("lost response");
    const retry = await service.createSupportGrant(input);

    expect(retry.id).toBe("grant_176d72e3a56132fb19ca57f3");
    expect(retry.accessToken).toBe("support-token");
    expect(deliver).toHaveBeenCalledTimes(2);
    expect(deliver.mock.calls[0]?.[0]).toEqual(deliver.mock.calls[1]?.[0]);
    await expect(repository.projectionDeliveriesForCell(activeCell.id)).resolves.toEqual([
      expect.objectContaining({ status: "DELIVERED", attempts: 2 })
    ]);
  });

  it("does not create an active grant when token signing cannot succeed", async () => {
    const repository = createInMemoryPlatformAdministrationRepository([activeCell]);
    const deliver = vi.fn();
    const service = new PlatformAdministrationService(repository, () => new Date("2026-08-11T12:00:00Z"), {
      projectionSecret,
      projectionClient: { deliver },
      issueAccessToken: async () => { throw new Error("SUPPORT_ACCESS_SECRET must be at least 32 characters"); }
    });

    await expect(service.createSupportGrant({
      ...command, cellId: activeCell.id, operatorId: "support@example.com", caseReference: "CASE-101",
      capabilities: ["configuration:read"], expiresAt: new Date("2026-08-11T13:00:00Z")
    })).rejects.toThrow("SUPPORT_ACCESS_SECRET");
    expect(deliver).not.toHaveBeenCalled();
    expect(await repository.getSupportGrant("grant_missing")).toBeUndefined();
    expect(await repository.projectionDeliveriesForCell(activeCell.id)).toEqual([]);
  });

  it("creates a time-bound cell grant and audits creation", async () => {
    const repository = createInMemoryPlatformAdministrationRepository([activeCell]);
    const service = projectedService(repository);

    const grant = await service.createSupportGrant({
      ...command,
      cellId: activeCell.id,
      operatorId: "support@example.com",
      caseReference: "CASE-101",
      capabilities: ["configuration:read"],
      expiresAt: new Date("2026-08-11T13:00:00Z")
    });

    expect(service.isSupportGrantActive(grant)).toBe(true);
    expect(grant.capabilities).toEqual(["configuration:read"]);
    expect(await repository.auditEventsForCell(activeCell.id)).toEqual([
      expect.objectContaining({ action: "support-grant.create", result: "SUCCEEDED" })
    ]);
  });

  it("rejects expired grants and revoked grants", async () => {
    const repository = createInMemoryPlatformAdministrationRepository([activeCell]);
    const service = projectedService(repository, undefined, () => new Date("2026-08-11T14:00:00Z"));
    const expired = await repository.createSupportGrant({
      id: "grant_expired",
      cellId: activeCell.id,
      operatorId: "support@example.com",
      caseReference: "CASE-101",
      reason: command.reason,
      capabilities: ["configuration:read"],
      startsAt: new Date("2026-08-11T12:00:00Z"),
      expiresAt: new Date("2026-08-11T13:00:00Z"),
      actor: command.actor,
      correlationId: command.correlationId,
      createdAt: new Date("2026-08-11T12:00:00Z")
    });

    expect(service.isSupportGrantActive(expired)).toBe(false);

    const active = await repository.createSupportGrant({ ...expired, id: "grant_active", expiresAt: new Date("2026-08-11T15:00:00Z") });
    await service.revokeSupportGrant(active.id, { ...command, reason: "Case closed" });
    expect(service.isSupportGrantActive((await repository.getSupportGrant(active.id))!)).toBe(false);
    expect(await repository.auditEventsForCell(activeCell.id)).toContainEqual(
      expect.objectContaining({ action: "support-grant.revoke", reason: "Case closed", result: "SUCCEEDED" })
    );
  });
});

const projectionSecret = "platform-to-cell-control-projection-secret-32-bytes";

function projectedService(
  repository: ReturnType<typeof createInMemoryPlatformAdministrationRepository>,
  deliver: CellControlProjectionClient["deliver"] = async (envelope) => ({ acknowledged: true, version: envelope.version }),
  now: () => Date = () => new Date("2026-08-11T12:00:00Z")
) {
  return new PlatformAdministrationService(repository, now, {
    projectionSecret,
    projectionClient: { deliver },
    issueAccessToken: async () => "support-token"
  });
}
