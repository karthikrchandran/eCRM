import { PrismaClient } from "../../generated/platform-client";

import type {
  ControlPlaneAuditEventRecord,
  CustomerCellRecord,
  ProvisioningAction,
  ProvisioningAttemptRecord,
  ProvisioningRequest,
  ProvisioningResult
} from "./types";
import type { PlatformRepository } from "./provisioning";

declare global {
  // eslint-disable-next-line no-var
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

  public async reserveCustomerCell(request: ProvisioningRequest): Promise<{ cell: CustomerCellRecord; created: boolean }> {
    try {
      const cell = await this.client.customerCell.create({
        data: {
          id: request.cellId,
          cellKey: request.cellKey,
          legalName: request.legalName,
          displayName: request.displayName,
          region: request.region,
          desiredSubdomain: request.desiredSubdomain,
          lifecycleStatus: "PROVISIONING"
        }
      });
      return { cell: mapCell(cell), created: true };
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const cell = await this.client.customerCell.findFirst({ where: { id: request.cellId, cellKey: request.cellKey } });
      if (!cell) throw new Error("Customer cell identity mismatch");
      return { cell: mapCell(cell), created: false };
    }
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

  public async appendProvisioningAction(attemptId: string, action: ProvisioningAction): Promise<void> {
    await this.client.provisioningAction.create({
      data: {
        attemptId,
        step: action.step,
        result: action.result,
        reference: action.reference,
        errorCode: action.errorCode,
        occurredAt: action.occurredAt
      }
    });
  }

  public async setAttemptResult(attemptId: string, result: ProvisioningResult): Promise<void> {
    await this.client.provisioningAttempt.update({ where: { id: attemptId }, data: { result } });
  }

  public async updateCell(cellId: string, update: Partial<CustomerCellRecord>): Promise<CustomerCellRecord> {
    const {
      id: _ignoredId,
      cellKey: _ignoredCellKey,
      createdAt: _ignoredCreatedAt,
      updatedAt: _ignoredUpdatedAt,
      ...data
    } = update;
    const cell = await this.client.customerCell.update({ where: { id: cellId }, data });
    return mapCell(cell);
  }

  public async addAuditEvent(event: ControlPlaneAuditEventRecord): Promise<void> {
    await this.client.controlPlaneAuditEvent.create({
      data: {
        id: event.id,
        cellId: event.cellId,
        actor: "system:provisioner",
        action: event.action,
        result: event.result,
        correlationId: event.correlationId,
        occurredAt: event.occurredAt
      }
    });
  }

  public async upsertSignalLoopConnection(input: {
    cellId: string;
    workspaceReference: string;
    secretReference: string;
    correlationId: string;
    idempotencyKey: string;
  }): Promise<void> {
    await this.client.installationConnection.upsert({
      where: { cellId_connectionKey: { cellId: input.cellId, connectionKey: "signalloop" } },
      create: {
        cellId: input.cellId,
        connectionKey: "signalloop",
        provider: "SignalLoop",
        workspaceReference: input.workspaceReference,
        secretReference: input.secretReference,
        capabilities: [],
        status: "ACTIVE",
        correlationId: input.correlationId,
        idempotencyKey: input.idempotencyKey
      },
      update: { workspaceReference: input.workspaceReference, secretReference: input.secretReference, status: "ACTIVE" }
    });
  }

  public async auditEventsForCell(cellId: string): Promise<ControlPlaneAuditEventRecord[]> {
    const events = await this.client.controlPlaneAuditEvent.findMany({ where: { cellId }, orderBy: { occurredAt: "asc" } });
    return events.map((event) => ({
      id: event.id,
      cellId: event.cellId,
      correlationId: event.correlationId,
      action: event.action as ControlPlaneAuditEventRecord["action"],
      result: event.result as ProvisioningResult,
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

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
