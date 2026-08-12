import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export type ProjectedLifecycleStatus = "ACTIVE" | "SUSPENDED" | "OFFBOARDING" | "DELETED";

export type CellControlProjectionEnvelope = {
  cellId: string;
  version: number;
  type: "LIFECYCLE" | "SUPPORT_GRANT";
  correlationId: string;
  idempotencyKey: string;
  issuedAt: string;
  payload: Record<string, unknown>;
};

export type CellControlRecord = {
  cellId: string;
  lifecycleStatus: ProjectedLifecycleStatus;
  version: number;
  appliedAt: Date;
  sourceEventId: string;
  sourceIdempotencyKey: string;
};

export type CellSupportGrantRecord = {
  id: string;
  cellId: string;
  operatorId: string;
  caseReference: string;
  capabilities: string[];
  startsAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
  projectionVersion: number;
};

export type CellControlAuditRecord = {
  id: string;
  cellId: string;
  action: string;
  targetType: string;
  targetId: string;
  correlationId: string;
  reason: string;
  result: "SUCCEEDED" | "FAILED";
  error?: string;
  occurredAt: Date;
};

export interface CellControlProjectionRepository {
  getControl(cellId: string): Promise<CellControlRecord | undefined>;
  getGrant(grantId: string): Promise<CellSupportGrantRecord | undefined>;
  hasIdempotencyKey(idempotencyKey: string): Promise<boolean>;
  applyProjection(envelope: CellControlProjectionEnvelope, appliedAt: Date, audit: CellControlAuditRecord): Promise<void>;
  appendAudit(audit: CellControlAuditRecord): Promise<void>;
}

export class CellControlProjectionError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "CellControlProjectionError";
  }
}

export function signControlProjection(envelope: CellControlProjectionEnvelope, secret: string): string {
  requireSigningSecret(secret);
  return createHmac("sha256", secret).update(canonicalJson(envelope)).digest("hex");
}

export function verifyControlProjectionSignature(
  envelope: CellControlProjectionEnvelope,
  signature: string,
  secret: string
): boolean {
  if (!/^[a-f0-9]{64}$/i.test(signature) || secret.length < 32) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(canonicalJson(envelope)).digest("hex"), "hex");
  const actual = Buffer.from(signature, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function requireSigningSecret(secret: string): void {
  if (secret.length < 32) throw new CellControlProjectionError("CELL_CONTROL_PROJECTION_SECRET must be at least 32 characters");
}

export class CellControlProjectionService {
  public constructor(private readonly dependencies: {
    cellId: string;
    secret: string;
    repository: CellControlProjectionRepository;
    now?: () => Date;
  }) {}

  public async apply(envelope: CellControlProjectionEnvelope, signature: string) {
    const now = this.dependencies.now?.() ?? new Date();
    try {
      validateEnvelope(envelope);
      if (envelope.cellId !== this.dependencies.cellId) throw new CellControlProjectionError("Projection cell identity does not match this runtime");
      if (!verifyControlProjectionSignature(envelope, signature, this.dependencies.secret)) {
        throw new CellControlProjectionError("Invalid control projection signature");
      }
      const current = await this.dependencies.repository.getControl(this.dependencies.cellId);
      if (await this.dependencies.repository.hasIdempotencyKey(envelope.idempotencyKey)) {
        return { applied: false, duplicate: true, version: current?.version ?? envelope.version };
      }
      const expectedVersion = (current?.version ?? 0) + 1;
      if (envelope.version !== expectedVersion) throw new CellControlProjectionError("Control projection is out of order");
      if (envelope.type === "SUPPORT_GRANT" && !current) {
        throw new CellControlProjectionError("Lifecycle projection must be initialized before support grants");
      }
      const audit = this.audit(envelope, "SUCCEEDED", now);
      await this.dependencies.repository.applyProjection(envelope, now, audit);
      return { applied: true, duplicate: false, version: envelope.version };
    } catch (error) {
      await this.dependencies.repository.appendAudit(this.audit(
        envelope,
        "FAILED",
        now,
        error instanceof Error ? error.message : "Control projection rejected"
      ));
      throw error;
    }
  }

  private audit(
    envelope: CellControlProjectionEnvelope,
    result: "SUCCEEDED" | "FAILED",
    occurredAt: Date,
    error?: string
  ): CellControlAuditRecord {
    return {
      id: `audit_${randomUUID()}`,
      cellId: this.dependencies.cellId,
      action: `control-projection.${envelope.type.toLowerCase()}`,
      targetType: "CellControlProjection",
      targetId: envelope.idempotencyKey || "unknown",
      correlationId: envelope.correlationId || "unknown",
      reason: `Apply control projection version ${envelope.version}`,
      result,
      error,
      occurredAt
    };
  }
}

/** Explicit one-time entry point for cells that predate durable control projections. */
export class CellControlBootstrapService {
  private readonly projection: CellControlProjectionService;

  public constructor(private readonly dependencies: {
    cellId: string;
    secret: string;
    repository: CellControlProjectionRepository;
    now?: () => Date;
  }) {
    this.projection = new CellControlProjectionService(dependencies);
  }

  public async bootstrap(envelope: CellControlProjectionEnvelope, signature: string) {
    if (envelope.cellId !== this.dependencies.cellId) {
      throw new CellControlProjectionError("Projection cell identity does not match this runtime");
    }
    const current = await this.dependencies.repository.getControl(this.dependencies.cellId);
    if (current) throw new CellControlProjectionError("Cell control projection is already initialized");
    if (envelope.version !== 1 || envelope.type !== "LIFECYCLE" || envelope.payload.lifecycleStatus !== "ACTIVE") {
      throw new CellControlProjectionError("Bootstrap requires an initial ACTIVE lifecycle snapshot");
    }
    return this.projection.apply(envelope, signature);
  }
}

export function createInMemoryCellControlProjectionRepository(): CellControlProjectionRepository {
  const controls = new Map<string, CellControlRecord>();
  const grants = new Map<string, CellSupportGrantRecord>();
  const idempotencyKeys = new Set<string>();
  const audits: CellControlAuditRecord[] = [];
  return {
    getControl: async (cellId) => cloneControl(controls.get(cellId)),
    getGrant: async (grantId) => cloneGrant(grants.get(grantId)),
    hasIdempotencyKey: async (key) => idempotencyKeys.has(key),
    applyProjection: async (envelope, appliedAt, audit) => {
      const current = controls.get(envelope.cellId);
      if (envelope.type === "LIFECYCLE") {
        const payload = envelope.payload as { lifecycleStatus: ProjectedLifecycleStatus; sourceEventId: string };
        controls.set(envelope.cellId, {
          cellId: envelope.cellId,
          lifecycleStatus: payload.lifecycleStatus,
          version: envelope.version,
          appliedAt,
          sourceEventId: payload.sourceEventId,
          sourceIdempotencyKey: envelope.idempotencyKey
        });
      } else {
        if (!current) throw new CellControlProjectionError("Lifecycle projection is missing");
        const payload = envelope.payload as Record<string, unknown>;
        if (payload.operation === "UPSERT") {
          const grant = payload.grant as Record<string, unknown>;
          grants.set(String(grant.id), {
            id: String(grant.id), cellId: String(grant.cellId), operatorId: String(grant.operatorId),
            caseReference: String(grant.caseReference), capabilities: [...(grant.capabilities as string[])],
            startsAt: new Date(String(grant.startsAt)), expiresAt: new Date(String(grant.expiresAt)),
            projectionVersion: envelope.version
          });
        } else {
          const grantId = String(payload.grantId);
          const grant = grants.get(grantId);
          if (!grant) throw new CellControlProjectionError("Projected support grant was not found");
          grants.set(grantId, { ...grant, revokedAt: new Date(String(payload.revokedAt)), projectionVersion: envelope.version });
        }
        controls.set(envelope.cellId, {
          ...current,
          version: envelope.version,
          appliedAt,
          sourceEventId: envelope.type,
          sourceIdempotencyKey: envelope.idempotencyKey
        });
      }
      idempotencyKeys.add(envelope.idempotencyKey);
      audits.push(audit);
    },
    appendAudit: async (audit) => { audits.push(audit); }
  };
}

function validateEnvelope(envelope: CellControlProjectionEnvelope): void {
  if (!envelope.cellId || !Number.isSafeInteger(envelope.version) || envelope.version < 1 || !envelope.correlationId
    || !envelope.idempotencyKey || !envelope.issuedAt || !Number.isFinite(Date.parse(envelope.issuedAt))
    || !["LIFECYCLE", "SUPPORT_GRANT"].includes(envelope.type)) {
    throw new CellControlProjectionError("Invalid control projection envelope");
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function cloneControl(value: CellControlRecord | undefined) {
  return value ? { ...value } : undefined;
}

function cloneGrant(value: CellSupportGrantRecord | undefined) {
  return value ? { ...value, capabilities: [...value.capabilities] } : undefined;
}
