import { randomUUID } from "node:crypto";

export type OutboxStatus = "PENDING" | "CLAIMED" | "FAILED" | "DELIVERED" | "DEAD_LETTER";
export type ProjectionStream = "SHARED_RECORD" | "WORKFLOW_EVENT";
export type ProjectionState = { count: number; version: number; checkpoint: string | null };
export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";
export type CircuitBreakerRecord = {
  id: string; cellId: string; destinationInstallation: string; state: CircuitState; failureCount: number;
  windowStartedAt: Date | null; lastFailureAt: Date | null; openedAt: Date | null; openUntil: Date | null;
  probeLeaseOwner: string | null; probeLeaseUntil: Date | null; probeFenceToken: string | null;
  createdAt: Date; updatedAt: Date;
};
export type CircuitOptions = { failureThreshold: number; failureWindowMs: number; circuitOpenMs: number };
export type CircuitPermit = { allowed: boolean; probe: boolean; probeFenceToken?: string; deferUntil?: Date };
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
  stream: ProjectionStream; sourceVersion: number; destinationVersion: number;
  sourceCheckpoint: string | null; destinationCheckpoint: string | null; status: "OPEN" | "RESOLVED" | "DISMISSED"; correlationId: string;
  reason: string; createdAt: Date; resolvedAt?: Date | null; resolvedBy?: string | null; resolutionReason?: string | null;
};
export type DeliveryStatus = {
  pending: number; claimed: number; failed: number; delivered: number; deadLetter: number;
  sourceCount: number; checkpoint: string | null; degraded: boolean; circuits: CircuitBreakerRecord[];
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
  defer(id: string, fenceToken: string, nextAttemptAt: Date, now: Date, reason: string): Promise<void>;
  replay(cellId: string, id: string, actorId: string, reason: string, now: Date): Promise<void>;
  status(cellId: string): Promise<DeliveryStatus>;
  deadLetters(cellId: string): Promise<OutboxRecord[]>;
  auditEvents(): Promise<DeliveryAudit[]>;
  sourceState(cellId: string, stream: ProjectionStream): Promise<ProjectionState>;
  saveReconciliation(cellId: string, destinationInstallation: string, stream: ProjectionStream, source: ProjectionState, destination: ProjectionState, reconciledAt: Date): Promise<void>;
  saveRepairCandidate(candidate: RepairCandidate, audit: Omit<DeliveryAudit, "targetId">): Promise<RepairCandidate>;
  resolveRepairCandidates(cellId: string, destinationInstallation: string, stream: ProjectionStream, audit: DeliveryAudit): Promise<void>;
  repairCandidates(cellId: string): Promise<RepairCandidate[]>;
  acquireCircuitPermit(cellId: string, destinationInstallation: string, workerId: string, now: Date, probeLeaseMs: number): Promise<CircuitPermit>;
  recordCircuitSuccess(cellId: string, destinationInstallation: string, now: Date, probeFenceToken?: string): Promise<void>;
  recordCircuitFailure(cellId: string, destinationInstallation: string, now: Date, options: CircuitOptions, probeFenceToken?: string): Promise<void>;
}

export interface DestinationProvider {
  deliver(destinationInstallation: string, message: { eventType: string; payloadVersion: number; payload: Record<string, unknown>; correlationId: string; idempotencyKey: string }, signal?: AbortSignal): Promise<{ acknowledgementId: string; checkpoint?: string }>;
  reconcileIdempotency(destinationInstallation: string, idempotencyKey: string, signal?: AbortSignal): Promise<{ acknowledgementId: string; checkpoint?: string } | undefined>;
  checkpoint(destinationInstallation: string, stream: ProjectionStream): Promise<ProjectionState>;
}

export class CellIntegrationDeliveryService {
  public constructor(
    private readonly repository: IntegrationDeliveryRepository,
    private readonly provider: DestinationProvider,
    private readonly options: { now?: () => Date; random?: () => number; maxAttempts: number; baseDelayMs: number; maxDelayMs: number; leaseMs: number; failureThreshold?: number; failureWindowMs?: number; circuitOpenMs?: number }
  ) {}

  public async runOnce(cellId: string, workerId: string, at?: Date): Promise<boolean> {
    const now = at ?? this.options.now?.() ?? new Date();
    const record = await this.repository.claim(cellId, workerId, now, this.options.leaseMs);
    if (!record || !record.fenceToken) return false;
    const permit = await this.repository.acquireCircuitPermit(cellId, record.destinationInstallation, workerId, now, this.options.leaseMs);
    if (!permit.allowed) {
      await this.repository.defer(
        record.id, record.fenceToken,
        permit.deferUntil ?? new Date(now.getTime() + (this.options.circuitOpenMs ?? 30_000)),
        now, "Destination circuit is open"
      );
      return true;
    }
    let fenceToken = record.fenceToken;
    let ownershipLost = false;
    let deadlineExpired = false;
    const controller = new AbortController();
    const heartbeatMs = Math.max(1, Math.floor(this.options.leaseMs / 3));
    let heartbeatWork = Promise.resolve();
    const heartbeatTimer = setInterval(() => {
      heartbeatWork = heartbeatWork.then(async () => {
        if (ownershipLost || deadlineExpired) return;
        try {
          const refreshed = await this.repository.heartbeat(record.id, fenceToken, this.options.now?.() ?? new Date(), this.options.leaseMs);
          if (!refreshed.fenceToken) throw new Error("Lease fence rejected");
          fenceToken = refreshed.fenceToken;
        } catch (error) {
          ownershipLost = true;
          clearInterval(heartbeatTimer);
          controller.abort(error);
        }
      });
    }, heartbeatMs);
    const deadlineTimer = setTimeout(() => {
      deadlineExpired = true;
      clearInterval(heartbeatTimer);
      controller.abort(Object.assign(new Error("Destination request deadline exceeded"), { code: "REQUEST_TIMEOUT" }));
    }, Math.max(1, this.options.leaseMs - heartbeatMs));
    const finishLeaseGuard = async () => {
      clearInterval(heartbeatTimer);
      clearTimeout(deadlineTimer);
      await heartbeatWork;
    };
    try {
      let acknowledgement: { acknowledgementId: string; checkpoint?: string } | undefined;
      if (record.errorCode === "AMBIGUOUS_ACK") {
        acknowledgement = await abortable(this.provider.reconcileIdempotency(record.destinationInstallation, record.idempotencyKey, controller.signal), controller.signal);
      }
      acknowledgement ??= await abortable(this.provider.deliver(record.destinationInstallation, {
        eventType: record.eventType, payloadVersion: record.payloadVersion, payload: record.payload,
        correlationId: record.correlationId, idempotencyKey: record.idempotencyKey
      }, controller.signal), controller.signal);
      await finishLeaseGuard();
      if (ownershipLost) return true;
      if (deadlineExpired) throw Object.assign(new Error("Destination request deadline exceeded"), { code: "REQUEST_TIMEOUT" });
      const completedAt = this.options.now?.() ?? at ?? new Date();
      await this.repository.ack(record.id, fenceToken, completedAt, acknowledgement.acknowledgementId, acknowledgement.checkpoint);
      await this.repository.recordCircuitSuccess(cellId, record.destinationInstallation, completedAt, permit.probeFenceToken);
    } catch (error) {
      let typed = error as Error & { code?: string };
      if (typed.code === "AMBIGUOUS_ACK" && !controller.signal.aborted) {
        try {
          const reconciled = await abortable(this.provider.reconcileIdempotency(record.destinationInstallation, record.idempotencyKey, controller.signal), controller.signal);
          if (reconciled) {
            await finishLeaseGuard();
            if (ownershipLost) return true;
            if (deadlineExpired) typed = controller.signal.reason as Error & { code?: string };
            else {
              const completedAt = this.options.now?.() ?? at ?? new Date();
              await this.repository.ack(record.id, fenceToken, completedAt, reconciled.acknowledgementId, reconciled.checkpoint);
              await this.repository.recordCircuitSuccess(cellId, record.destinationInstallation, completedAt, permit.probeFenceToken);
              return true;
            }
          }
        } catch (reconciliationError) {
          typed = reconciliationError as Error & { code?: string };
        }
      }
      await finishLeaseGuard();
      if (ownershipLost) return true;
      const attempt = record.attempts + 1;
      const exponential = Math.min(this.options.maxDelayMs, this.options.baseDelayMs * 2 ** Math.max(0, attempt - 1));
      const jitter = Math.floor(exponential * 0.2 * (this.options.random?.() ?? Math.random()));
      const completedAt = this.options.now?.() ?? at ?? new Date();
      await this.repository.fail(
        record.id, fenceToken, completedAt, new Date(completedAt.getTime() + exponential + jitter),
        typed.message.slice(0, 500), typed.code ?? "DELIVERY_FAILED", this.options.maxAttempts
      );
      await this.repository.recordCircuitFailure(cellId, record.destinationInstallation, completedAt, {
        failureThreshold: this.options.failureThreshold ?? 5,
        failureWindowMs: this.options.failureWindowMs ?? 60_000,
        circuitOpenMs: this.options.circuitOpenMs ?? 30_000
      }, permit.probeFenceToken);
    }
    return true;
  }
}

function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const aborted = () => reject(signal.reason);
    signal.addEventListener("abort", aborted, { once: true });
    operation.then(
      (value) => { signal.removeEventListener("abort", aborted); resolve(value); },
      (error) => { signal.removeEventListener("abort", aborted); reject(error); }
    );
  });
}

export function createInMemoryIntegrationDeliveryRepository(): IntegrationDeliveryRepository {
  let records = new Map<string, OutboxRecord>();
  let sources = new Map<string, Record<string, unknown>>();
  const audits: DeliveryAudit[] = [];
  const repairs: RepairCandidate[] = [];
  const circuits = new Map<string, CircuitBreakerRecord>();
  const checkpoints = new Map<string, string | null>();
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
      if (destinationCheckpoint) checkpoints.set(`${record.cellId}:SHARED_RECORD`, destinationCheckpoint);
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
    defer: async (id, fenceToken, nextAttemptAt, now) => exclusive(async () => {
      const record = records.get(id);
      if (!record || record.status !== "CLAIMED" || record.fenceToken !== fenceToken) throw new Error("Lease fence rejected");
      records.set(id, { ...record, status: "PENDING", nextAttemptAt, leaseOwner: null, leaseUntil: null, fenceToken: null, updatedAt: now });
    }),
    replay: async (cellId, id, actorId, reason, now) => exclusive(async () => {
      if (!reason.trim()) throw new Error("Replay reason is required");
      const record = records.get(id);
      if (!record || record.cellId !== cellId || record.status !== "DEAD_LETTER") throw new Error("Dead letter not found");
      records.set(id, { ...record, status: "PENDING", attempts: 0, nextAttemptAt: now, lastError: null, errorCode: null, updatedAt: now });
      audits.push({ id: `audit_${randomUUID()}`, actorId, action: "integration-outbox.replay", targetId: id, correlationId: record.correlationId, reason, result: "SUCCEEDED", occurredAt: now });
    }),
    status: async (cellId) => {
      const scoped = [...records.values()].filter((record) => record.cellId === cellId);
      const count = (status: OutboxStatus) => scoped.filter((record) => record.status === status).length;
      const deadLetter = count("DEAD_LETTER");
      const cellCircuits = [...circuits.values()].filter((circuit) => circuit.cellId === cellId).map((circuit) => structuredClone(circuit));
      return { pending: count("PENDING"), claimed: count("CLAIMED"), failed: count("FAILED"), delivered: count("DELIVERED"), deadLetter, sourceCount: sources.size, checkpoint: checkpoints.get(`${cellId}:SHARED_RECORD`) ?? null, degraded: deadLetter > 0 || count("FAILED") > 0 || cellCircuits.some((circuit) => circuit.state !== "CLOSED"), circuits: cellCircuits };
    },
    deadLetters: async (cellId) => [...records.values()].filter((record) => record.cellId === cellId && record.status === "DEAD_LETTER").map(clone),
    auditEvents: async () => structuredClone(audits),
    sourceState: async (_cellId, stream) => {
      const scoped = [...sources.entries()].filter(([, value]) => (value.stream ?? "SHARED_RECORD") === stream);
      const version = scoped.reduce((sum, [, value]) => sum + (typeof value.version === "number" ? value.version : 1), 0);
      return { count: scoped.length, version, checkpoint: scoped.length ? `source:${stream}:${scoped.length}:${version}` : null };
    },
    saveReconciliation: async (cellId, _destinationInstallation, stream, _source, destination) => {
      checkpoints.set(`${cellId}:${stream}`, destination.checkpoint);
    },
    saveRepairCandidate: async (candidate, audit) => exclusive(async () => {
      const existing = repairs.find((item) => item.cellId === candidate.cellId && item.destinationInstallation === candidate.destinationInstallation && item.stream === candidate.stream && item.status === "OPEN");
      const resolved = existing ?? structuredClone(candidate);
      if (existing) Object.assign(existing, structuredClone(candidate), { id: existing.id, createdAt: existing.createdAt });
      else repairs.push(resolved);
      audits.push(structuredClone({ ...audit, targetId: resolved.id }));
      return structuredClone(resolved);
    }),
    resolveRepairCandidates: async (cellId, destinationInstallation, stream, audit) => exclusive(async () => {
      let resolved = false;
      for (const candidate of repairs) {
        if (candidate.cellId === cellId && candidate.destinationInstallation === destinationInstallation && candidate.stream === stream && candidate.status === "OPEN") {
          candidate.status = "RESOLVED";
          candidate.resolvedAt = audit.occurredAt;
          candidate.resolvedBy = audit.actorId;
          candidate.resolutionReason = audit.reason;
          resolved = true;
        }
      }
      if (resolved) audits.push(structuredClone(audit));
    }),
    repairCandidates: async (cellId) => repairs.filter((candidate) => candidate.cellId === cellId).map((candidate) => structuredClone(candidate)),
    acquireCircuitPermit: async (cellId, destinationInstallation, workerId, now, probeLeaseMs) => exclusive(async () => {
      const key = `${cellId}:${destinationInstallation}`;
      let circuit = circuits.get(key);
      if (!circuit) {
        circuit = blankCircuit(cellId, destinationInstallation, now);
        circuits.set(key, circuit);
      }
      if (circuit.state === "CLOSED") return { allowed: true, probe: false };
      if (circuit.state === "OPEN" && circuit.openUntil && circuit.openUntil > now) return { allowed: false, probe: false, deferUntil: new Date(circuit.openUntil) };
      if (circuit.state === "HALF_OPEN" && circuit.probeLeaseUntil && circuit.probeLeaseUntil > now) return { allowed: false, probe: false, deferUntil: new Date(circuit.probeLeaseUntil) };
      const probeFenceToken = randomUUID();
      Object.assign(circuit, { state: "HALF_OPEN", probeLeaseOwner: workerId, probeLeaseUntil: new Date(now.getTime() + probeLeaseMs), probeFenceToken, updatedAt: now });
      audits.push(circuitAudit(circuit, workerId, "half-open", "Open interval elapsed; one probe leased", "SUCCEEDED", now, probeFenceToken));
      return { allowed: true, probe: true, probeFenceToken };
    }),
    recordCircuitSuccess: async (cellId, destinationInstallation, now, probeFenceToken) => exclusive(async () => {
      const circuit = circuits.get(`${cellId}:${destinationInstallation}`);
      if (!circuit) return;
      if (circuit.state === "HALF_OPEN" && circuit.probeFenceToken !== probeFenceToken) throw new Error("Circuit probe fence rejected");
      const wasOpen = circuit.state !== "CLOSED";
      Object.assign(circuit, { state: "CLOSED", failureCount: 0, windowStartedAt: null, openUntil: null, probeLeaseOwner: null, probeLeaseUntil: null, probeFenceToken: null, updatedAt: now });
      if (wasOpen) audits.push(circuitAudit(circuit, "integration-worker", "close", "Destination probe succeeded", "SUCCEEDED", now, probeFenceToken));
    }),
    recordCircuitFailure: async (cellId, destinationInstallation, now, options, probeFenceToken) => exclusive(async () => {
      const key = `${cellId}:${destinationInstallation}`;
      let circuit = circuits.get(key);
      if (!circuit) {
        circuit = blankCircuit(cellId, destinationInstallation, now);
        circuits.set(key, circuit);
      }
      if (circuit.state === "HALF_OPEN") {
        if (circuit.probeFenceToken !== probeFenceToken) throw new Error("Circuit probe fence rejected");
        Object.assign(circuit, { state: "OPEN", failureCount: Math.max(1, circuit.failureCount), lastFailureAt: now, openedAt: now, openUntil: new Date(now.getTime() + options.circuitOpenMs), probeLeaseOwner: null, probeLeaseUntil: null, probeFenceToken: null, updatedAt: now });
        audits.push(circuitAudit(circuit, "integration-worker", "reopen", "Half-open destination probe failed", "FAILED", now, probeFenceToken, "DESTINATION_FAILURE"));
        return;
      }
      const insideWindow = Boolean(circuit.windowStartedAt && now.getTime() - circuit.windowStartedAt.getTime() <= options.failureWindowMs);
      const failureCount = insideWindow ? circuit.failureCount + 1 : 1;
      const opens = failureCount >= options.failureThreshold;
      Object.assign(circuit, { failureCount, windowStartedAt: insideWindow ? circuit.windowStartedAt : now, lastFailureAt: now, state: opens ? "OPEN" : "CLOSED", openedAt: opens ? now : circuit.openedAt, openUntil: opens ? new Date(now.getTime() + options.circuitOpenMs) : null, updatedAt: now });
      if (opens) audits.push(circuitAudit(circuit, "integration-worker", "open", "Destination failure threshold reached", "FAILED", now, undefined, "DESTINATION_FAILURE"));
    })
  };
}

function blankCircuit(cellId: string, destinationInstallation: string, now: Date): CircuitBreakerRecord {
  return { id: `circuit_${randomUUID()}`, cellId, destinationInstallation, state: "CLOSED", failureCount: 0, windowStartedAt: null, lastFailureAt: null, openedAt: null, openUntil: null, probeLeaseOwner: null, probeLeaseUntil: null, probeFenceToken: null, createdAt: now, updatedAt: now };
}

function circuitAudit(circuit: CircuitBreakerRecord, actorId: string, verb: string, reason: string, result: "SUCCEEDED" | "FAILED", occurredAt: Date, correlationId?: string, error?: string): DeliveryAudit {
  return { id: `audit_${randomUUID()}`, actorId, action: `integration-circuit.${verb}`, targetId: circuit.id, correlationId: correlationId ?? circuit.id, reason, result, error, occurredAt };
}
