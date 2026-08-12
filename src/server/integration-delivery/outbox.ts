import { randomUUID } from "node:crypto";

export type OutboxStatus = "PENDING" | "CLAIMED" | "FAILED" | "DELIVERED" | "DEAD_LETTER";
export type OutboxInput = {
  cellId: string;
  eventType: string;
  payloadVersion: number;
  payload: Record<string, unknown>;
  correlationId: string;
  idempotencyKey: string;
  destinationInstallation: string;
};
export type OutboxRecord = OutboxInput & {
  id: string;
  status: OutboxStatus;
  attempts: number;
  leaseOwner: string | null;
  leaseUntil: Date | null;
  fenceToken: string | null;
  nextAttemptAt: Date;
  lastError: string | null;
  errorCode: string | null;
  acknowledgementId: string | null;
  destinationCheckpoint: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DeliveryAudit = {
  id: string; actorId: string; action: string; targetId: string; correlationId: string;
  reason: string; result: "SUCCEEDED" | "FAILED"; error?: string; occurredAt: Date;
};
export type RepairCandidate = {
  id: string; cellId: string; destinationInstallation: string; sourceCount: number; destinationCount: number;
  sourceCheckpoint: string | null; destinationCheckpoint: string | null; status: "OPEN"; correlationId: string;
  reason: string; createdAt: Date;
};
export type DeliveryStatus = {
  pending: number; claimed: number; failed: number; delivered: number; deadLetter: number;
  sourceCount: number; checkpoint: string | null; degraded: boolean;
};

export interface SourceMutationTransaction {
  writeSource(id: string, value: Record<string, unknown>): Promise<void>;
  enqueue(input: OutboxInput): Promise<OutboxRecord>;
}

export interface IntegrationDeliveryRepository {
  enqueue(input: OutboxInput): Promise<OutboxRecord>;
  withSourceMutation?<T>(operation: (transaction: SourceMutationTransaction) => Promise<T>): Promise<T>;
  claim(cellId: string, workerId: string, now: Date, leaseMs: number): Promise<OutboxRecord | undefined>;
  heartbeat(id: string, fenceToken: string, now: Date, leaseMs: number): Promise<OutboxRecord>;
  ack(id: string, fenceToken: string, now: Date, acknowledgementId?: string, checkpoint?: string): Promise<void>;
  fail(id: string, fenceToken: string, now: Date, nextAttemptAt: Date, error: string, errorCode: string, maxAttempts: number): Promise<void>;
  replay(id: string, actorId: string, reason: string, now: Date): Promise<void>;
  status(cellId: string): Promise<DeliveryStatus>;
  deadLetters(cellId: string): Promise<OutboxRecord[]>;
  auditEvents(): Promise<DeliveryAudit[]>;
  sourceState(cellId: string): Promise<{ count: number; checkpoint: string | null }>;
  saveReconciliation(cellId: string, destinationInstallation: string, source: { count: number; checkpoint: string | null }, destination: { count: number; checkpoint: string | null }, reconciledAt: Date): Promise<void>;
  saveRepairCandidate(candidate: RepairCandidate, audit: DeliveryAudit): Promise<void>;
  repairCandidates(cellId: string): Promise<RepairCandidate[]>;
}

export interface DestinationProvider {
  deliver(destinationInstallation: string, message: { eventType: string; payloadVersion: number; payload: Record<string, unknown>; correlationId: string; idempotencyKey: string }): Promise<{ acknowledgementId: string; checkpoint?: string }>;
  reconcileIdempotency(destinationInstallation: string, idempotencyKey: string): Promise<{ acknowledgementId: string; checkpoint?: string } | undefined>;
  checkpoint(destinationInstallation: string): Promise<{ count: number; checkpoint: string | null }>;
}

export class CellIntegrationDeliveryService {
  public constructor(
    private readonly repository: IntegrationDeliveryRepository,
    private readonly provider: DestinationProvider,
    private readonly options: { now?: () => Date; random?: () => number; maxAttempts: number; baseDelayMs: number; maxDelayMs: number; leaseMs: number }
  ) {}

  public async runOnce(cellId: string, workerId: string, at?: Date): Promise<boolean> {
    const now = at ?? this.options.now?.() ?? new Date();
    const record = await this.repository.claim(cellId, workerId, now, this.options.leaseMs);
    if (!record || !record.fenceToken) return false;
    try {
      let acknowledgement: { acknowledgementId: string; checkpoint?: string } | undefined;
      if (record.errorCode === "AMBIGUOUS_ACK") {
        acknowledgement = await this.provider.reconcileIdempotency(record.destinationInstallation, record.idempotencyKey);
      }
      acknowledgement ??= await this.provider.deliver(record.destinationInstallation, {
        eventType: record.eventType, payloadVersion: record.payloadVersion, payload: record.payload,
        correlationId: record.correlationId, idempotencyKey: record.idempotencyKey
      });
      await this.repository.ack(record.id, record.fenceToken, now, acknowledgement.acknowledgementId, acknowledgement.checkpoint);
    } catch (error) {
      const typed = error as Error & { code?: string };
      if (typed.code === "AMBIGUOUS_ACK") {
        const reconciled = await this.provider.reconcileIdempotency(record.destinationInstallation, record.idempotencyKey);
        if (reconciled) {
          await this.repository.ack(record.id, record.fenceToken, now, reconciled.acknowledgementId, reconciled.checkpoint);
          return true;
        }
      }
      const attempt = record.attempts + 1;
      const exponential = Math.min(this.options.maxDelayMs, this.options.baseDelayMs * 2 ** Math.max(0, attempt - 1));
      const jitter = Math.floor(exponential * 0.2 * (this.options.random?.() ?? Math.random()));
      await this.repository.fail(
        record.id, record.fenceToken, now, new Date(now.getTime() + exponential + jitter),
        typed.message.slice(0, 500), typed.code ?? "DELIVERY_FAILED", this.options.maxAttempts
      );
    }
    return true;
  }
}

export function createInMemoryIntegrationDeliveryRepository(): IntegrationDeliveryRepository {
  let records = new Map<string, OutboxRecord>();
  let sources = new Map<string, Record<string, unknown>>();
  const audits: DeliveryAudit[] = [];
  const repairs: RepairCandidate[] = [];
  let checkpoint: string | null = null;
  let lock = Promise.resolve();
  const exclusive = async <T>(operation: () => Promise<T>): Promise<T> => {
    const result = lock.then(operation, operation);
    lock = result.then(() => undefined, () => undefined);
    return result;
  };
  const clone = (record: OutboxRecord): OutboxRecord => structuredClone(record);
  const insert = async (input: OutboxInput, into = records): Promise<OutboxRecord> => {
    const duplicate = [...into.values()].find((record) => record.cellId === input.cellId && record.idempotencyKey === input.idempotencyKey && record.destinationInstallation === input.destinationInstallation);
    if (duplicate) return clone(duplicate);
    const at = new Date();
    const record: OutboxRecord = {
      ...structuredClone(input), id: `outbox_${randomUUID()}`, status: "PENDING", attempts: 0,
      leaseOwner: null, leaseUntil: null, fenceToken: null, nextAttemptAt: new Date(0), lastError: null,
      errorCode: null, acknowledgementId: null, destinationCheckpoint: null, createdAt: at, updatedAt: at
    };
    into.set(record.id, record);
    return clone(record);
  };
  return {
    enqueue: insert,
    withSourceMutation: async (operation) => exclusive(async () => {
      const pendingRecords = new Map([...records].map(([id, record]) => [id, clone(record)]));
      const pendingSources = structuredClone(sources);
      const result = await operation({
        writeSource: async (id, value) => { pendingSources.set(id, structuredClone(value)); },
        enqueue: (input) => insert(input, pendingRecords)
      });
      records = pendingRecords;
      sources = pendingSources;
      return result;
    }),
    claim: async (cellId, workerId, now, leaseMs) => exclusive(async () => {
      const due = [...records.values()]
        .filter((record) => record.cellId === cellId && ["PENDING", "FAILED", "CLAIMED"].includes(record.status)
          && record.nextAttemptAt <= now && (record.status !== "CLAIMED" || !record.leaseUntil || record.leaseUntil <= now))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
      if (!due) return undefined;
      const claimed = { ...due, status: "CLAIMED" as const, leaseOwner: workerId, leaseUntil: new Date(now.getTime() + leaseMs), fenceToken: randomUUID(), updatedAt: now };
      records.set(due.id, claimed);
      return clone(claimed);
    }),
    heartbeat: async (id, fenceToken, now, leaseMs) => exclusive(async () => {
      const record = records.get(id);
      if (!record || record.status !== "CLAIMED" || record.fenceToken !== fenceToken || !record.leaseUntil || record.leaseUntil < now) throw new Error("Lease fence rejected");
      const updated = { ...record, fenceToken: randomUUID(), leaseUntil: new Date(now.getTime() + leaseMs), updatedAt: now };
      records.set(id, updated);
      return clone(updated);
    }),
    ack: async (id, fenceToken, now, acknowledgementId = "ack", destinationCheckpoint) => exclusive(async () => {
      const record = records.get(id);
      if (!record || record.status !== "CLAIMED" || record.fenceToken !== fenceToken) throw new Error("Lease fence rejected");
      records.set(id, { ...record, status: "DELIVERED", acknowledgementId, destinationCheckpoint: destinationCheckpoint ?? null, leaseOwner: null, leaseUntil: null, fenceToken: null, updatedAt: now });
      checkpoint = destinationCheckpoint ?? checkpoint;
    }),
    fail: async (id, fenceToken, now, nextAttemptAt, error, errorCode, maxAttempts) => exclusive(async () => {
      const record = records.get(id);
      if (!record || record.status !== "CLAIMED" || record.fenceToken !== fenceToken) throw new Error("Lease fence rejected");
      const attempts = record.attempts + 1;
      const status = attempts >= maxAttempts ? "DEAD_LETTER" as const : "FAILED" as const;
      records.set(id, { ...record, status, attempts, nextAttemptAt, lastError: error, errorCode, leaseOwner: null, leaseUntil: null, fenceToken: null, updatedAt: now });
      if (status === "DEAD_LETTER") audits.push({
        id: `audit_${randomUUID()}`, actorId: "integration-worker", action: "integration-outbox.dead-letter",
        targetId: id, correlationId: record.correlationId, reason: "Maximum delivery attempts exhausted",
        result: "FAILED", error: errorCode, occurredAt: now
      });
    }),
    replay: async (id, actorId, reason, now) => exclusive(async () => {
      if (!reason.trim()) throw new Error("Replay reason is required");
      const record = records.get(id);
      if (!record || record.status !== "DEAD_LETTER") throw new Error("Dead letter not found");
      records.set(id, { ...record, status: "PENDING", attempts: 0, nextAttemptAt: now, lastError: null, errorCode: null, updatedAt: now });
      audits.push({ id: `audit_${randomUUID()}`, actorId, action: "integration-outbox.replay", targetId: id, correlationId: record.correlationId, reason, result: "SUCCEEDED", occurredAt: now });
    }),
    status: async (cellId) => {
      const scoped = [...records.values()].filter((record) => record.cellId === cellId);
      const count = (status: OutboxStatus) => scoped.filter((record) => record.status === status).length;
      const deadLetter = count("DEAD_LETTER");
      return { pending: count("PENDING"), claimed: count("CLAIMED"), failed: count("FAILED"), delivered: count("DELIVERED"), deadLetter, sourceCount: sources.size, checkpoint, degraded: deadLetter > 0 || count("FAILED") > 0 };
    },
    deadLetters: async (cellId) => [...records.values()].filter((record) => record.cellId === cellId && record.status === "DEAD_LETTER").map(clone),
    auditEvents: async () => structuredClone(audits),
    sourceState: async () => ({ count: sources.size, checkpoint: sources.size ? `source:${sources.size}` : null }),
    saveReconciliation: async (_cellId, _destinationInstallation, source, destination) => {
      checkpoint = destination.checkpoint ?? checkpoint;
      void source;
    },
    saveRepairCandidate: async (candidate, audit) => { repairs.push(structuredClone(candidate)); audits.push(structuredClone(audit)); },
    repairCandidates: async (cellId) => repairs.filter((candidate) => candidate.cellId === cellId).map((candidate) => structuredClone(candidate))
  };
}
