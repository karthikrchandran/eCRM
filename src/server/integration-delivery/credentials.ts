import { randomBytes, randomUUID } from "node:crypto";
import { compare, hash } from "bcryptjs";

import type { RuntimeConfig } from "@/server/runtime/cell-config";

export const integrationCapabilities = [
  "SHARED_RECORDS_READ",
  "SHARED_RECORDS_WRITE",
  "WORKFLOW_EVENTS_WRITE",
  "PROJECTION_DELIVER"
] as const;
export type IntegrationCapability = typeof integrationCapabilities[number];
export type IntegrationCredentialStatus = "ACTIVE" | "ROTATED" | "REVOKED";

export type IntegrationCredentialRecord = {
  id: string;
  cellId: string;
  name: string;
  secretHash: string;
  capabilities: IntegrationCapability[];
  status: IntegrationCredentialStatus;
  expiresAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CredentialAudit = {
  id: string;
  actorId: string;
  action: string;
  targetType: "IntegrationCredential";
  targetId: string;
  correlationId: string;
  reason: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  result: "SUCCEEDED" | "FAILED";
  error?: string;
  occurredAt: Date;
};

export interface IntegrationCredentialRepository {
  findById(id: string): Promise<IntegrationCredentialRecord | undefined>;
  list(cellId: string): Promise<IntegrationCredentialRecord[]>;
  createWithAudit(record: IntegrationCredentialRecord, audit: CredentialAudit): Promise<void>;
  rotateWithAudit(currentId: string, replacement: IntegrationCredentialRecord, rotatedAt: Date, audit: CredentialAudit): Promise<void>;
  revokeWithAudit(id: string, revokedAt: Date, audit: CredentialAudit): Promise<void>;
  touchLastUsed(id: string, usedAt: Date): Promise<void>;
  auditEvents(): Promise<CredentialAudit[]>;
}

export class IntegrationCredentialDeniedError extends Error {
  public constructor() {
    super("Unauthorized integration credential");
    this.name = "IntegrationCredentialDeniedError";
  }
}

type Actor = { id: string; role: "ADMIN" | "SALES" };
type Context = { correlationId: string; reason: string };

export class IntegrationCredentialService {
  private readonly now: () => Date;
  private readonly environment: Record<string, string | undefined>;

  public constructor(
    private readonly repository: IntegrationCredentialRepository,
    private readonly options: {
      runtime: RuntimeConfig;
      now?: () => Date;
      environment?: Record<string, string | undefined>;
      hashSecret?: (secret: string) => Promise<string>;
      compareSecret?: (secret: string, secretHash: string) => Promise<boolean>;
      createSecret?: (credentialId: string) => string;
    }
  ) {
    this.now = options.now ?? (() => new Date());
    this.environment = options.environment ?? process.env;
  }

  public async list(actor: Actor): Promise<Array<Omit<IntegrationCredentialRecord, "secretHash">>> {
    this.assertAdminCell(actor);
    return (await this.repository.list(this.cellId())).map(publicCredential);
  }

  public async issue(actor: Actor, input: {
    name: string;
    capabilities: IntegrationCapability[];
    expiresAt: Date;
  } & Context): Promise<{ credential: Omit<IntegrationCredentialRecord, "secretHash">; secret: string }> {
    this.assertAdminCell(actor);
    const now = this.now();
    if (!input.name.trim() || input.capabilities.length === 0 || input.expiresAt <= now) throw new Error("Invalid credential request");
    if (input.capabilities.some((capability) => !integrationCapabilities.includes(capability))) throw new Error("Invalid credential capability");
    const id = `cred_${randomUUID()}`;
    const secret = this.options.createSecret?.(id) ?? `ecrm_${id}.${randomBytes(32).toString("base64url")}`;
    const record: IntegrationCredentialRecord = {
      id, cellId: this.cellId(), name: input.name.trim(),
      secretHash: await (this.options.hashSecret ?? ((value) => hash(value, 12)))(secret),
      capabilities: [...new Set(input.capabilities)], status: "ACTIVE", expiresAt: input.expiresAt,
      rotatedAt: null, revokedAt: null, lastUsedAt: null, createdAt: now, updatedAt: now
    };
    await this.repository.createWithAudit(record, this.audit(actor.id, "issue", record, input, null, snapshot(record), now));
    return { credential: publicCredential(record), secret };
  }

  public async rotate(actor: Actor, credentialId: string, input: { expiresAt: Date } & Context) {
    this.assertAdminCell(actor);
    const current = await this.owned(credentialId);
    if (!current || current.status !== "ACTIVE") throw new Error("Credential is unavailable for rotation");
    const now = this.now();
    const id = `cred_${randomUUID()}`;
    const secret = this.options.createSecret?.(id) ?? `ecrm_${id}.${randomBytes(32).toString("base64url")}`;
    const replacement: IntegrationCredentialRecord = {
      ...current, id, secretHash: await (this.options.hashSecret ?? ((value) => hash(value, 12)))(secret),
      status: "ACTIVE", expiresAt: input.expiresAt, rotatedAt: null, revokedAt: null, lastUsedAt: null,
      createdAt: now, updatedAt: now
    };
    await this.repository.rotateWithAudit(current.id, replacement, now, this.audit(actor.id, "rotate", current, input, snapshot(current), snapshot(replacement), now));
    return { credential: publicCredential(replacement), secret };
  }

  public async revoke(actor: Actor, credentialId: string, input: Context): Promise<void> {
    this.assertAdminCell(actor);
    const current = await this.owned(credentialId);
    if (!current || current.status !== "ACTIVE") throw new Error("Credential is unavailable for revocation");
    const now = this.now();
    await this.repository.revokeWithAudit(current.id, now, this.audit(actor.id, "revoke", current, input, snapshot(current), { ...snapshot(current), status: "REVOKED" }, now));
  }

  public async authenticate(secret: string | undefined, capability: IntegrationCapability): Promise<{
    credentialId: string;
    cellId: string;
    capabilities: IntegrationCapability[];
    legacy?: boolean;
  }> {
    const runtime = this.options.runtime;
    if (runtime.mode !== "cell" || !secret) throw new IntegrationCredentialDeniedError();
    if (this.legacyAllowed() && secret === this.environment.SHARED_DATA_API_TOKEN) {
      return { credentialId: "legacy-development", cellId: runtime.cellId, capabilities: [...integrationCapabilities], legacy: true };
    }
    const match = secret.match(/^ecrm_(cred_[^.]+)\.[A-Za-z0-9_-]+$/);
    const record = match ? await this.repository.findById(match[1]) : undefined;
    const valid = Boolean(record && record.cellId === runtime.cellId && record.status === "ACTIVE"
      && record.expiresAt > this.now() && record.capabilities.includes(capability)
      && await (this.options.compareSecret ?? compare)(secret, record.secretHash));
    if (!valid || !record) throw new IntegrationCredentialDeniedError();
    await this.repository.touchLastUsed(record.id, this.now());
    return { credentialId: record.id, cellId: record.cellId, capabilities: [...record.capabilities] };
  }

  private assertAdminCell(actor: Actor): void {
    if (this.options.runtime.mode !== "cell") throw new Error("Not found");
    if (actor.role !== "ADMIN") throw new Error("Only Admin can manage integration credentials");
  }

  private cellId(): string {
    if (this.options.runtime.mode !== "cell") throw new Error("Not found");
    return this.options.runtime.cellId;
  }

  private async owned(id: string) {
    const record = await this.repository.findById(id);
    return record?.cellId === this.cellId() ? record : undefined;
  }

  private legacyAllowed(): boolean {
    return this.environment.NODE_ENV === "development"
      && this.environment.ALLOW_LEGACY_SHARED_DATA_TOKEN === "true"
      && Boolean(this.environment.SHARED_DATA_API_TOKEN);
  }

  private audit(actorId: string, verb: string, target: IntegrationCredentialRecord, context: Context, before: Record<string, unknown> | null, after: Record<string, unknown> | null, occurredAt: Date): CredentialAudit {
    return {
      id: `audit_${randomUUID()}`, actorId, action: `integration-credential.${verb}`,
      targetType: "IntegrationCredential", targetId: target.id, correlationId: context.correlationId,
      reason: context.reason, before, after, result: "SUCCEEDED", occurredAt
    };
  }
}

function snapshot(record: IntegrationCredentialRecord): Record<string, unknown> {
  return { name: record.name, capabilities: [...record.capabilities], status: record.status, expiresAt: record.expiresAt.toISOString() };
}

function publicCredential(record: IntegrationCredentialRecord): Omit<IntegrationCredentialRecord, "secretHash"> {
  const { secretHash: _secretHash, ...safe } = record;
  void _secretHash;
  return safe;
}

export function createInMemoryIntegrationCredentialRepository(): IntegrationCredentialRepository {
  const credentials = new Map<string, IntegrationCredentialRecord>();
  const audits: CredentialAudit[] = [];
  const clone = (record: IntegrationCredentialRecord) => ({ ...record, capabilities: [...record.capabilities] });
  return {
    findById: async (id) => credentials.has(id) ? clone(credentials.get(id)!) : undefined,
    list: async (cellId) => [...credentials.values()].filter((record) => record.cellId === cellId).map(clone),
    createWithAudit: async (record, audit) => { credentials.set(record.id, clone(record)); audits.push(structuredClone(audit)); },
    rotateWithAudit: async (currentId, replacement, rotatedAt, audit) => {
      const current = credentials.get(currentId);
      if (!current || current.status !== "ACTIVE") throw new Error("Credential is unavailable for rotation");
      credentials.set(currentId, { ...current, status: "ROTATED", rotatedAt, updatedAt: rotatedAt });
      credentials.set(replacement.id, clone(replacement));
      audits.push(structuredClone(audit));
    },
    revokeWithAudit: async (id, revokedAt, audit) => {
      const current = credentials.get(id);
      if (!current || current.status !== "ACTIVE") throw new Error("Credential is unavailable for revocation");
      credentials.set(id, { ...current, status: "REVOKED", revokedAt, updatedAt: revokedAt });
      audits.push(structuredClone(audit));
    },
    touchLastUsed: async (id, usedAt) => {
      const current = credentials.get(id);
      if (current) credentials.set(id, { ...current, lastUsedAt: usedAt, updatedAt: usedAt });
    },
    auditEvents: async () => structuredClone(audits)
  };
}
