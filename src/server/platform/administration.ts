import { createHash, randomUUID } from "node:crypto";

import { signControlProjection, type CellControlProjectionEnvelope } from "@/server/cell-control/projection";

import type {
  ControlPlaneAuditEventRecord,
  CustomerCellLifecycleStatus,
  CustomerCellRecord,
  SupportGrantRecord
} from "./types";
import type { ControlProjectionDeliveryRecord } from "./types";

export type PlatformAuditCommand = {
  actor: string;
  correlationId: string;
  reason: string;
  provisioningAttemptId?: string;
};

export type ProvisioningActivationEvidence = {
  provisioningAttemptId: string;
  provisioningComplete: boolean;
  healthCheckPassed: boolean;
};

export interface PlatformAdministrationRepository {
  listCells(): Promise<CustomerCellRecord[]>;
  getCell(cellId: string): Promise<CustomerCellRecord | undefined>;
  getProvisioningActivationEvidence(cellId: string): Promise<ProvisioningActivationEvidence | undefined>;
  transitionCellWithAudit(
    cellId: string,
    expectedStatus: CustomerCellLifecycleStatus,
    status: CustomerCellLifecycleStatus,
    audit: ControlPlaneAuditEventRecord,
    deliveryId?: string
  ): Promise<CustomerCellRecord | undefined>;
  appendAuditEvent(event: ControlPlaneAuditEventRecord): Promise<void>;
  auditEventsForCell(cellId: string): Promise<ControlPlaneAuditEventRecord[]>;
  createSupportGrantWithAudit(grant: SupportGrantRecord, audit: ControlPlaneAuditEventRecord, deliveryId?: string): Promise<SupportGrantRecord>;
  getSupportGrant(grantId: string): Promise<SupportGrantRecord | undefined>;
  revokeSupportGrantWithAudit(
    grantId: string,
    revokedAt: Date,
    revokedBy: string,
    revocationReason: string,
    audit: ControlPlaneAuditEventRecord,
    deliveryId?: string
  ): Promise<SupportGrantRecord>;
  createSupportGrant(grant: SupportGrantRecord): Promise<SupportGrantRecord>;
  stageProjectionDelivery(input: Omit<ControlProjectionDeliveryRecord, "id" | "version" | "status" | "attempts" | "createdAt" | "updatedAt">): Promise<ControlProjectionDeliveryRecord>;
  beginProjectionDeliveryAttempt(deliveryId: string, attemptedAt: Date): Promise<ControlProjectionDeliveryRecord>;
  failProjectionDelivery(deliveryId: string, error: string, audit: ControlPlaneAuditEventRecord): Promise<void>;
  projectionDeliveriesForCell(cellId: string): Promise<ControlProjectionDeliveryRecord[]>;
}

export type CellControlProjectionClient = {
  deliver(envelope: CellControlProjectionEnvelope, signature: string): Promise<{ acknowledged: true; version: number }>;
};

type ProjectionDependencies = {
  projectionSecret: string;
  projectionClient: CellControlProjectionClient;
  issueAccessToken(grant: SupportGrantRecord): Promise<string>;
};

const allowedTransitions: Partial<Record<CustomerCellLifecycleStatus, CustomerCellLifecycleStatus[]>> = {
  PROVISIONING: ["ACTIVE"],
  ACTIVE: ["SUSPENDED", "OFFBOARDING"],
  SUSPENDED: ["ACTIVE", "OFFBOARDING"]
};

export class PlatformAdministrationService {
  public constructor(
    private readonly repository: PlatformAdministrationRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly projections?: ProjectionDependencies
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
    if (cell.lifecycleStatus === "PROVISIONING" && status === "ACTIVE") {
      const evidence = await this.repository.getProvisioningActivationEvidence(cellId);
      const validEvidence = Boolean(
        command.provisioningAttemptId
        && evidence?.provisioningAttemptId === command.provisioningAttemptId
        && evidence.provisioningComplete
        && evidence.healthCheckPassed
      );
      if (!validEvidence) {
        await this.repository.appendAuditEvent(this.audit(cellId, action, command, "FAILED", "MISSING_PROVISIONING_EVIDENCE"));
        throw new Error("Provisioning completion and health evidence are required");
      }
    }
    if (!allowedTransitions[cell.lifecycleStatus]?.includes(status)) {
      await this.repository.appendAuditEvent(this.audit(cellId, action, command, "FAILED", "INVALID_LIFECYCLE_TRANSITION"));
      throw new Error(`Cannot transition customer cell from ${cell.lifecycleStatus} to ${status}`);
    }

    const delivery = await this.deliverProjection(cellId, "LIFECYCLE", command, {
      lifecycleStatus: status,
      sourceEventId: `${action}:${command.correlationId}`
    }, `lifecycle:${cellId}:${status}:${command.correlationId}`);
    const updated = await this.repository.transitionCellWithAudit(
      cellId, cell.lifecycleStatus, status, this.audit(cellId, action, command, "SUCCEEDED"), delivery.id
    );
    if (!updated) throw new Error("Customer cell lifecycle changed concurrently");
    return updated;
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
    const delivery = await this.deliverProjection(cellId, "LIFECYCLE", command, {
      lifecycleStatus: "DELETED",
      sourceEventId: `cell.lifecycle.deleted:${command.correlationId}`
    }, `lifecycle:${cellId}:DELETED:${command.correlationId}`);
    const updated = await this.repository.transitionCellWithAudit(
      cellId, cell.lifecycleStatus, "DELETED",
      this.audit(cellId, "cell.lifecycle.deleted", { ...command, reason }, "SUCCEEDED"), delivery.id
    );
    if (!updated) throw new Error("Customer cell lifecycle changed concurrently");
    return updated;
  }

  public async createSupportGrant(input: PlatformAuditCommand & {
    cellId: string;
    operatorId: string;
    caseReference: string;
    capabilities: string[];
    expiresAt: Date;
  }): Promise<SupportGrantRecord & { accessToken: string }> {
    await this.requiredCell(input.cellId);
    const startsAt = this.now();
    if (!input.operatorId.trim() || !input.caseReference.trim() || !input.reason.trim() || input.expiresAt <= startsAt
      || input.capabilities.length === 0 || input.capabilities.some((capability) => !["configuration:read", "users:read"].includes(capability))) {
      await this.repository.appendAuditEvent(this.audit(input.cellId, "support-grant.create", input, "FAILED", "INVALID_SUPPORT_GRANT"));
      throw new Error("Support grant requires operator, case, reason, and a future expiry");
    }
    const grant: SupportGrantRecord = {
      id: `grant_${createHash("sha256").update(`${input.cellId}:${input.correlationId}`).digest("hex").slice(0, 24)}`,
      cellId: input.cellId,
      operatorId: input.operatorId,
      caseReference: input.caseReference,
      capabilities: [...new Set(input.capabilities)],
      reason: input.reason,
      startsAt,
      expiresAt: input.expiresAt,
      actor: input.actor,
      correlationId: input.correlationId,
      createdAt: startsAt
    };
    const projections = this.requiredProjectionDependencies();
    const accessToken = await projections.issueAccessToken(grant);
    const delivery = await this.deliverProjection(input.cellId, "SUPPORT_GRANT", input, {
      operation: "UPSERT",
      grant: {
        id: grant.id, cellId: grant.cellId, operatorId: grant.operatorId, caseReference: grant.caseReference,
        capabilities: grant.capabilities, startsAt: grant.startsAt.toISOString(), expiresAt: grant.expiresAt.toISOString()
      }
    }, `support-grant:create:${input.cellId}:${input.correlationId}`);
    const created = await this.repository.createSupportGrantWithAudit(
      grant, this.audit(input.cellId, "support-grant.create", input, "SUCCEEDED"), delivery.id
    );
    return Object.assign(created, { accessToken });
  }

  public async revokeSupportGrant(grantId: string, command: PlatformAuditCommand): Promise<SupportGrantRecord> {
    const grant = await this.repository.getSupportGrant(grantId);
    if (!grant) throw new Error("Support grant was not found");
    if (grant.revokedAt) return grant;
    const revokedAt = this.now();
    const delivery = await this.deliverProjection(grant.cellId, "SUPPORT_GRANT", command, {
      operation: "REVOKE", grantId, revokedAt: revokedAt.toISOString()
    }, `support-grant:revoke:${grantId}:${command.correlationId}`);
    const projectedRevokedAt = new Date(String(delivery.payload.revokedAt));
    return this.repository.revokeSupportGrantWithAudit(
      grantId, projectedRevokedAt, command.actor, command.reason,
      this.audit(grant.cellId, "support-grant.revoke", command, "SUCCEEDED"), delivery.id
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

  private requiredProjectionDependencies(): ProjectionDependencies {
    if (!this.projections) throw new Error("Cell control projection delivery is not configured");
    return this.projections;
  }

  private async deliverProjection(
    cellId: string,
    type: "LIFECYCLE" | "SUPPORT_GRANT",
    command: PlatformAuditCommand,
    payload: Record<string, unknown>,
    idempotencyKey: string
  ): Promise<ControlProjectionDeliveryRecord> {
    const projections = this.requiredProjectionDependencies();
    const issuedAt = this.now();
    let delivery: ControlProjectionDeliveryRecord;
    try {
      delivery = await this.repository.stageProjectionDelivery({
        cellId, type, correlationId: command.correlationId, idempotencyKey, issuedAt, payload
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Control projection staging failed";
      await this.repository.appendAuditEvent(
        this.audit(cellId, `control-projection.${type.toLowerCase()}`, command, "FAILED", message)
      );
      throw error;
    }
    const envelope: CellControlProjectionEnvelope = {
      cellId: delivery.cellId, version: delivery.version, type: delivery.type,
      correlationId: delivery.correlationId, idempotencyKey: delivery.idempotencyKey,
      issuedAt: delivery.issuedAt.toISOString(), payload: delivery.payload
    };
    try {
      await this.repository.beginProjectionDeliveryAttempt(delivery.id, this.now());
      const acknowledgement = await projections.projectionClient.deliver(
        envelope,
        signControlProjection(envelope, projections.projectionSecret)
      );
      if (!acknowledgement.acknowledged || acknowledgement.version !== envelope.version) {
        throw new Error("Cell did not acknowledge the durable control projection");
      }
      return delivery;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Control projection delivery failed";
      await this.repository.failProjectionDelivery(
        delivery.id,
        message,
        this.audit(cellId, `control-projection.${type.toLowerCase()}`, command, "FAILED", message)
      );
      throw error;
    }
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
  initialCells: CustomerCellRecord[] = [],
  activationEvidence: Record<string, ProvisioningActivationEvidence> = {}
): InMemoryPlatformAdministrationRepository {
  const cells = new Map(initialCells.map((cell) => [cell.id, { ...cell }]));
  const auditEvents: ControlPlaneAuditEventRecord[] = [];
  const grants = new Map<string, SupportGrantRecord>();
  const deliveries = new Map<string, ControlProjectionDeliveryRecord>();

  return {
    listCells: async () => [...cells.values()].map((cell) => ({ ...cell })),
    getCell: async (cellId) => {
      const cell = cells.get(cellId);
      return cell ? { ...cell } : undefined;
    },
    getProvisioningActivationEvidence: async (cellId) => activationEvidence[cellId],
    transitionCellWithAudit: async (cellId, expectedStatus, status, audit, deliveryId) => {
      const cell = cells.get(cellId);
      if (!cell) throw new Error("Customer cell was not found");
      if (cell.lifecycleStatus !== expectedStatus) {
        auditEvents.push({ ...audit, result: "FAILED", error: "CONCURRENT_LIFECYCLE_TRANSITION" });
        return undefined;
      }
      const updated = { ...cell, lifecycleStatus: status, updatedAt: new Date() };
      cells.set(cellId, updated);
      if (deliveryId) markDelivered(deliveries, deliveryId);
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
    createSupportGrantWithAudit: async (grant, audit, deliveryId) => {
      grants.set(grant.id, { ...grant });
      if (deliveryId) markDelivered(deliveries, deliveryId);
      auditEvents.push({ ...audit });
      return { ...grant };
    },
    getSupportGrant: async (grantId) => {
      const grant = grants.get(grantId);
      return grant ? { ...grant } : undefined;
    },
    revokeSupportGrantWithAudit: async (grantId, revokedAt, revokedBy, revocationReason, audit, deliveryId) => {
      const grant = grants.get(grantId);
      if (!grant) throw new Error("Support grant was not found");
      const revoked = { ...grant, revokedAt, revokedBy, revocationReason };
      grants.set(grantId, revoked);
      if (deliveryId) markDelivered(deliveries, deliveryId);
      auditEvents.push({ ...audit });
      return { ...revoked };
    },
    stageProjectionDelivery: async (input) => {
      const existing = [...deliveries.values()].find((item) => item.idempotencyKey === input.idempotencyKey);
      if (existing) return { ...existing };
      if ([...deliveries.values()].some((item) => item.cellId === input.cellId && item.status !== "DELIVERED")) {
        throw new Error("Another control projection delivery is pending reconciliation");
      }
      const now = new Date();
      const delivery: ControlProjectionDeliveryRecord = {
        ...input, id: `delivery_${randomUUID()}`,
        version: Math.max(0, ...[...deliveries.values()].filter((item) => item.cellId === input.cellId).map((item) => item.version)) + 1,
        status: "PENDING", attempts: 0, createdAt: now, updatedAt: now
      };
      deliveries.set(delivery.id, delivery);
      return { ...delivery };
    },
    beginProjectionDeliveryAttempt: async (deliveryId, attemptedAt) => {
      const delivery = requiredDelivery(deliveries, deliveryId);
      const updated = { ...delivery, status: "PENDING" as const, attempts: delivery.attempts + 1, lastAttemptAt: attemptedAt, lastError: undefined, updatedAt: attemptedAt };
      deliveries.set(deliveryId, updated);
      return { ...updated };
    },
    failProjectionDelivery: async (deliveryId, error, audit) => {
      const delivery = requiredDelivery(deliveries, deliveryId);
      deliveries.set(deliveryId, { ...delivery, status: "FAILED", lastError: error, updatedAt: new Date() });
      auditEvents.push({ ...audit });
    },
    projectionDeliveriesForCell: async (cellId) => [...deliveries.values()]
      .filter((delivery) => delivery.cellId === cellId)
      .sort((left, right) => left.version - right.version)
      .map((delivery) => ({ ...delivery }))
  };
}

function requiredDelivery(deliveries: Map<string, ControlProjectionDeliveryRecord>, deliveryId: string) {
  const delivery = deliveries.get(deliveryId);
  if (!delivery) throw new Error("Control projection delivery was not found");
  return delivery;
}

function markDelivered(deliveries: Map<string, ControlProjectionDeliveryRecord>, deliveryId: string) {
  const delivery = requiredDelivery(deliveries, deliveryId);
  const deliveredAt = new Date();
  deliveries.set(deliveryId, { ...delivery, status: "DELIVERED", deliveredAt, lastError: undefined, updatedAt: deliveredAt });
}
