import { Prisma, type PrismaClient } from "../../generated/platform-client";

import type { PlatformAdministrationRepository } from "./administration";
import type {
  ControlProjectionDeliveryRecord,
  ControlPlaneAuditEventRecord,
  CustomerCellRecord,
  SupportGrantRecord
} from "./types";

export class PrismaPlatformAdministrationRepository implements PlatformAdministrationRepository {
  public constructor(private readonly client: PrismaClient) {}

  public async listCells(): Promise<CustomerCellRecord[]> {
    return (await this.client.customerCell.findMany({ orderBy: { createdAt: "asc" } })).map(mapCell);
  }

  public async getCell(cellId: string): Promise<CustomerCellRecord | undefined> {
    const cell = await this.client.customerCell.findUnique({ where: { id: cellId } });
    return cell ? mapCell(cell) : undefined;
  }

  public async getProvisioningActivationEvidence(cellId: string) {
    const attempt = await this.client.provisioningAttempt.findFirst({
      where: { cellId, result: "SUCCEEDED" },
      orderBy: { createdAt: "desc" },
      include: { actions: { where: { step: "health-check", result: "SUCCEEDED" }, select: { id: true } } }
    });
    return attempt ? {
      provisioningAttemptId: attempt.id,
      provisioningComplete: attempt.result === "SUCCEEDED",
      healthCheckPassed: attempt.actions.length > 0
    } : undefined;
  }

  public async transitionCellWithAudit(
    cellId: string,
    expectedStatus: CustomerCellRecord["lifecycleStatus"],
    status: CustomerCellRecord["lifecycleStatus"],
    audit: ControlPlaneAuditEventRecord,
    deliveryId?: string
  ): Promise<CustomerCellRecord | undefined> {
    return this.client.$transaction(async (transaction) => {
      const result = await transaction.customerCell.updateMany({
        where: { id: cellId, lifecycleStatus: expectedStatus },
        data: { lifecycleStatus: status }
      });
      if (result.count !== 1) {
        await transaction.controlPlaneAuditEvent.create({
          data: auditData({ ...audit, result: "FAILED", error: "CONCURRENT_LIFECYCLE_TRANSITION" })
        });
        return undefined;
      }
      const cell = await transaction.customerCell.findUniqueOrThrow({ where: { id: cellId } });
      if (deliveryId) await markDeliveryDelivered(transaction, deliveryId);
      await transaction.controlPlaneAuditEvent.create({ data: auditData(audit) });
      return mapCell(cell);
    });
  }

  public async appendAuditEvent(event: ControlPlaneAuditEventRecord): Promise<void> {
    await this.client.controlPlaneAuditEvent.create({ data: auditData(event) });
  }

  public async auditEventsForCell(cellId: string): Promise<ControlPlaneAuditEventRecord[]> {
    return (await this.client.controlPlaneAuditEvent.findMany({ where: { cellId }, orderBy: { occurredAt: "asc" } })).map((event) => ({
      ...event,
      result: event.result as ControlPlaneAuditEventRecord["result"],
      reason: event.reason ?? undefined,
      error: event.error ?? undefined,
      errorCode: event.errorCode ?? undefined,
      secretReference: event.secretReference ?? undefined
    }));
  }

  public async createSupportGrant(grant: SupportGrantRecord): Promise<SupportGrantRecord> {
    return mapGrant(await this.client.supportGrant.create({ data: grantData(grant) }));
  }

  public async createSupportGrantWithAudit(
    grant: SupportGrantRecord,
    audit: ControlPlaneAuditEventRecord,
    deliveryId?: string
  ): Promise<SupportGrantRecord> {
    return this.client.$transaction(async (transaction) => {
      const created = await transaction.supportGrant.create({ data: grantData(grant) });
      if (deliveryId) await markDeliveryDelivered(transaction, deliveryId);
      await transaction.controlPlaneAuditEvent.create({ data: auditData(audit) });
      return mapGrant(created);
    });
  }

  public async getSupportGrant(grantId: string): Promise<SupportGrantRecord | undefined> {
    const grant = await this.client.supportGrant.findUnique({ where: { id: grantId } });
    return grant ? mapGrant(grant) : undefined;
  }

  public async revokeSupportGrantWithAudit(
    grantId: string,
    revokedAt: Date,
    revokedBy: string,
    revocationReason: string,
    audit: ControlPlaneAuditEventRecord,
    deliveryId?: string
  ): Promise<SupportGrantRecord> {
    return this.client.$transaction(async (transaction) => {
      const grant = await transaction.supportGrant.update({
        where: { id: grantId },
        data: { revokedAt, revokedBy, revocationReason }
      });
      if (deliveryId) await markDeliveryDelivered(transaction, deliveryId);
      await transaction.controlPlaneAuditEvent.create({ data: auditData(audit) });
      return mapGrant(grant);
    });
  }

  public async stageProjectionDelivery(
    input: Omit<ControlProjectionDeliveryRecord, "id" | "version" | "status" | "attempts" | "createdAt" | "updatedAt">
  ): Promise<ControlProjectionDeliveryRecord> {
    const existing = await this.client.controlProjectionDelivery.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return mapDelivery(existing);
    try {
      return await this.client.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT "id" FROM "CustomerCell" WHERE "id" = ${input.cellId} FOR UPDATE`;
        const outstanding = await transaction.controlProjectionDelivery.findFirst({
          where: { cellId: input.cellId, status: { not: "DELIVERED" } }, select: { idempotencyKey: true }
        });
        if (outstanding) throw new Error("Another control projection delivery is pending reconciliation");
        const latest = await transaction.controlProjectionDelivery.aggregate({
          where: { cellId: input.cellId }, _max: { version: true }
        });
        return mapDelivery(await transaction.controlProjectionDelivery.create({ data: {
          ...input, version: (latest._max.version ?? 0) + 1, payload: input.payload as Prisma.InputJsonValue
        }}));
      });
    } catch (error) {
      const retry = await this.client.controlProjectionDelivery.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (retry) return mapDelivery(retry);
      throw error;
    }
  }

  public async beginProjectionDeliveryAttempt(deliveryId: string, attemptedAt: Date): Promise<ControlProjectionDeliveryRecord> {
    return mapDelivery(await this.client.controlProjectionDelivery.update({
      where: { id: deliveryId },
      data: { status: "PENDING", attempts: { increment: 1 }, lastAttemptAt: attemptedAt, lastError: null }
    }));
  }

  public async failProjectionDelivery(
    deliveryId: string,
    error: string,
    audit: ControlPlaneAuditEventRecord
  ): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      await transaction.controlProjectionDelivery.update({
        where: { id: deliveryId }, data: { status: "FAILED", lastError: error }
      });
      await transaction.controlPlaneAuditEvent.create({ data: auditData(audit) });
    });
  }

  public async projectionDeliveriesForCell(cellId: string): Promise<ControlProjectionDeliveryRecord[]> {
    return (await this.client.controlProjectionDelivery.findMany({
      where: { cellId }, orderBy: { version: "asc" }
    })).map(mapDelivery);
  }
}

async function markDeliveryDelivered(
  transaction: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
  deliveryId: string
) {
  await transaction.controlProjectionDelivery.update({
    where: { id: deliveryId },
    data: { status: "DELIVERED", deliveredAt: new Date(), lastError: null }
  });
}

function auditData(event: ControlPlaneAuditEventRecord) {
  return {
    id: event.id,
    cellId: event.cellId,
    actor: event.actor,
    action: event.action,
    result: event.result,
    correlationId: event.correlationId,
    reason: event.reason,
    error: event.error,
    errorCode: event.errorCode,
    secretReference: event.secretReference,
    occurredAt: event.occurredAt
  };
}

function grantData(grant: SupportGrantRecord) {
  return {
    id: grant.id,
    cellId: grant.cellId,
    operatorId: grant.operatorId,
    caseReference: grant.caseReference,
    capabilities: grant.capabilities,
    reason: grant.reason,
    startsAt: grant.startsAt,
    expiresAt: grant.expiresAt,
    revokedAt: grant.revokedAt,
    revokedBy: grant.revokedBy,
    revocationReason: grant.revocationReason,
    actor: grant.actor,
    correlationId: grant.correlationId,
    createdAt: grant.createdAt
  };
}

function mapGrant(grant: {
  id: string; cellId: string; operatorId: string; caseReference: string; capabilities: string[]; reason: string; startsAt: Date; expiresAt: Date;
  revokedAt: Date | null; revokedBy: string | null; revocationReason: string | null; actor: string; correlationId: string; createdAt: Date;
}): SupportGrantRecord {
  return {
    ...grant,
    revokedAt: grant.revokedAt ?? undefined,
    revokedBy: grant.revokedBy ?? undefined,
    revocationReason: grant.revocationReason ?? undefined
  };
}

function mapCell(cell: {
  id: string; cellKey: string; legalName: string; displayName: string; region: string; desiredSubdomain: string;
  planCode: string; allowedModules: string[];
  lifecycleStatus: string; databaseReference: string | null; storageReference: string | null; secretReference: string | null;
  backupReference: string | null; applicationReference: string | null; applicationUrl: string | null;
  signalLoopWorkspaceReference: string | null; createdAt: Date; updatedAt: Date;
}): CustomerCellRecord {
  return {
    ...cell,
    lifecycleStatus: cell.lifecycleStatus as CustomerCellRecord["lifecycleStatus"],
    databaseReference: cell.databaseReference ?? undefined,
    storageReference: cell.storageReference ?? undefined,
    secretReference: cell.secretReference ?? undefined,
    backupReference: cell.backupReference ?? undefined,
    applicationReference: cell.applicationReference ?? undefined,
    applicationUrl: cell.applicationUrl ?? undefined,
    signalLoopWorkspaceReference: cell.signalLoopWorkspaceReference ?? undefined
  };
}

function mapDelivery(delivery: {
  id: string; cellId: string; version: number; type: string; correlationId: string; idempotencyKey: string;
  issuedAt: Date; payload: unknown; status: string; attempts: number; lastAttemptAt: Date | null;
  deliveredAt: Date | null; lastError: string | null; createdAt: Date; updatedAt: Date;
}): ControlProjectionDeliveryRecord {
  return {
    ...delivery,
    type: delivery.type as ControlProjectionDeliveryRecord["type"],
    payload: delivery.payload as Record<string, unknown>,
    status: delivery.status as ControlProjectionDeliveryRecord["status"],
    lastAttemptAt: delivery.lastAttemptAt ?? undefined,
    deliveredAt: delivery.deliveredAt ?? undefined,
    lastError: delivery.lastError ?? undefined
  };
}
