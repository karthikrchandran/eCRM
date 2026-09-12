import { Prisma, type PrismaClient } from "@prisma/client";

import type {
  CellControlAuditRecord,
  CellControlProjectionEnvelope,
  CellControlProjectionRepository,
  CellControlRecord,
  CellSupportGrantRecord,
  ProjectedLifecycleStatus
} from "./projection";
import { CellControlProjectionError } from "./projection";

export class PrismaCellControlProjectionRepository implements CellControlProjectionRepository {
  public constructor(private readonly client: PrismaClient) {}

  public async getControl(cellId: string): Promise<CellControlRecord | undefined> {
    const record = await this.client.cellControlProjection.findUnique({ where: { cellId } });
    return record ? { ...record, lifecycleStatus: record.lifecycleStatus as ProjectedLifecycleStatus } : undefined;
  }

  public async getGrant(grantId: string): Promise<CellSupportGrantRecord | undefined> {
    const grant = await this.client.cellSupportGrantProjection.findUnique({ where: { id: grantId } });
    return grant ? { ...grant, revokedAt: grant.revokedAt ?? undefined } : undefined;
  }

  public async hasIdempotencyKey(idempotencyKey: string): Promise<boolean> {
    return Boolean(await this.client.cellControlProjectionEvent.findUnique({ where: { idempotencyKey }, select: { id: true } }));
  }

  public async applyProjection(
    envelope: CellControlProjectionEnvelope,
    appliedAt: Date,
    audit: CellControlAuditRecord
  ): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      const prior = await transaction.cellControlProjectionEvent.findUnique({
        where: { idempotencyKey: envelope.idempotencyKey }, select: { id: true }
      });
      if (prior) return;
      const previousVersion = envelope.version - 1;
      if (envelope.type === "LIFECYCLE") {
        const payload = lifecyclePayload(envelope.payload);
        if (previousVersion === 0) {
          await transaction.cellControlProjection.create({ data: {
            cellId: envelope.cellId, lifecycleStatus: payload.lifecycleStatus, version: envelope.version,
            appliedAt, sourceEventId: payload.sourceEventId, sourceIdempotencyKey: envelope.idempotencyKey
          }});
        } else {
          const updated = await transaction.cellControlProjection.updateMany({
            where: { cellId: envelope.cellId, version: previousVersion },
            data: {
              lifecycleStatus: payload.lifecycleStatus, version: envelope.version, appliedAt,
              sourceEventId: payload.sourceEventId, sourceIdempotencyKey: envelope.idempotencyKey
            }
          });
          if (updated.count !== 1) throw new CellControlProjectionError("Control projection is out of order");
        }
      } else {
        const updated = await transaction.cellControlProjection.updateMany({
          where: { cellId: envelope.cellId, version: previousVersion },
          data: {
            version: envelope.version, appliedAt, sourceEventId: envelope.type,
            sourceIdempotencyKey: envelope.idempotencyKey
          }
        });
        if (updated.count !== 1) throw new CellControlProjectionError("Control projection is out of order");
        const payload = envelope.payload;
        if (payload.operation === "UPSERT") {
          const grant = grantPayload(payload.grant);
          if (grant.cellId !== envelope.cellId) throw new CellControlProjectionError("Grant cell identity does not match projection");
          await transaction.cellSupportGrantProjection.upsert({
            where: { id: grant.id },
            create: { ...grant, revokedAt: null, projectionVersion: envelope.version, appliedAt },
            update: { ...grant, revokedAt: null, projectionVersion: envelope.version, appliedAt }
          });
        } else if (payload.operation === "REVOKE") {
          const grantId = requiredString(payload.grantId, "grantId");
          const revokedAt = requiredDate(payload.revokedAt, "revokedAt");
          const revoked = await transaction.cellSupportGrantProjection.updateMany({
            where: { id: grantId, cellId: envelope.cellId },
            data: { revokedAt, projectionVersion: envelope.version, appliedAt }
          });
          if (revoked.count !== 1) throw new CellControlProjectionError("Projected support grant was not found");
        } else {
          throw new CellControlProjectionError("Invalid support grant projection operation");
        }
      }
      await transaction.cellControlProjectionEvent.create({ data: {
        cellId: envelope.cellId, version: envelope.version, type: envelope.type,
        correlationId: envelope.correlationId, idempotencyKey: envelope.idempotencyKey,
        issuedAt: new Date(envelope.issuedAt), appliedAt, payload: envelope.payload as Prisma.InputJsonValue
      }});
      await transaction.cellAuditEvent.create({ data: auditData(audit) });
    });
  }

  public async appendAudit(audit: CellControlAuditRecord): Promise<void> {
    await this.client.cellAuditEvent.create({ data: auditData(audit) });
  }
}

function auditData(audit: CellControlAuditRecord) {
  return {
    id: audit.id,
    actorId: "platform-control",
    action: audit.action,
    targetType: audit.targetType,
    targetId: audit.targetId,
    correlationId: audit.correlationId,
    reason: audit.reason,
    result: audit.result,
    error: audit.error,
    occurredAt: audit.occurredAt
  };
}

function lifecyclePayload(payload: Record<string, unknown>) {
  const lifecycleStatus = payload.lifecycleStatus;
  if (!["ACTIVE", "SUSPENDED", "OFFBOARDING", "DELETED"].includes(String(lifecycleStatus))) {
    throw new CellControlProjectionError("Invalid projected lifecycle status");
  }
  return {
    lifecycleStatus: lifecycleStatus as ProjectedLifecycleStatus,
    sourceEventId: requiredString(payload.sourceEventId, "sourceEventId")
  };
}

function grantPayload(value: unknown) {
  if (!value || typeof value !== "object") throw new CellControlProjectionError("Invalid support grant projection");
  const grant = value as Record<string, unknown>;
  if (!Array.isArray(grant.capabilities) || grant.capabilities.some((item) => typeof item !== "string")) {
    throw new CellControlProjectionError("Invalid support grant capabilities");
  }
  return {
    id: requiredString(grant.id, "id"), cellId: requiredString(grant.cellId, "cellId"),
    operatorId: requiredString(grant.operatorId, "operatorId"), caseReference: requiredString(grant.caseReference, "caseReference"),
    capabilities: grant.capabilities as string[], startsAt: requiredDate(grant.startsAt, "startsAt"),
    expiresAt: requiredDate(grant.expiresAt, "expiresAt")
  };
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new CellControlProjectionError(`Invalid ${field}`);
  return value;
}

function requiredDate(value: unknown, field: string): Date {
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) throw new CellControlProjectionError(`Invalid ${field}`);
  return date;
}
