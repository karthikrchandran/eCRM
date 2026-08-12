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

type NewControlProjectionDelivery = Omit<
  ControlProjectionDeliveryRecord,
  | "id" | "version" | "status" | "attempts" | "lastAttemptAt" | "nextAttemptAt"
  | "leaseOwner" | "leaseExpiresAt" | "deliveredAt" | "deadLetteredAt" | "lastError"
  | "createdAt" | "updatedAt"
>;

export type ControlProjectionReconciliationOptions = {
  workerId?: string;
  batchSize?: number;
  maxAttempts?: number;
  leaseDurationMs?: number;
  baseBackoffMs?: number;
};

export type ControlProjectionReconciliationResult = {
  attempted: number;
  converged: number;
  failed: number;
  deadLettered: number;
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
  getSupportGrantByCorrelation(cellId: string, correlationId: string): Promise<SupportGrantRecord | undefined>;
  stageProjectionDelivery(input: NewControlProjectionDelivery): Promise<ControlProjectionDeliveryRecord>;
  stageLifecycleProjection(
    expectedStatus: CustomerCellLifecycleStatus,
    targetStatus: CustomerCellLifecycleStatus,
    input: NewControlProjectionDelivery
  ): Promise<ControlProjectionDeliveryRecord>;
  finalizeLifecycleProjection(deliveryId: string, audit: ControlPlaneAuditEventRecord): Promise<CustomerCellRecord>;
  finalizeSupportGrantProjection(grantId: string, deliveryId: string, audit: ControlPlaneAuditEventRecord): Promise<SupportGrantRecord>;
  beginProjectionDeliveryAttempt(deliveryId: string, attemptedAt: Date): Promise<ControlProjectionDeliveryRecord>;
  failProjectionDelivery(deliveryId: string, error: string, audit: ControlPlaneAuditEventRecord): Promise<void>;
  claimDueProjectionDeliveries(input: {
    workerId: string;
    attemptedAt: Date;
    leaseExpiresAt: Date;
    limit: number;
    maxAttempts: number;
  }): Promise<ControlProjectionDeliveryRecord[]>;
  rescheduleProjectionDelivery(input: {
    deliveryId: string;
    workerId: string;
    failedAt: Date;
    nextAttemptAt: Date;
    maxAttempts: number;
    error: string;
    audit: ControlPlaneAuditEventRecord;
  }): Promise<{ deadLettered: boolean }>;
  projectionDeliveriesForCell(cellId: string): Promise<ControlProjectionDeliveryRecord[]>;
  pendingProjectionDeliveries(): Promise<ControlProjectionDeliveryRecord[]>;
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
    const continuing = cell.desiredLifecycleStatus === status;
    if (!continuing && !allowedTransitions[cell.lifecycleStatus]?.includes(status)) {
      await this.repository.appendAuditEvent(this.audit(cellId, action, command, "FAILED", "INVALID_LIFECYCLE_TRANSITION"));
      throw new Error(`Cannot transition customer cell from ${cell.lifecycleStatus} to ${status}`);
    }

    const projectionInput = this.projectionInput(cellId, "LIFECYCLE", command, {
      lifecycleStatus: status,
      sourceEventId: `${action}:${command.correlationId}`
    }, `lifecycle:${cellId}:${status}:${command.correlationId}`);
    let delivery: ControlProjectionDeliveryRecord;
    try {
      delivery = await this.repository.stageLifecycleProjection(cell.lifecycleStatus, status, projectionInput);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Control projection staging failed";
      await this.repository.appendAuditEvent(this.audit(cellId, "control-projection.lifecycle", command, "FAILED", message));
      throw error;
    }
    await this.attemptDelivery(delivery, command);
    return this.repository.finalizeLifecycleProjection(delivery.id, this.audit(cellId, action, command, "SUCCEEDED"));
  }

  public async deleteCell(
    cellId: string,
    command: PlatformAuditCommand & { retentionEvidence: string; backupEvidence: string }
  ): Promise<CustomerCellRecord> {
    const cell = await this.requiredCell(cellId);
    const validEvidence = Boolean(command.retentionEvidence.trim() && command.backupEvidence.trim());
    const continuing = cell.lifecycleStatus === "DELETING" && cell.desiredLifecycleStatus === "DELETED";
    if ((!continuing && cell.lifecycleStatus !== "OFFBOARDING") || !validEvidence) {
      const error = !continuing && cell.lifecycleStatus !== "OFFBOARDING" ? "CELL_NOT_OFFBOARDING" : "MISSING_DELETION_EVIDENCE";
      await this.repository.appendAuditEvent(this.audit(cellId, "cell.lifecycle.deleted", command, "FAILED", error));
      throw new Error(
        !continuing && cell.lifecycleStatus !== "OFFBOARDING"
          ? "Customer cell must be OFFBOARDING before deletion"
          : "Retention and backup evidence are required"
      );
    }
    const reason = `${command.reason}; retention=${command.retentionEvidence}; backup=${command.backupEvidence}`;
    const projectionInput = this.projectionInput(cellId, "LIFECYCLE", command, {
      lifecycleStatus: "DELETED",
      sourceEventId: `cell.lifecycle.deleted:${command.correlationId}`,
      retentionEvidence: command.retentionEvidence,
      backupEvidence: command.backupEvidence
    }, `lifecycle:${cellId}:DELETED:${command.correlationId}`);
    const delivery = await this.repository.stageLifecycleProjection(cell.lifecycleStatus, "DELETED", projectionInput);
    await this.attemptDelivery(delivery, command);
    return this.repository.finalizeLifecycleProjection(
      delivery.id,
      this.audit(cellId, "cell.lifecycle.deleted", { ...command, reason }, "SUCCEEDED")
    );
  }

  public async createSupportGrant(input: PlatformAuditCommand & {
    cellId: string;
    operatorId: string;
    caseReference: string;
    capabilities: string[];
    expiresAt: Date;
  }): Promise<SupportGrantRecord & { accessToken: string }> {
    await this.requiredCell(input.cellId);
    const existing = await this.repository.getSupportGrantByCorrelation(input.cellId, input.correlationId);
    const startsAt = existing?.startsAt ?? this.now();
    if (!input.operatorId.trim() || !input.caseReference.trim() || !input.reason.trim() || input.expiresAt <= startsAt
      || input.capabilities.length === 0 || input.capabilities.some((capability) => !["configuration:read", "users:read"].includes(capability))) {
      await this.repository.appendAuditEvent(this.audit(input.cellId, "support-grant.create", input, "FAILED", "INVALID_SUPPORT_GRANT"));
      throw new Error("Support grant requires operator, case, reason, and a future expiry");
    }
    const grant: SupportGrantRecord = existing ?? {
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
    if (!existing) await this.repository.createSupportGrant(grant);
    const delivery = await this.deliverProjection(input.cellId, "SUPPORT_GRANT", input, {
      operation: "UPSERT",
      grant: {
        id: grant.id, cellId: grant.cellId, operatorId: grant.operatorId, caseReference: grant.caseReference,
        capabilities: grant.capabilities, startsAt: grant.startsAt.toISOString(), expiresAt: grant.expiresAt.toISOString()
      }
    }, `support-grant:create:${input.cellId}:${input.correlationId}`);
    const created = await this.repository.finalizeSupportGrantProjection(
      grant.id, delivery.id, this.audit(input.cellId, "support-grant.create", input, "SUCCEEDED")
    );
    return Object.assign(created, { accessToken });
  }

  public async reconcileControlProjections(
    options: ControlProjectionReconciliationOptions = {}
  ): Promise<ControlProjectionReconciliationResult> {
    const attemptedAt = this.now();
    const workerId = options.workerId?.trim() || `projection-worker-${randomUUID()}`;
    const batchSize = boundedInteger(options.batchSize, 25, 1, 100);
    const maxAttempts = boundedInteger(options.maxAttempts, 8, 1, 100);
    const leaseDurationMs = boundedInteger(options.leaseDurationMs, 30_000, 1_000, 300_000);
    const baseBackoffMs = boundedInteger(options.baseBackoffMs, 1_000, 1, 3_600_000);
    const deliveries = await this.repository.claimDueProjectionDeliveries({
      workerId,
      attemptedAt,
      leaseExpiresAt: new Date(attemptedAt.getTime() + leaseDurationMs),
      limit: batchSize,
      maxAttempts
    });
    let converged = 0;
    let failed = 0;
    let deadLettered = 0;
    for (const delivery of deliveries) {
      const command = { actor: "system:projection-reconciler", correlationId: delivery.correlationId, reason: "Reconcile pending control projection" };
      try {
        await this.deliverProjectionEnvelope(delivery);
        await this.finalizeReconciledProjection(delivery, command);
        converged += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Control projection reconciliation failed";
        const delay = Math.min(baseBackoffMs * (2 ** Math.max(0, delivery.attempts - 1)), 3_600_000);
        const terminal = delivery.attempts >= maxAttempts;
        const outcome = await this.repository.rescheduleProjectionDelivery({
          deliveryId: delivery.id,
          workerId,
          failedAt: this.now(),
          nextAttemptAt: new Date(this.now().getTime() + delay),
          maxAttempts,
          error: message,
          audit: this.audit(
            delivery.cellId,
            terminal ? "control-projection.dead-lettered" : "control-projection.retry-failed",
            command,
            "FAILED",
            message
          )
        });
        if (outcome.deadLettered) deadLettered += 1;
        failed += 1;
      }
    }
    return { attempted: deliveries.length, converged, failed, deadLettered };
  }

  public async revokeSupportGrant(grantId: string, command: PlatformAuditCommand): Promise<SupportGrantRecord> {
    const grant = await this.repository.getSupportGrant(grantId);
    if (!grant) throw new Error("Support grant was not found");
    if (grant.revokedAt) return grant;
    const revokedAt = this.now();
    const delivery = await this.deliverProjection(grant.cellId, "SUPPORT_GRANT", command, {
      operation: "REVOKE", grantId, revokedAt: revokedAt.toISOString(),
      revokedBy: command.actor, revocationReason: command.reason
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
    const input = this.projectionInput(cellId, type, command, payload, idempotencyKey);
    let delivery: ControlProjectionDeliveryRecord;
    try {
      delivery = await this.repository.stageProjectionDelivery(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Control projection staging failed";
      await this.repository.appendAuditEvent(
        this.audit(cellId, `control-projection.${type.toLowerCase()}`, command, "FAILED", message)
      );
      throw error;
    }
    await this.attemptDelivery(delivery, command);
    return delivery;
  }

  private projectionInput(
    cellId: string,
    type: "LIFECYCLE" | "SUPPORT_GRANT",
    command: PlatformAuditCommand,
    payload: Record<string, unknown>,
    idempotencyKey: string
  ) {
    return { cellId, type, correlationId: command.correlationId, idempotencyKey, issuedAt: this.now(), payload };
  }

  private async attemptDelivery(delivery: ControlProjectionDeliveryRecord, command: PlatformAuditCommand): Promise<void> {
    try {
      await this.repository.beginProjectionDeliveryAttempt(delivery.id, this.now());
      await this.deliverProjectionEnvelope(delivery);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Control projection delivery failed";
      await this.repository.failProjectionDelivery(
        delivery.id,
        message,
        this.audit(delivery.cellId, `control-projection.${delivery.type.toLowerCase()}`, command, "FAILED", message)
      );
      throw error;
    }
  }

  private async deliverProjectionEnvelope(delivery: ControlProjectionDeliveryRecord): Promise<void> {
    const projections = this.requiredProjectionDependencies();
    const envelope: CellControlProjectionEnvelope = {
      cellId: delivery.cellId, version: delivery.version, type: delivery.type,
      correlationId: delivery.correlationId, idempotencyKey: delivery.idempotencyKey,
      issuedAt: delivery.issuedAt.toISOString(), payload: delivery.payload
    };
    const acknowledgement = await projections.projectionClient.deliver(
      envelope,
      signControlProjection(envelope, projections.projectionSecret)
    );
    if (!acknowledgement.acknowledged || acknowledgement.version !== envelope.version) {
      throw new Error("Cell did not acknowledge the durable control projection");
    }
  }

  private async finalizeReconciledProjection(
    delivery: ControlProjectionDeliveryRecord,
    command: PlatformAuditCommand
  ): Promise<void> {
    if (delivery.type === "LIFECYCLE") {
      await this.repository.finalizeLifecycleProjection(
        delivery.id,
        this.audit(delivery.cellId, "cell.lifecycle.reconciled", command, "SUCCEEDED")
      );
      return;
    }
    if (delivery.payload.operation === "REVOKE") {
      const grantId = requiredString(delivery.payload.grantId, "Support grant revocation grantId is invalid");
      const revokedAt = new Date(requiredString(delivery.payload.revokedAt, "Support grant revocation time is invalid"));
      const revokedBy = requiredString(delivery.payload.revokedBy, "Support grant revocation actor is invalid");
      const revocationReason = requiredString(delivery.payload.revocationReason, "Support grant revocation reason is invalid");
      await this.repository.revokeSupportGrantWithAudit(
        grantId,
        revokedAt,
        revokedBy,
        revocationReason,
        this.audit(delivery.cellId, "support-grant.revoke.reconciled", { ...command, reason: revocationReason }, "SUCCEEDED"),
        delivery.id
      );
      return;
    }
    const grant = delivery.payload.grant as { id?: string } | undefined;
    if (!grant?.id) throw new Error("Support grant reconciliation payload is invalid");
    await this.repository.finalizeSupportGrantProjection(
      grant.id,
      delivery.id,
      this.audit(delivery.cellId, "support-grant.reconciled", command, "SUCCEEDED")
    );
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
      const existing = [...grants.values()].find((item) => item.cellId === grant.cellId && item.correlationId === grant.correlationId);
      if (existing) return { ...existing };
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
    getSupportGrantByCorrelation: async (cellId, correlationId) => {
      const grant = [...grants.values()].find((item) => item.cellId === cellId && item.correlationId === correlationId);
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
      const now = input.issuedAt;
      const delivery: ControlProjectionDeliveryRecord = {
        ...input, id: `delivery_${randomUUID()}`,
        version: Math.max(0, ...[...deliveries.values()].filter((item) => item.cellId === input.cellId).map((item) => item.version)) + 1,
        status: "PENDING", attempts: 0, nextAttemptAt: now, createdAt: now, updatedAt: now
      };
      deliveries.set(delivery.id, delivery);
      return { ...delivery };
    },
    stageLifecycleProjection: async (expectedStatus, targetStatus, input) => {
      const existing = [...deliveries.values()].find((item) => item.idempotencyKey === input.idempotencyKey);
      if (existing) return { ...existing };
      const cell = cells.get(input.cellId);
      if (!cell || cell.lifecycleStatus !== expectedStatus) throw new Error("Customer cell lifecycle changed concurrently");
      if ([...deliveries.values()].some((item) => item.cellId === input.cellId && item.status !== "DELIVERED")) {
        throw new Error("Another control projection delivery is pending reconciliation");
      }
      const now = input.issuedAt;
      const delivery: ControlProjectionDeliveryRecord = {
        ...input, id: `delivery_${randomUUID()}`,
        version: Math.max(0, ...[...deliveries.values()].filter((item) => item.cellId === input.cellId).map((item) => item.version)) + 1,
        status: "PENDING", attempts: 0, nextAttemptAt: now, createdAt: now, updatedAt: now
      };
      deliveries.set(delivery.id, delivery);
      const authorityStatus = targetStatus === "SUSPENDED" ? "SUSPENDING"
        : targetStatus === "OFFBOARDING" ? targetStatus
          : targetStatus === "DELETED" ? "DELETING"
          : cell.lifecycleStatus;
      cells.set(cell.id, { ...cell, lifecycleStatus: authorityStatus, desiredLifecycleStatus: targetStatus, updatedAt: new Date() });
      return delivery;
    },
    finalizeLifecycleProjection: async (deliveryId, audit) => {
      const delivery = requiredDelivery(deliveries, deliveryId);
      const cell = cells.get(delivery.cellId);
      if (!cell) throw new Error("Customer cell was not found");
      const targetStatus = String(delivery.payload.lifecycleStatus) as CustomerCellLifecycleStatus;
      if (cell.desiredLifecycleStatus !== targetStatus) throw new Error("Customer cell lifecycle intent changed concurrently");
      const updated = { ...cell, lifecycleStatus: targetStatus, desiredLifecycleStatus: undefined, updatedAt: new Date() };
      cells.set(cell.id, updated);
      markDelivered(deliveries, deliveryId);
      auditEvents.push({ ...audit });
      return { ...updated };
    },
    finalizeSupportGrantProjection: async (grantId, deliveryId, audit) => {
      const grant = grants.get(grantId);
      if (!grant) throw new Error("Support grant was not found");
      markDelivered(deliveries, deliveryId);
      auditEvents.push({ ...audit });
      return { ...grant };
    },
    beginProjectionDeliveryAttempt: async (deliveryId, attemptedAt) => {
      const delivery = requiredDelivery(deliveries, deliveryId);
      const updated = { ...delivery, status: "PENDING" as const, attempts: delivery.attempts + 1, lastAttemptAt: attemptedAt, lastError: undefined, updatedAt: attemptedAt };
      deliveries.set(deliveryId, updated);
      return { ...updated };
    },
    failProjectionDelivery: async (deliveryId, error, audit) => {
      const delivery = requiredDelivery(deliveries, deliveryId);
      const failedAt = audit.occurredAt;
      deliveries.set(deliveryId, {
        ...delivery, status: "FAILED", lastError: error, nextAttemptAt: failedAt,
        leaseOwner: undefined, leaseExpiresAt: undefined, updatedAt: failedAt
      });
      auditEvents.push({ ...audit });
    },
    claimDueProjectionDeliveries: async ({ workerId, attemptedAt, leaseExpiresAt, limit, maxAttempts }) => {
      const claimed: ControlProjectionDeliveryRecord[] = [];
      for (const delivery of [...deliveries.values()].sort((left, right) => left.nextAttemptAt.getTime() - right.nextAttemptAt.getTime())) {
        if (claimed.length >= limit) break;
        const due = (delivery.status === "PENDING" || delivery.status === "FAILED")
          && delivery.nextAttemptAt <= attemptedAt
          && delivery.attempts < maxAttempts
          && (!delivery.leaseExpiresAt || delivery.leaseExpiresAt <= attemptedAt);
        if (!due) continue;
        const updated: ControlProjectionDeliveryRecord = {
          ...delivery,
          status: "PENDING",
          attempts: delivery.attempts + 1,
          lastAttemptAt: attemptedAt,
          lastError: undefined,
          leaseOwner: workerId,
          leaseExpiresAt,
          updatedAt: attemptedAt
        };
        deliveries.set(delivery.id, updated);
        claimed.push({ ...updated });
      }
      return claimed;
    },
    rescheduleProjectionDelivery: async ({
      deliveryId, workerId, failedAt, nextAttemptAt, maxAttempts, error, audit
    }) => {
      const delivery = requiredDelivery(deliveries, deliveryId);
      if (delivery.leaseOwner !== workerId || delivery.status !== "PENDING") {
        throw new Error("Control projection reconciliation lease was lost");
      }
      const deadLettered = delivery.attempts >= maxAttempts;
      deliveries.set(deliveryId, {
        ...delivery,
        status: deadLettered ? "DEAD_LETTER" : "FAILED",
        nextAttemptAt,
        leaseOwner: undefined,
        leaseExpiresAt: undefined,
        deadLetteredAt: deadLettered ? failedAt : undefined,
        lastError: error,
        updatedAt: failedAt
      });
      auditEvents.push({ ...audit });
      return { deadLettered };
    },
    projectionDeliveriesForCell: async (cellId) => [...deliveries.values()]
      .filter((delivery) => delivery.cellId === cellId)
      .sort((left, right) => left.version - right.version)
      .map((delivery) => ({ ...delivery })),
    pendingProjectionDeliveries: async () => [...deliveries.values()]
      .filter((delivery) => delivery.status !== "DELIVERED")
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
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
  deliveries.set(deliveryId, {
    ...delivery,
    status: "DELIVERED",
    deliveredAt,
    lastError: undefined,
    leaseOwner: undefined,
    leaseExpiresAt: undefined,
    updatedAt: deliveredAt
  });
}

function boundedInteger(value: number | undefined, fallback: number, minimum: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value)) throw new Error("Control projection reconciliation options must be integers");
  return Math.min(maximum, Math.max(minimum, value));
}

function requiredString(value: unknown, error: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(error);
  return value;
}
