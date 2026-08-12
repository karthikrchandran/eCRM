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
import type { CircuitOptions, CircuitPermit, ProjectionState, ProjectionStream } from "./outbox";

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
      const previousAttempts = await transaction.cellIntegrationDeliveryAttempt.count({ where: { outboxId: candidate.id } });
      await transaction.cellIntegrationDeliveryAttempt.create({ data: {
        outboxId: candidate.id, attemptNumber: previousAttempts + 1, workerId, fenceToken, startedAt: now, result: "CLAIMED"
      } });
      return mapOutbox(claimed);
    });
  }

  public async heartbeat(id: string, fenceToken: string, now: Date, leaseMs: number): Promise<OutboxRecord> {
    const nextFence = randomUUID();
    return this.client.$transaction(async (transaction) => {
      const changed = await transaction.cellIntegrationOutbox.updateMany({
        where: { id, status: "CLAIMED", fenceToken, leaseUntil: { gte: now } },
        data: { fenceToken: nextFence, leaseUntil: new Date(now.getTime() + leaseMs) }
      });
      if (changed.count !== 1) throw new Error("Lease fence rejected");
      const attempt = await transaction.cellIntegrationDeliveryAttempt.updateMany({
        where: { outboxId: id, fenceToken, completedAt: null },
        data: { fenceToken: nextFence }
      });
      if (attempt.count !== 1) throw new Error("Delivery attempt fence rejected");
      return mapOutbox(await transaction.cellIntegrationOutbox.findUniqueOrThrow({ where: { id } }));
    });
  }

  public async ack(id: string, fenceToken: string, now: Date, acknowledgementId = "ack", checkpoint?: string): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      const current = await transaction.cellIntegrationOutbox.findUnique({ where: { id } });
      if (!current || current.status !== "CLAIMED" || current.fenceToken !== fenceToken) throw new Error("Lease fence rejected");
      await transaction.cellIntegrationOutbox.update({ where: { id }, data: {
        status: "DELIVERED", acknowledgementId, destinationCheckpoint: checkpoint,
        leaseOwner: null, leaseUntil: null, fenceToken: null, lastError: null, errorCode: null
      } });
      const attempt = await transaction.cellIntegrationDeliveryAttempt.findFirstOrThrow({ where: { outboxId: id, fenceToken, completedAt: null } });
      await transaction.cellIntegrationDeliveryAttempt.update({
        where: { id: attempt.id },
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
      const attempt = await transaction.cellIntegrationDeliveryAttempt.findFirstOrThrow({ where: { outboxId: id, fenceToken, completedAt: null } });
      await transaction.cellIntegrationDeliveryAttempt.update({
        where: { id: attempt.id },
        data: { result: dead ? "DEAD_LETTER" : "FAILED", completedAt: now, errorCode, errorMessage: error }
      });
      if (dead) await transaction.cellAuditEvent.create({ data: auditData({
        id: `audit_${randomUUID()}`, actorId: "integration-worker", action: "integration-outbox.dead-letter",
        targetId: id, correlationId: current.correlationId, reason: "Maximum delivery attempts exhausted",
        result: "FAILED", error: errorCode, occurredAt: now
      }) });
    });
  }

  public async defer(id: string, fenceToken: string, nextAttemptAt: Date, now: Date, reason: string): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      const changed = await transaction.cellIntegrationOutbox.updateMany({
        where: { id, status: "CLAIMED", fenceToken },
        data: { status: "PENDING", nextAttemptAt, leaseOwner: null, leaseUntil: null, fenceToken: null }
      });
      if (changed.count !== 1) throw new Error("Lease fence rejected");
      const attempt = await transaction.cellIntegrationDeliveryAttempt.updateMany({
        where: { outboxId: id, fenceToken, completedAt: null },
        data: { result: "DEFERRED", completedAt: now, errorCode: "CIRCUIT_OPEN", errorMessage: reason }
      });
      if (attempt.count !== 1) throw new Error("Delivery attempt fence rejected");
    });
  }

  public async replay(cellId: string, id: string, actorId: string, reason: string, now: Date): Promise<void> {
    if (!reason.trim()) throw new Error("Replay reason is required");
    await this.client.$transaction(async (transaction) => {
      const record = await transaction.cellIntegrationOutbox.findFirst({ where: { id, cellId, status: "DEAD_LETTER" } });
      if (!record) throw new Error("Dead letter not found");
      const changed = await transaction.cellIntegrationOutbox.updateMany({ where: { id, cellId, status: "DEAD_LETTER" }, data: {
        status: "PENDING", attempts: 0, nextAttemptAt: now, lastError: null, errorCode: null
      } });
      if (changed.count !== 1) throw new Error("Dead letter not found");
      await transaction.cellAuditEvent.create({ data: auditData({
        id: `audit_${randomUUID()}`, actorId, action: "integration-outbox.replay", targetId: id,
        correlationId: record.correlationId, reason, result: "SUCCEEDED", occurredAt: now
      }) });
    });
  }

  public async status(cellId: string): Promise<DeliveryStatus> {
    const [groups, sourceCount, checkpoint, circuits] = await Promise.all([
      this.client.cellIntegrationOutbox.groupBy({ by: ["status"], where: { cellId }, _count: { _all: true } }),
      this.client.sharedBusinessRecord.count(),
      this.client.cellIntegrationProjectionCheckpoint.findFirst({ where: { cellId, stream: "SHARED_RECORD" }, orderBy: { reconciledAt: "desc" } }),
      this.client.cellIntegrationCircuitBreaker.findMany({ where: { cellId }, orderBy: { destinationInstallation: "asc" } })
    ]);
    const count = (status: string) => groups.find((group) => group.status === status)?._count._all ?? 0;
    const failed = count("FAILED");
    const deadLetter = count("DEAD_LETTER");
    return { pending: count("PENDING"), claimed: count("CLAIMED"), failed, delivered: count("DELIVERED"), deadLetter, sourceCount, checkpoint: checkpoint?.destinationCheckpoint ?? null, degraded: failed > 0 || deadLetter > 0 || circuits.some((circuit) => circuit.state !== "CLOSED"), circuits };
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

  public async sourceState(cellId: string, stream: ProjectionStream): Promise<ProjectionState> {
    void cellId;
    if (stream === "WORKFLOW_EVENT") {
      const count = await this.client.workflowEvent.count();
      return { count, version: count, checkpoint: count ? `source:${stream}:${count}:${count}` : null };
    }
    const [count, aggregate] = await Promise.all([this.client.sharedBusinessRecord.count(), this.client.sharedBusinessRecord.aggregate({ _sum: { headVersion: true } })]);
    const version = aggregate._sum.headVersion ?? 0;
    return { count, version, checkpoint: count ? `source:${stream}:${count}:${version}` : null };
  }

  public async saveReconciliation(cellId: string, destinationInstallation: string, stream: ProjectionStream, source: ProjectionState, destination: ProjectionState, reconciledAt: Date): Promise<void> {
    await this.client.cellIntegrationProjectionCheckpoint.upsert({
      where: { cellId_destinationInstallation_stream: { cellId, destinationInstallation, stream } },
      create: { cellId, destinationInstallation, stream, sourceCheckpoint: source.checkpoint, destinationCheckpoint: destination.checkpoint, sourceCount: source.count, destinationCount: destination.count, sourceVersion: source.version, destinationVersion: destination.version, reconciledAt },
      update: { sourceCheckpoint: source.checkpoint, destinationCheckpoint: destination.checkpoint, sourceCount: source.count, destinationCount: destination.count, sourceVersion: source.version, destinationVersion: destination.version, reconciledAt }
    });
  }

  public async saveRepairCandidate(candidate: RepairCandidate, audit: Omit<DeliveryAudit, "targetId">): Promise<RepairCandidate> {
    return this.client.$transaction(async (transaction) => {
      const existing = await transaction.cellIntegrationRepairCandidate.findFirst({ where: {
        cellId: candidate.cellId, destinationInstallation: candidate.destinationInstallation, stream: candidate.stream, status: "OPEN"
      } });
      const resolved = existing
        ? await transaction.cellIntegrationRepairCandidate.update({ where: { id: existing.id }, data: {
        sourceCheckpoint: candidate.sourceCheckpoint, destinationCheckpoint: candidate.destinationCheckpoint,
        sourceCount: candidate.sourceCount, destinationCount: candidate.destinationCount,
        sourceVersion: candidate.sourceVersion, destinationVersion: candidate.destinationVersion,
        correlationId: candidate.correlationId, reason: candidate.reason
      } })
        : await transaction.cellIntegrationRepairCandidate.create({ data: candidate });
      await transaction.cellAuditEvent.create({ data: auditData({ ...audit, targetId: resolved.id }) });
      return { ...resolved, status: resolved.status as RepairCandidate["status"] };
    });
  }

  public async resolveRepairCandidates(cellId: string, destinationInstallation: string, stream: ProjectionStream, audit: DeliveryAudit): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      const changed = await transaction.cellIntegrationRepairCandidate.updateMany({
        where: { cellId, destinationInstallation, stream, status: "OPEN" },
        data: { status: "RESOLVED", resolvedAt: audit.occurredAt, resolvedBy: audit.actorId, resolutionReason: audit.reason }
      });
      if (changed.count > 0) await transaction.cellAuditEvent.create({ data: auditData(audit) });
    });
  }

  public async repairCandidates(cellId: string): Promise<RepairCandidate[]> {
    return (await this.client.cellIntegrationRepairCandidate.findMany({ where: { cellId }, orderBy: { createdAt: "desc" } })).map((candidate) => ({
      ...candidate, status: candidate.status as RepairCandidate["status"]
    }));
  }


  public async acquireCircuitPermit(cellId: string, destinationInstallation: string, workerId: string, now: Date, probeLeaseMs: number): Promise<CircuitPermit> {
    return this.client.$transaction(async (transaction) => {
      const identity = { cellId_destinationInstallation: { cellId, destinationInstallation } };
      await transaction.cellIntegrationCircuitBreaker.upsert({ where: identity, create: { cellId, destinationInstallation }, update: {} });
      const circuit = await transaction.cellIntegrationCircuitBreaker.findUniqueOrThrow({ where: identity });
      if (circuit.state === "CLOSED") return { allowed: true, probe: false };
      if (circuit.state === "OPEN" && circuit.openUntil && circuit.openUntil > now) return { allowed: false, probe: false, deferUntil: circuit.openUntil };
      if (circuit.state === "HALF_OPEN" && circuit.probeLeaseUntil && circuit.probeLeaseUntil > now) return { allowed: false, probe: false, deferUntil: circuit.probeLeaseUntil };
      const probeFenceToken = randomUUID();
      const changed = await transaction.cellIntegrationCircuitBreaker.updateMany({
        where: { id: circuit.id, updatedAt: circuit.updatedAt },
        data: { state: "HALF_OPEN", probeLeaseOwner: workerId, probeLeaseUntil: new Date(now.getTime() + probeLeaseMs), probeFenceToken }
      });
      if (changed.count !== 1) return { allowed: false, probe: false, deferUntil: new Date(now.getTime() + probeLeaseMs) };
      await transaction.cellAuditEvent.create({ data: auditData({
        id: `audit_${randomUUID()}`, actorId: workerId, action: "integration-circuit.half-open", targetId: circuit.id,
        correlationId: probeFenceToken, reason: "Open interval elapsed; one probe leased", result: "SUCCEEDED", occurredAt: now
      }) });
      return { allowed: true, probe: true, probeFenceToken };
    });
  }

  public async recordCircuitSuccess(cellId: string, destinationInstallation: string, now: Date, probeFenceToken?: string): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      const current = await transaction.cellIntegrationCircuitBreaker.findUnique({ where: { cellId_destinationInstallation: { cellId, destinationInstallation } } });
      if (!current) return;
      if (current.state === "HALF_OPEN" && current.probeFenceToken !== probeFenceToken) throw new Error("Circuit probe fence rejected");
      await transaction.cellIntegrationCircuitBreaker.update({ where: { id: current.id }, data: { state: "CLOSED", failureCount: 0, windowStartedAt: null, openUntil: null, probeLeaseOwner: null, probeLeaseUntil: null, probeFenceToken: null } });
      if (current.state !== "CLOSED") await transaction.cellAuditEvent.create({ data: auditData(circuitAudit(current.id, "close", "Destination probe succeeded", "SUCCEEDED", now, probeFenceToken)) });
    });
  }

  public async recordCircuitFailure(cellId: string, destinationInstallation: string, now: Date, options: CircuitOptions, probeFenceToken?: string): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      const identity = { cellId_destinationInstallation: { cellId, destinationInstallation } };
      const current = await transaction.cellIntegrationCircuitBreaker.upsert({ where: identity, create: { cellId, destinationInstallation }, update: {} });
      if (current.state === "HALF_OPEN") {
        if (current.probeFenceToken !== probeFenceToken) throw new Error("Circuit probe fence rejected");
        await transaction.cellIntegrationCircuitBreaker.update({ where: { id: current.id }, data: { state: "OPEN", failureCount: Math.max(1, current.failureCount), lastFailureAt: now, openedAt: now, openUntil: new Date(now.getTime() + options.circuitOpenMs), probeLeaseOwner: null, probeLeaseUntil: null, probeFenceToken: null } });
        await transaction.cellAuditEvent.create({ data: auditData(circuitAudit(current.id, "reopen", "Half-open destination probe failed", "FAILED", now, probeFenceToken, "DESTINATION_FAILURE")) });
        return;
      }
      const insideWindow = Boolean(current.windowStartedAt && now.getTime() - current.windowStartedAt.getTime() <= options.failureWindowMs);
      const failureCount = insideWindow ? current.failureCount + 1 : 1;
      const opens = failureCount >= options.failureThreshold;
      await transaction.cellIntegrationCircuitBreaker.update({ where: { id: current.id }, data: { failureCount, windowStartedAt: insideWindow ? current.windowStartedAt : now, lastFailureAt: now, state: opens ? "OPEN" : "CLOSED", openedAt: opens ? now : current.openedAt, openUntil: opens ? new Date(now.getTime() + options.circuitOpenMs) : null } });
      if (opens) await transaction.cellAuditEvent.create({ data: auditData(circuitAudit(current.id, "open", "Destination failure threshold reached", "FAILED", now, undefined, "DESTINATION_FAILURE")) });
    });
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

function circuitAudit(targetId: string, verb: string, reason: string, result: "SUCCEEDED" | "FAILED", occurredAt: Date, correlationId?: string, error?: string): DeliveryAudit {
  return { id: `audit_${randomUUID()}`, actorId: "integration-worker", action: `integration-circuit.${verb}`, targetId, correlationId: correlationId ?? targetId, reason, result, error, occurredAt };
}
