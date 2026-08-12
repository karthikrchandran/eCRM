import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

import type {
  CredentialAudit,
  IntegrationCapability,
  IntegrationCredentialRecord,
  IntegrationCredentialRepository
} from "./credentials";

export class PrismaIntegrationCredentialRepository implements IntegrationCredentialRepository {
  public constructor(private readonly client: PrismaClient) {}

  public async findById(id: string): Promise<IntegrationCredentialRecord | undefined> {
    const record = await this.client.integrationCredential.findUnique({ where: { id } });
    return record ? mapCredential(record) : undefined;
  }

  public async list(cellId: string): Promise<IntegrationCredentialRecord[]> {
    return (await this.client.integrationCredential.findMany({ where: { cellId }, orderBy: { createdAt: "desc" } })).map(mapCredential);
  }

  public async createWithAudit(record: IntegrationCredentialRecord, audit: CredentialAudit): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      await transaction.integrationCredential.create({ data: record });
      await transaction.cellAuditEvent.create({ data: auditData(audit) });
    });
  }

  public async rotateWithAudit(currentId: string, replacement: IntegrationCredentialRecord, rotatedAt: Date, audit: CredentialAudit): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      const changed = await transaction.integrationCredential.updateMany({
        where: { id: currentId, cellId: replacement.cellId, status: "ACTIVE" },
        data: { status: "ROTATED", rotatedAt }
      });
      if (changed.count !== 1) throw new Error("Credential is unavailable for rotation");
      await transaction.integrationCredential.create({ data: replacement });
      await transaction.cellAuditEvent.create({ data: auditData(audit) });
    });
  }

  public async revokeWithAudit(id: string, revokedAt: Date, audit: CredentialAudit): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      const changed = await transaction.integrationCredential.updateMany({ where: { id, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt } });
      if (changed.count !== 1) throw new Error("Credential is unavailable for revocation");
      await transaction.cellAuditEvent.create({ data: auditData(audit) });
    });
  }

  public async touchLastUsed(id: string, usedAt: Date): Promise<void> {
    await this.client.integrationCredential.updateMany({ where: { id, status: "ACTIVE" }, data: { lastUsedAt: usedAt } });
  }

  public async auditEvents(): Promise<CredentialAudit[]> {
    return (await this.client.cellAuditEvent.findMany({ where: { targetType: "IntegrationCredential" }, orderBy: { occurredAt: "asc" } })).map((event) => ({
      ...event,
      targetType: "IntegrationCredential" as const,
      before: event.before as Record<string, unknown> | null,
      after: event.after as Record<string, unknown> | null,
      result: event.result as "SUCCEEDED" | "FAILED",
      error: event.error ?? undefined
    }));
  }
}

function mapCredential(record: {
  id: string; cellId: string; name: string; secretHash: string; capabilities: string[]; status: string;
  expiresAt: Date; rotatedAt: Date | null; revokedAt: Date | null; lastUsedAt: Date | null; createdAt: Date; updatedAt: Date;
}): IntegrationCredentialRecord {
  return { ...record, capabilities: record.capabilities as IntegrationCapability[], status: record.status as IntegrationCredentialRecord["status"] };
}

function auditData(audit: CredentialAudit): Prisma.CellAuditEventUncheckedCreateInput {
  return {
    ...audit,
    before: audit.before === null ? Prisma.DbNull : audit.before as Prisma.InputJsonValue,
    after: audit.after === null ? Prisma.DbNull : audit.after as Prisma.InputJsonValue
  };
}
