import { randomUUID } from "node:crypto";

import type {
  ControlPlaneAuditEventRecord,
  CustomerCellLifecycleStatus,
  CustomerCellRecord,
  SupportGrantRecord
} from "./types";

export type PlatformAuditCommand = {
  actor: string;
  correlationId: string;
  reason: string;
};

export interface PlatformAdministrationRepository {
  listCells(): Promise<CustomerCellRecord[]>;
  getCell(cellId: string): Promise<CustomerCellRecord | undefined>;
  transitionCellWithAudit(cellId: string, status: CustomerCellLifecycleStatus, audit: ControlPlaneAuditEventRecord): Promise<CustomerCellRecord>;
  appendAuditEvent(event: ControlPlaneAuditEventRecord): Promise<void>;
  auditEventsForCell(cellId: string): Promise<ControlPlaneAuditEventRecord[]>;
  createSupportGrantWithAudit(grant: SupportGrantRecord, audit: ControlPlaneAuditEventRecord): Promise<SupportGrantRecord>;
  getSupportGrant(grantId: string): Promise<SupportGrantRecord | undefined>;
  revokeSupportGrantWithAudit(
    grantId: string,
    revokedAt: Date,
    revokedBy: string,
    revocationReason: string,
    audit: ControlPlaneAuditEventRecord
  ): Promise<SupportGrantRecord>;
  createSupportGrant(grant: SupportGrantRecord): Promise<SupportGrantRecord>;
}

const allowedTransitions: Partial<Record<CustomerCellLifecycleStatus, CustomerCellLifecycleStatus[]>> = {
  ACTIVE: ["SUSPENDED", "OFFBOARDING"],
  SUSPENDED: ["ACTIVE", "OFFBOARDING"]
};

export class PlatformAdministrationService {
  public constructor(
    private readonly repository: PlatformAdministrationRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  public listCells(): Promise<CustomerCellRecord[]> {
    return this.repository.listCells();
  }

  public async transitionCell(
    cellId: string,
    status: Extract<CustomerCellLifecycleStatus, "ACTIVE" | "SUSPENDED" | "OFFBOARDING">,
    command: PlatformAuditCommand
  ): Promise<CustomerCellRecord> {
    const cell = await this.requiredCell(cellId);
    const action = `cell.lifecycle.${status.toLowerCase()}`;
    if (!allowedTransitions[cell.lifecycleStatus]?.includes(status)) {
      await this.repository.appendAuditEvent(this.audit(cellId, action, command, "FAILED", "INVALID_LIFECYCLE_TRANSITION"));
      throw new Error(`Cannot transition customer cell from ${cell.lifecycleStatus} to ${status}`);
    }

    return this.repository.transitionCellWithAudit(cellId, status, this.audit(cellId, action, command, "SUCCEEDED"));
  }

  public async deleteCell(
    cellId: string,
    command: PlatformAuditCommand & { retentionEvidence: string; backupEvidence: string }
  ): Promise<CustomerCellRecord> {
    const cell = await this.requiredCell(cellId);
    const validEvidence = Boolean(command.retentionEvidence.trim() && command.backupEvidence.trim());
    if (cell.lifecycleStatus !== "OFFBOARDING" || !validEvidence) {
      const error = cell.lifecycleStatus !== "OFFBOARDING" ? "CELL_NOT_OFFBOARDING" : "MISSING_DELETION_EVIDENCE";
      await this.repository.appendAuditEvent(this.audit(cellId, "cell.lifecycle.deleted", command, "FAILED", error));
      throw new Error(
        cell.lifecycleStatus !== "OFFBOARDING"
          ? "Customer cell must be OFFBOARDING before deletion"
          : "Retention and backup evidence are required"
      );
    }
    const reason = `${command.reason}; retention=${command.retentionEvidence}; backup=${command.backupEvidence}`;
    return this.repository.transitionCellWithAudit(
      cellId,
      "DELETED",
      this.audit(cellId, "cell.lifecycle.deleted", { ...command, reason }, "SUCCEEDED")
    );
  }

  public async createSupportGrant(input: PlatformAuditCommand & {
    cellId: string;
    operatorId: string;
    caseReference: string;
    expiresAt: Date;
  }): Promise<SupportGrantRecord> {
    await this.requiredCell(input.cellId);
    const startsAt = this.now();
    if (!input.operatorId.trim() || !input.caseReference.trim() || !input.reason.trim() || input.expiresAt <= startsAt) {
      await this.repository.appendAuditEvent(this.audit(input.cellId, "support-grant.create", input, "FAILED", "INVALID_SUPPORT_GRANT"));
      throw new Error("Support grant requires operator, case, reason, and a future expiry");
    }
    const grant: SupportGrantRecord = {
      id: `grant_${randomUUID()}`,
      cellId: input.cellId,
      operatorId: input.operatorId,
      caseReference: input.caseReference,
      reason: input.reason,
      startsAt,
      expiresAt: input.expiresAt,
      actor: input.actor,
      correlationId: input.correlationId,
      createdAt: startsAt
    };
    return this.repository.createSupportGrantWithAudit(
      grant,
      this.audit(input.cellId, "support-grant.create", input, "SUCCEEDED")
    );
  }

  public async revokeSupportGrant(grantId: string, command: PlatformAuditCommand): Promise<SupportGrantRecord> {
    const grant = await this.repository.getSupportGrant(grantId);
    if (!grant) throw new Error("Support grant was not found");
    if (grant.revokedAt) return grant;
    return this.repository.revokeSupportGrantWithAudit(
      grantId,
      this.now(),
      command.actor,
      command.reason,
      this.audit(grant.cellId, "support-grant.revoke", command, "SUCCEEDED")
    );
  }

  public getSupportGrant(grantId: string): Promise<SupportGrantRecord | undefined> {
    return this.repository.getSupportGrant(grantId);
  }

  public isSupportGrantActive(grant: SupportGrantRecord): boolean {
    const now = this.now();
    return !grant.revokedAt && grant.startsAt <= now && grant.expiresAt > now;
  }

  private async requiredCell(cellId: string): Promise<CustomerCellRecord> {
    const cell = await this.repository.getCell(cellId);
    if (!cell) throw new Error("Customer cell was not found");
    return cell;
  }

  private audit(
    cellId: string,
    action: string,
    command: PlatformAuditCommand,
    result: "SUCCEEDED" | "FAILED",
    error?: string
  ): ControlPlaneAuditEventRecord {
    return {
      id: `audit_${randomUUID()}`,
      cellId,
      actor: command.actor,
      correlationId: command.correlationId,
      reason: command.reason,
      action,
      result,
      error,
      occurredAt: this.now()
    };
  }
}

export type InMemoryPlatformAdministrationRepository = PlatformAdministrationRepository;

export function createInMemoryPlatformAdministrationRepository(
  initialCells: CustomerCellRecord[] = []
): InMemoryPlatformAdministrationRepository {
  const cells = new Map(initialCells.map((cell) => [cell.id, { ...cell }]));
  const auditEvents: ControlPlaneAuditEventRecord[] = [];
  const grants = new Map<string, SupportGrantRecord>();

  return {
    listCells: async () => [...cells.values()].map((cell) => ({ ...cell })),
    getCell: async (cellId) => {
      const cell = cells.get(cellId);
      return cell ? { ...cell } : undefined;
    },
    transitionCellWithAudit: async (cellId, status, audit) => {
      const cell = cells.get(cellId);
      if (!cell) throw new Error("Customer cell was not found");
      const updated = { ...cell, lifecycleStatus: status, updatedAt: new Date() };
      cells.set(cellId, updated);
      auditEvents.push({ ...audit });
      return { ...updated };
    },
    appendAuditEvent: async (event) => {
      auditEvents.push({ ...event });
    },
    auditEventsForCell: async (cellId) => auditEvents.filter((event) => event.cellId === cellId).map((event) => ({ ...event })),
    createSupportGrant: async (grant) => {
      grants.set(grant.id, { ...grant });
      return { ...grant };
    },
    createSupportGrantWithAudit: async (grant, audit) => {
      grants.set(grant.id, { ...grant });
      auditEvents.push({ ...audit });
      return { ...grant };
    },
    getSupportGrant: async (grantId) => {
      const grant = grants.get(grantId);
      return grant ? { ...grant } : undefined;
    },
    revokeSupportGrantWithAudit: async (grantId, revokedAt, revokedBy, revocationReason, audit) => {
      const grant = grants.get(grantId);
      if (!grant) throw new Error("Support grant was not found");
      const revoked = { ...grant, revokedAt, revokedBy, revocationReason };
      grants.set(grantId, revoked);
      auditEvents.push({ ...audit });
      return { ...revoked };
    }
  };
}
