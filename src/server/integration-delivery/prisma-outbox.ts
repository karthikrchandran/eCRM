import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";

import type {
  DeliveryAudit,
  DeliveryStatus,
  IntegrationDeliveryRepository,
  OutboxInput,
  OutboxRecord,
  RepairCandidate
} from "./outbox";

export class PrismaIntegrationDeliveryRepository implements IntegrationDeliveryRepository {
  public constructor(private readonly client: PrismaClient) {}

  public async enqueue(input: OutboxInput): Promise<OutboxRecord> {
    return mapOutbox(await this.client.cellIntegrationOutbox.upsert({
      where: { cellId_destinationInstallation_idempotencyKey: {
        cellId: input.cellId, destinationInstallation: input.destinationInstallation, idempotencyKey: input.idempotencyKey
      } },
      create: { ...input, payload: input.payload as Prisma.InputJsonValue },
      update: {}
    }));
  }

  public async claim(cellId: string, workerId: string, now: Date, leaseMs: number): Promise<OutboxRecord | undefined> {
    return this.client.$transaction(async (transaction) => {
      const candidate = await transaction.cellIntegrationOutbox.findFirst({
        where: {
          cellId,
          nextAttemptAt: { lte: now },
          OR: [
            { status: { in: ["PENDING", "FAILED"] } },
            { status: "CLAIMED", leaseUntil: { lte: now } }
          ]
        },
        orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }]
      });
      if (!candidate) return undefined;
      const fenceToken = randomUUID();
      const changed = await transaction.cellIntegrationOutbox.updateMany({
        where: { id: candidate.id, updatedAt: candidate.updatedAt, status: candidate.status },
        data: { status: "CLAIMED", leaseOwner: workerId, leaseUntil: new Date(now.getTime() + leaseMs), fenceToken }
      });
      if (changed.count !== 1) return undefined;
      const claimed = await transaction.cellIntegrationOutbox.findUniqueOrThrow({ where: { id: candidate.id } });
      await transaction.cellIntegrationDeliveryAttempt.create({ data: {
        outboxId: candidate.id, attemptNumber: candidate.attempts + 1, workerId, fenceToken, startedAt: now, result: "CLAIMED"
      } });
      return mapOutbox(claimed);
    });
  }

  public async heartbeat(id: string, fenceToken: string, now: Date, leaseMs: number): Promise<OutboxRecord> {
    const nextFence = randomUUID();
    const changed = await this.client.cellIntegrationOutbox.updateMany({
      where: { id, status: "CLAIMED", fenceToken, leaseUntil: { gte: now } },
      data: { fenceToken: nextFence, leaseUntil: new Date(now.getTime() + leaseMs) }
    });
    if (changed.count !== 1) throw new Error("Lease fence rejected");
    return mapOutbox(await this.client.cellIntegrationOutbox.findUniqueOrThrow({ where: { id } }));
  }

  public async ack(id: string, fenceToken: string, now: Date, acknowledgementId = "ack", checkpoint?: string): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      const current = await transaction.cellIntegrationOutbox.findUnique({ where: { id } });
      if (!current || current.status !== "CLAIMED" || current.fenceToken !== fenceToken) throw new Error("Lease fence rejected");
      await transaction.cellIntegrationOutbox.update({ where: { id }, data: {
        status: "DELIVERED", acknowledgementId, destinationCheckpoint: checkpoint,
        leaseOwner: null, leaseUntil: null, fenceToken: null, lastError: null, errorCode: null
      } });
      await transaction.cellIntegrationDeliveryAttempt.update({
        where: { outboxId_attemptNumber: { outboxId: id, attemptNumber: current.attempts + 1 } },
        data: { result: "DELIVERED", completedAt: now, acknowledgementId }
      });
    });
  }

  public async fail(id: string, fenceToken: string, now: Date, nextAttemptAt: Date, error: string, errorCode: string, maxAttempts: number): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      const current = await transaction.cellIntegrationOutbox.findUnique({ where: { id } });
      if (!current || current.status !== "CLAIMED" || current.fenceToken !== fenceToken) throw new Error("Lease fence rejected");
      const attempts = current.attempts + 1;
      const dead = attempts >= maxAttempts;
      await transaction.cellIntegrationOutbox.update({ where: { id }, data: {
        status: dead ? "DEAD_LETTER" : "FAILED", attempts, nextAttemptAt, lastError: error, errorCode,
        leaseOwner: null, leaseUntil: null, fenceToken: null
      } });
      await transaction.cellIntegrationDeliveryAttempt.update({
        where: { outboxId_attemptNumber: { outboxId: id, attemptNumber: attempts } },
        data: { result: dead ? "DEAD_LETTER" : "FAILED", completedAt: now, errorCode, errorMessage: error }
      });
      if (dead) await transaction.cellAuditEvent.create({ data: auditData({
        id: `audit_${randomUUID()}`, actorId: "integration-worker", action: "integration-outbox.dead-letter",
        targetId: id, correlationId: current.correlationId, reason: "Maximum delivery attempts exhausted",
        result: "FAILED", error: errorCode, occurredAt: now
      }) });
    });
  }

  public async replay(id: string, actorId: string, reason: string, now: Date): Promise<void> {
    if (!reason.trim()) throw new Error("Replay reason is required");
    await this.client.$transaction(async (transaction) => {
      const record = await transaction.cellIntegrationOutbox.findUnique({ where: { id } });
      if (!record || record.status !== "DEAD_LETTER") throw new Error("Dead letter not found");
      await transaction.cellIntegrationOutbox.update({ where: { id }, data: {
        status: "PENDING", attempts: 0, nextAttemptAt: now, lastError: null, errorCode: null
      } });
      await transaction.cellIntegrationDeliveryAttempt.deleteMany({ where: { outboxId: id } });
      await transaction.cellAuditEvent.create({ data: auditData({
        id: `audit_${randomUUID()}`, actorId, action: "integration-outbox.replay", targetId: id,
        correlationId: record.correlationId, reason, result: "SUCCEEDED", occurredAt: now
      }) });
    });
  }

  public async status(cellId: string): Promise<DeliveryStatus> {
    const [groups, sourceCount, checkpoint] = await Promise.all([
      this.client.cellIntegrationOutbox.groupBy({ by: ["status"], where: { cellId }, _count: { _all: true } }),
      this.client.sharedBusinessRecord.count(),
      this.client.cellIntegrationProjectionCheckpoint.findFirst({ where: { cellId }, orderBy: { reconciledAt: "desc" } })
    ]);
    const count = (status: string) => groups.find((group) => group.status === status)?._count._all ?? 0;
    const failed = count("FAILED");
    const deadLetter = count("DEAD_LETTER");
    return { pending: count("PENDING"), claimed: count("CLAIMED"), failed, delivered: count("DELIVERED"), deadLetter, sourceCount, checkpoint: checkpoint?.destinationCheckpoint ?? null, degraded: failed > 0 || deadLetter > 0 };
  }

  public async deadLetters(cellId: string): Promise<OutboxRecord[]> {
    return (await this.client.cellIntegrationOutbox.findMany({ where: { cellId, status: "DEAD_LETTER" }, orderBy: { updatedAt: "desc" } })).map(mapOutbox);
  }

  public async auditEvents(): Promise<DeliveryAudit[]> {
    return (await this.client.cellAuditEvent.findMany({ where: { action: { startsWith: "integration-" } }, orderBy: { occurredAt: "asc" } })).map((event) => ({
      id: event.id, actorId: event.actorId, action: event.action, targetId: event.targetId,
      correlationId: event.correlationId, reason: event.reason, result: event.result as "SUCCEEDED" | "FAILED",
      error: event.error ?? undefined, occurredAt: event.occurredAt
    }));
  }

  public async sourceState(cellId: string): Promise<{ count: number; checkpoint: string | null }> {
    void cellId;
    const [count, latest] = await Promise.all([
      this.client.sharedBusinessRecord.count(),
      this.client.sharedBusinessRecord.aggregate({ _max: { updatedAt: true } })
    ]);
    return { count, checkpoint: latest._max.updatedAt?.toISOString() ?? null };
  }

  public async saveReconciliation(cellId: string, destinationInstallation: string, source: { count: number; checkpoint: string | null }, destination: { count: number; checkpoint: string | null }, reconciledAt: Date): Promise<void> {
    await this.client.cellIntegrationProjectionCheckpoint.upsert({
      where: { cellId_destinationInstallation: { cellId, destinationInstallation } },
      create: { cellId, destinationInstallation, sourceCheckpoint: source.checkpoint, destinationCheckpoint: destination.checkpoint, sourceCount: source.count, destinationCount: destination.count, reconciledAt },
      update: { sourceCheckpoint: source.checkpoint, destinationCheckpoint: destination.checkpoint, sourceCount: source.count, destinationCount: destination.count, reconciledAt }
    });
  }

  public async saveRepairCandidate(candidate: RepairCandidate, audit: DeliveryAudit): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      await transaction.cellIntegrationRepairCandidate.create({ data: candidate });
      await transaction.cellAuditEvent.create({ data: auditData(audit) });
    });
  }

  public async repairCandidates(cellId: string): Promise<RepairCandidate[]> {
    return (await this.client.cellIntegrationRepairCandidate.findMany({ where: { cellId }, orderBy: { createdAt: "desc" } })).map((candidate) => ({
      ...candidate, status: candidate.status as "OPEN"
    }));
  }
}

function mapOutbox(record: {
  id: string; cellId: string; eventType: string; payloadVersion: number; payload: unknown; correlationId: string;
  idempotencyKey: string; destinationInstallation: string; status: string; attempts: number; leaseOwner: string | null;
  leaseUntil: Date | null; fenceToken: string | null; nextAttemptAt: Date; lastError: string | null; errorCode: string | null;
  acknowledgementId: string | null; destinationCheckpoint: string | null; createdAt: Date; updatedAt: Date;
}): OutboxRecord {
  return { ...record, payload: record.payload as Record<string, unknown>, status: record.status as OutboxRecord["status"] };
}

function auditData(audit: DeliveryAudit): Prisma.CellAuditEventUncheckedCreateInput {
  return {
    id: audit.id, actorId: audit.actorId, action: audit.action, targetType: "CellIntegrationOutbox", targetId: audit.targetId,
    correlationId: audit.correlationId, reason: audit.reason, before: Prisma.DbNull, after: Prisma.DbNull,
    result: audit.result, error: audit.error, occurredAt: audit.occurredAt
  };
}
