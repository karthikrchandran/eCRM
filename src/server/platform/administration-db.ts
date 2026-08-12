import type { PrismaClient } from "../../generated/platform-client";

import type { PlatformAdministrationRepository } from "./administration";
import type {
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
    audit: ControlPlaneAuditEventRecord
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
    audit: ControlPlaneAuditEventRecord
  ): Promise<SupportGrantRecord> {
    return this.client.$transaction(async (transaction) => {
      const created = await transaction.supportGrant.create({ data: grantData(grant) });
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
    audit: ControlPlaneAuditEventRecord
  ): Promise<SupportGrantRecord> {
    return this.client.$transaction(async (transaction) => {
      const grant = await transaction.supportGrant.update({
        where: { id: grantId },
        data: { revokedAt, revokedBy, revocationReason }
      });
      await transaction.controlPlaneAuditEvent.create({ data: auditData(audit) });
      return mapGrant(grant);
    });
  }
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
