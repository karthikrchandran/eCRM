import { PrismaClient } from "../../generated/platform-client";

import type {
  ControlPlaneAuditEventRecord,
  CustomerCellRecord,
  ProvisioningAction,
  ProvisioningAttemptRecord,
  ProvisioningRequest,
  ProvisioningResult
} from "./types";
import { ProvisioningLeaseLostError } from "./types";
import type { PlatformRepository, ProvisioningFinalization, ProvisioningResultEvidence } from "./provisioning";

declare global {
  var platformDatabase: PrismaClient | undefined;
}

export function getPlatformDatabase(): PrismaClient {
  if ((process.env.APP_MODE ?? "platform") !== "platform") {
    throw new Error("PLATFORM_DATABASE_URL is available only when APP_MODE=platform");
  }
  const connectionString = process.env.PLATFORM_DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("PLATFORM_DATABASE_URL is required when APP_MODE=platform");
  }
  if (!globalThis.platformDatabase) {
    globalThis.platformDatabase = new PrismaClient({ datasources: { db: { url: connectionString } } });
  }
  return globalThis.platformDatabase;
}

export class PrismaPlatformRepository implements PlatformRepository {
  public constructor(private readonly client: PrismaClient) {}

  public async transaction<T>(operation: (repository: PlatformRepository) => Promise<T>): Promise<T> {
    return this.client.$transaction((transactionClient) => operation(new PrismaPlatformRepository(transactionClient as PrismaClient)));
  }

  public async findCellByIdentity(cellId: string, cellKey: string): Promise<CustomerCellRecord | undefined> {
    const cell = await this.client.customerCell.findFirst({ where: { id: cellId, cellKey } });
    return cell ? mapCell(cell) : undefined;
  }

  public async findLatestAttemptForCell(cellId: string): Promise<ProvisioningAttemptRecord | undefined> {
    const attempt = await this.client.provisioningAttempt.findFirst({
      where: { cellId },
      include: { actions: { orderBy: { occurredAt: "asc" } } },
      orderBy: { createdAt: "desc" }
    });
    return attempt ? mapAttempt(attempt) : undefined;
  }

  public async findProvisioningAttempt(attemptId: string): Promise<ProvisioningAttemptRecord | undefined> {
    const attempt = await this.client.provisioningAttempt.findUnique({
      where: { id: attemptId },
      include: { actions: { orderBy: { occurredAt: "asc" } } }
    });
    return attempt ? mapAttempt(attempt) : undefined;
  }

  public async reserveCustomerCell(request: ProvisioningRequest): Promise<{ cell: CustomerCellRecord; created: boolean }> {
    const reservation = await this.client.customerCell.createMany({
      data: {
        id: request.cellId,
        cellKey: request.cellKey,
        legalName: request.legalName,
        displayName: request.displayName,
        region: request.region,
        desiredSubdomain: request.desiredSubdomain,
        lifecycleStatus: "PROVISIONING"
      },
      skipDuplicates: true
    });
    const cell = await this.client.customerCell.findFirst({ where: { id: request.cellId, cellKey: request.cellKey } });
    if (!cell) throw new Error("Customer cell identity mismatch");
    return { cell: mapCell(cell), created: reservation.count === 1 };
  }

  public async reserveProvisioningAttempt(
    cellId: string,
    idempotencyKey: string,
    correlationId: string
  ): Promise<ProvisioningAttemptRecord> {
    const attempt = await this.client.provisioningAttempt.upsert({
      where: { cellId_idempotencyKey: { cellId, idempotencyKey } },
      create: { cellId, idempotencyKey, correlationId, result: "IN_PROGRESS" },
      update: {},
      include: { actions: { orderBy: { occurredAt: "asc" } } }
    });
    return mapAttempt(attempt);
  }

  public async claimProvisioningAttempt(attemptId: string, staleBefore: Date): Promise<ProvisioningAttemptRecord | undefined> {
    const claimed = await this.client.provisioningAttempt.updateMany({
      where: {
        id: attemptId,
        OR: [
          { result: "FAILED" },
          { result: "IN_PROGRESS", updatedAt: { lte: staleBefore } }
        ]
      },
      data: { result: "IN_PROGRESS", leaseVersion: { increment: 1 }, updatedAt: new Date() }
    });
    return claimed.count === 1 ? this.findProvisioningAttempt(attemptId) : undefined;
  }

  public async appendProvisioningAction(
    attemptId: string,
    leaseVersion: number,
    action: ProvisioningAction
  ): Promise<ProvisioningAttemptRecord> {
    try {
      const attempt = await this.client.provisioningAttempt.update({
        where: { id_leaseVersion: { id: attemptId, leaseVersion }, result: "IN_PROGRESS" },
        data: {
          updatedAt: new Date(),
          actions: {
            create: {
              step: action.step,
              result: action.result,
              reference: action.reference,
              errorCode: action.errorCode,
              occurredAt: action.occurredAt
            }
          }
        },
        include: { actions: { orderBy: { occurredAt: "asc" } } }
      });
      return mapAttempt(attempt);
    } catch (error) {
      throw leaseLost(attemptId, error);
    }
  }

  public async recordProvisioningResult({ attemptId, leaseVersion, action, auditEvent }: ProvisioningResultEvidence): Promise<ProvisioningAttemptRecord> {
    return this.transaction(async (repository) => {
      const attempt = await repository.appendProvisioningAction(attemptId, leaseVersion, action);
      await repository.addAuditEvent(auditEvent);
      return attempt;
    });
  }

  public async finalizeProvisioningSuccess({ cellId, attemptId, leaseVersion, action, auditEvent }: ProvisioningFinalization): Promise<{
    cell: CustomerCellRecord;
    attempt: ProvisioningAttemptRecord;
  }> {
    return this.transaction(async (repository) => {
      await repository.appendProvisioningAction(attemptId, leaseVersion, action);
      await repository.addAuditEvent(auditEvent);
      const cell = await repository.updateCell(cellId, attemptId, leaseVersion, { lifecycleStatus: "ACTIVE" });
      const attempt = await repository.setAttemptResult(attemptId, leaseVersion, "SUCCEEDED");
      return { cell, attempt };
    });
  }

  public async finalizeProvisioningFailure({ cellId, attemptId, leaseVersion, action, auditEvent }: ProvisioningFinalization): Promise<{
    cell: CustomerCellRecord;
    attempt: ProvisioningAttemptRecord;
  }> {
    return this.transaction(async (repository) => {
      await repository.appendProvisioningAction(attemptId, leaseVersion, action);
      await repository.addAuditEvent(auditEvent);
      const cell = await repository.updateCell(cellId, attemptId, leaseVersion, { lifecycleStatus: "PROVISIONING_FAILED" });
      const attempt = await repository.setAttemptResult(attemptId, leaseVersion, "FAILED");
      return { cell, attempt };
    });
  }

  public async setAttemptResult(
    attemptId: string,
    leaseVersion: number,
    result: ProvisioningResult
  ): Promise<ProvisioningAttemptRecord> {
    try {
      const attempt = await this.client.provisioningAttempt.update({
        where: { id_leaseVersion: { id: attemptId, leaseVersion }, result: "IN_PROGRESS" },
        data: { result, updatedAt: new Date() },
        include: { actions: { orderBy: { occurredAt: "asc" } } }
      });
      return mapAttempt(attempt);
    } catch (error) {
      throw leaseLost(attemptId, error);
    }
  }

  public async updateCell(
    cellId: string,
    attemptId: string,
    leaseVersion: number,
    update: Partial<CustomerCellRecord>
  ): Promise<CustomerCellRecord> {
    const data = { ...update };
    delete data.id;
    delete data.cellKey;
    delete data.createdAt;
    delete data.updatedAt;
    try {
      const attempt = await this.client.provisioningAttempt.update({
        where: { id_leaseVersion: { id: attemptId, leaseVersion }, cellId, result: "IN_PROGRESS" },
        data: { updatedAt: new Date(), cell: { update: data } },
        include: { cell: true }
      });
      return mapCell(attempt.cell);
    } catch (error) {
      throw leaseLost(attemptId, error);
    }
  }

  public async addAuditEvent(event: ControlPlaneAuditEventRecord): Promise<void> {
    await this.client.controlPlaneAuditEvent.create({
      data: {
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
      }
    });
  }

  public async upsertSignalLoopConnection(input: {
    cellId: string;
    attemptId: string;
    leaseVersion: number;
    workspaceReference: string;
    secretReference: string;
    correlationId: string;
    idempotencyKey: string;
  }): Promise<void> {
    try {
      await this.client.provisioningAttempt.update({
        where: {
          id_leaseVersion: { id: input.attemptId, leaseVersion: input.leaseVersion },
          cellId: input.cellId,
          result: "IN_PROGRESS"
        },
        data: {
          updatedAt: new Date(),
          cell: {
            update: {
              connections: {
                upsert: {
                  where: { cellId_connectionKey: { cellId: input.cellId, connectionKey: "signalloop" } },
                  create: {
                    connectionKey: "signalloop",
                    provider: "SignalLoop",
                    workspaceReference: input.workspaceReference,
                    secretReference: input.secretReference,
                    capabilities: [],
                    status: "ACTIVE",
                    correlationId: input.correlationId,
                    idempotencyKey: input.idempotencyKey
                  },
                  update: {
                    workspaceReference: input.workspaceReference,
                    secretReference: input.secretReference,
                    status: "ACTIVE"
                  }
                }
              }
            }
          }
        }
      });
    } catch (error) {
      throw leaseLost(input.attemptId, error);
    }
  }

  public async auditEventsForCell(cellId: string): Promise<ControlPlaneAuditEventRecord[]> {
    const events = await this.client.controlPlaneAuditEvent.findMany({ where: { cellId }, orderBy: { occurredAt: "asc" } });
    return events.map((event) => ({
      id: event.id,
      cellId: event.cellId,
      correlationId: event.correlationId,
      action: event.action as ControlPlaneAuditEventRecord["action"],
      result: event.result as ProvisioningResult,
      actor: event.actor,
      reason: event.reason ?? undefined,
      error: event.error ?? undefined,
      errorCode: event.errorCode ?? undefined,
      secretReference: event.secretReference ?? undefined,
      occurredAt: event.occurredAt
    }));
  }
}

function mapCell(cell: {
  id: string;
  cellKey: string;
  legalName: string;
  displayName: string;
  region: string;
  desiredSubdomain: string;
  lifecycleStatus: string;
  databaseReference: string | null;
  storageReference: string | null;
  secretReference: string | null;
  backupReference: string | null;
  applicationReference: string | null;
  applicationUrl: string | null;
  signalLoopWorkspaceReference: string | null;
  createdAt: Date;
  updatedAt: Date;
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

function mapAttempt(attempt: {
  id: string;
  cellId: string;
  idempotencyKey: string;
  correlationId: string;
  leaseVersion: number;
  result: string;
  createdAt: Date;
  updatedAt: Date;
  actions: Array<{ step: string; result: string; reference: string | null; errorCode: string | null; occurredAt: Date }>;
}): ProvisioningAttemptRecord {
  return {
    id: attempt.id,
    cellId: attempt.cellId,
    idempotencyKey: attempt.idempotencyKey,
    correlationId: attempt.correlationId,
    leaseVersion: attempt.leaseVersion,
    result: attempt.result as ProvisioningAttemptRecord["result"],
    createdAt: attempt.createdAt,
    updatedAt: attempt.updatedAt,
    actions: attempt.actions.map((action) => ({
      step: action.step as ProvisioningAction["step"],
      result: action.result as ProvisioningAction["result"],
      reference: action.reference ?? undefined,
      errorCode: action.errorCode ?? undefined,
      occurredAt: action.occurredAt
    }))
  };
}

function leaseLost(attemptId: string, error: unknown): Error {
  if (error instanceof ProvisioningLeaseLostError) return error;
  if (typeof error === "object" && error !== null && "code" in error && error.code === "P2025") {
    return new ProvisioningLeaseLostError(attemptId);
  }
  return error instanceof Error ? error : new Error("Unknown platform persistence failure");
}
