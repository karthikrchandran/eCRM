import { describe, expect, it } from "vitest";

import {
  PlatformAdministrationService,
  createInMemoryPlatformAdministrationRepository
} from "./administration";
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
  it.each([
    ["ACTIVE", "SUSPENDED"],
    ["SUSPENDED", "ACTIVE"],
    ["ACTIVE", "OFFBOARDING"],
    ["SUSPENDED", "OFFBOARDING"]
  ] as const)("allows %s to %s and appends tenant-scoped audit", async (from, to) => {
    const repository = createInMemoryPlatformAdministrationRepository([{ ...activeCell, lifecycleStatus: from }]);
    const service = new PlatformAdministrationService(repository);

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
    const service = new PlatformAdministrationService(repository);

    await expect(service.transitionCell(activeCell.id, "DELETED" as never, command)).rejects.toThrow(
      "Cannot transition customer cell from ACTIVE to DELETED"
    );

    expect((await repository.getCell(activeCell.id))?.lifecycleStatus).toBe("ACTIVE");
    expect(await repository.auditEventsForCell(activeCell.id)).toEqual([
      expect.objectContaining({ result: "FAILED", error: "INVALID_LIFECYCLE_TRANSITION" })
    ]);
  });

  it("activates a provisioning cell only with persisted completion and health evidence", async () => {
    const provisioningCell = { ...activeCell, lifecycleStatus: "PROVISIONING" as const };
    const repository = createInMemoryPlatformAdministrationRepository([provisioningCell], {
      [activeCell.id]: { provisioningAttemptId: "attempt_1", provisioningComplete: true, healthCheckPassed: true }
    });
    const service = new PlatformAdministrationService(repository);

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
    const service = new PlatformAdministrationService(repository);

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
    const service = new PlatformAdministrationService(repository);

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
  it("creates a time-bound cell grant and audits creation", async () => {
    const repository = createInMemoryPlatformAdministrationRepository([activeCell]);
    const service = new PlatformAdministrationService(repository, () => new Date("2026-08-11T12:00:00Z"));

    const grant = await service.createSupportGrant({
      ...command,
      cellId: activeCell.id,
      operatorId: "support@example.com",
      caseReference: "CASE-101",
      expiresAt: new Date("2026-08-11T13:00:00Z")
    });

    expect(service.isSupportGrantActive(grant)).toBe(true);
    expect(await repository.auditEventsForCell(activeCell.id)).toEqual([
      expect.objectContaining({ action: "support-grant.create", result: "SUCCEEDED" })
    ]);
  });

  it("rejects expired grants and revoked grants", async () => {
    const repository = createInMemoryPlatformAdministrationRepository([activeCell]);
    const service = new PlatformAdministrationService(repository, () => new Date("2026-08-11T14:00:00Z"));
    const expired = await repository.createSupportGrant({
      id: "grant_expired",
      cellId: activeCell.id,
      operatorId: "support@example.com",
      caseReference: "CASE-101",
      reason: command.reason,
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
