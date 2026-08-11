import type { CellProvider, CellProviderContext, ProviderReference } from "./providers/types";
import type {
  ControlPlaneAuditEventRecord,
  CustomerCellRecord,
  ProvisioningAction,
  ProvisioningAttemptRecord,
  ProvisioningRequest,
  ProvisioningResult,
  ProvisioningStep
} from "./types";

export interface PlatformRepository {
  transaction<T>(operation: (repository: PlatformRepository) => Promise<T>): Promise<T>;
  findCellByCustomerKey(customerKey: string): Promise<CustomerCellRecord | undefined>;
  findLatestAttemptForCell(cellId: string): Promise<ProvisioningAttemptRecord | undefined>;
  reserveCustomerCell(request: ProvisioningRequest): Promise<{ cell: CustomerCellRecord; created: boolean }>;
  reserveProvisioningAttempt(cellId: string, idempotencyKey: string, correlationId: string): Promise<ProvisioningAttemptRecord>;
  appendProvisioningAction(attemptId: string, action: ProvisioningAction): Promise<void>;
  setAttemptResult(attemptId: string, result: ProvisioningResult): Promise<void>;
  updateCell(cellId: string, update: Partial<CustomerCellRecord>): Promise<CustomerCellRecord>;
  addAuditEvent(event: ControlPlaneAuditEventRecord): Promise<void>;
  upsertSignalLoopConnection(input: {
    cellId: string;
    workspaceReference: string;
    secretReference: string;
    correlationId: string;
    idempotencyKey: string;
  }): Promise<void>;
  auditEventsForCell(cellId: string): Promise<ControlPlaneAuditEventRecord[]>;
}

export interface InMemoryPlatformRepository extends PlatformRepository {
  cells(): CustomerCellRecord[];
}

export function createInMemoryPlatformRepository(): InMemoryPlatformRepository {
  const cells = new Map<string, CustomerCellRecord>();
  const attempts = new Map<string, ProvisioningAttemptRecord>();
  const auditEvents: ControlPlaneAuditEventRecord[] = [];
  let nextId = 1;

  const repository: InMemoryPlatformRepository = {
    transaction: async <T>(operation: (repository: PlatformRepository) => Promise<T>) => operation(repository),
    findCellByCustomerKey: async (customerKey) => [...cells.values()].find((cell) => cell.customerKey === customerKey),
    findLatestAttemptForCell: async (cellId) =>
      [...attempts.values()].filter((attempt) => attempt.cellId === cellId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0],
    reserveCustomerCell: async (request) => {
      const existing = [...cells.values()].find((cell) => cell.customerKey === request.customerKey);
      if (existing) return { cell: existing, created: false };
      const now = new Date();
      const record: CustomerCellRecord = {
        id: `cell_${nextId++}`,
        customerKey: request.customerKey,
        legalName: request.legalName,
        displayName: request.displayName,
        region: request.region,
        desiredSubdomain: request.desiredSubdomain,
        lifecycleStatus: "PROVISIONING",
        createdAt: now,
        updatedAt: now
      };
      cells.set(record.id, record);
      return { cell: record, created: true };
    },
    reserveProvisioningAttempt: async (cellId, idempotencyKey, correlationId) => {
      const existing = [...attempts.values()].find(
        (attempt) => attempt.cellId === cellId && attempt.idempotencyKey === idempotencyKey
      );
      if (existing) return existing;
      const now = new Date();
      const attempt: ProvisioningAttemptRecord = {
        id: `attempt_${nextId++}`,
        cellId,
        idempotencyKey,
        correlationId,
        result: "IN_PROGRESS",
        actions: [],
        createdAt: now,
        updatedAt: now
      };
      attempts.set(attempt.id, attempt);
      return attempt;
    },
    appendProvisioningAction: async (attemptId, action) => {
      const attempt = requiredAttempt(attempts, attemptId);
      attempt.actions.push(action);
      attempt.updatedAt = new Date();
    },
    setAttemptResult: async (attemptId, result) => {
      const attempt = requiredAttempt(attempts, attemptId);
      attempt.result = result;
      attempt.updatedAt = new Date();
    },
    updateCell: async (cellId, update) => {
      const cell = requiredCell(cells, cellId);
      const { id: _ignoredId, customerKey: _ignoredKey, ...mutableUpdate } = update;
      Object.assign(cell, mutableUpdate, { updatedAt: new Date() });
      return cell;
    },
    addAuditEvent: async (event) => {
      auditEvents.push(event);
    },
    upsertSignalLoopConnection: async () => undefined,
    auditEventsForCell: async (cellId) => auditEvents.filter((event) => event.cellId === cellId),
    cells: () => [...cells.values()]
  };
  return repository;
}

export class CustomerCellProvisioner {
  public constructor(
    private readonly repository: PlatformRepository,
    private readonly provider: CellProvider
  ) {}

  public async provision(request: ProvisioningRequest): Promise<ProvisioningOutcome> {
    if (process.env.APP_MODE === "cell") {
      throw new Error("Customer-cell mode cannot run control-plane provisioning");
    }

    const reservation = await this.repository.transaction(async (repository) => {
      const existingCell = await repository.findCellByCustomerKey(request.customerKey);
      if (existingCell) {
        const existingAttempt = await repository.findLatestAttemptForCell(existingCell.id);
        if (!existingAttempt) throw new Error(`Customer cell ${existingCell.id} has no provisioning attempt`);
        return { cell: existingCell, attempt: existingAttempt, shouldRun: false };
      }

      const reservation = await repository.reserveCustomerCell(request);
      if (!reservation.created) {
        const existingAttempt = await repository.findLatestAttemptForCell(reservation.cell.id);
        if (!existingAttempt) throw new Error(`Customer cell ${reservation.cell.id} has no provisioning attempt`);
        return { cell: reservation.cell, attempt: existingAttempt, shouldRun: false };
      }
      const cell = reservation.cell;
      const attempt = await repository.reserveProvisioningAttempt(cell.id, request.idempotencyKey, request.correlationId);
      return { cell, attempt, shouldRun: true };
    });

    if (!reservation.shouldRun) return this.outcome(reservation.cell, reservation.attempt);

    const context: CellProviderContext = {
      cellId: reservation.cell.id,
      customerKey: reservation.cell.customerKey,
      correlationId: request.correlationId
    };

    try {
      const database = await this.runStep(reservation, context, "database", () => this.provider.createDatabase(context));
      await this.repository.updateCell(reservation.cell.id, { databaseReference: database.reference });
      const storage = await this.runStep(reservation, context, "storage", () => this.provider.createStoragePrefix(context));
      await this.repository.updateCell(reservation.cell.id, { storageReference: storage.reference });
      const secret = await this.runStep(reservation, context, "secret-reference", () => this.provider.createSecretReference(context));
      await this.repository.updateCell(reservation.cell.id, { secretReference: secret.reference });
      const backup = await this.runStep(reservation, context, "backup-policy", () => this.provider.applyBackupPolicy(context));
      await this.repository.updateCell(reservation.cell.id, { backupReference: backup.reference });
      const application = await this.runStep(reservation, context, "application", () => this.provider.deployApplication(context));
      await this.repository.updateCell(reservation.cell.id, { applicationReference: application.reference });
      const signalLoop = await this.runStep(reservation, context, "signalloop-binding", () => this.provider.bindSignalLoopInstallation(context));
      await this.repository.updateCell(reservation.cell.id, { signalLoopWorkspaceReference: signalLoop.reference });
      await this.repository.upsertSignalLoopConnection({
        cellId: reservation.cell.id,
        workspaceReference: signalLoop.reference,
        secretReference: secret.reference,
        correlationId: request.correlationId,
        idempotencyKey: request.idempotencyKey
      });

      const health = await this.provider.healthCheck(context);
      if (!health.healthy) throw new ProvisioningStepError("health-check", health.detail ?? "health-check-failed");
      await this.record(this.repository, reservation.cell.id, reservation.attempt.id, request.correlationId, "health-check", "SUCCEEDED");
      await this.repository.setAttemptResult(reservation.attempt.id, "SUCCEEDED");
      const cell = await this.repository.updateCell(reservation.cell.id, { lifecycleStatus: "ACTIVE" });
      return this.outcome(cell, reservation.attempt);
    } catch (error) {
      const failedStep = error instanceof ProvisioningStepError ? error.step : "health-check";
      await this.record(this.repository, reservation.cell.id, reservation.attempt.id, request.correlationId, failedStep, "FAILED", undefined, "PROVISIONING_STEP_FAILED");
      await this.repository.setAttemptResult(reservation.attempt.id, "FAILED");
      const cell = await this.repository.updateCell(reservation.cell.id, { lifecycleStatus: "PROVISIONING_FAILED" });
      return this.outcome(cell, reservation.attempt);
    }
  }

  private async runStep(
    reservation: ProvisioningReservation,
    context: CellProviderContext,
    step: Exclude<ProvisioningStep, "health-check">,
    operation: () => Promise<ProviderReference>
  ): Promise<ProviderReference> {
    try {
      const resource = await operation();
      await this.record(this.repository, reservation.cell.id, reservation.attempt.id, context.correlationId, step, "SUCCEEDED", resource.reference);
      return resource;
    } catch (error) {
      throw new ProvisioningStepError(step, error instanceof Error ? error.message : "provider-step-failed");
    }
  }

  private async record(
    repository: PlatformRepository,
    cellId: string,
    attemptId: string,
    correlationId: string,
    step: ProvisioningStep,
    result: ProvisioningResult,
    reference?: string,
    errorCode?: string
  ): Promise<void> {
    const occurredAt = new Date();
    await repository.appendProvisioningAction(attemptId, { step, result, reference, errorCode, occurredAt });
    await repository.addAuditEvent({
      id: `audit_${cellId}_${attemptId}_${step}_${occurredAt.getTime()}`,
      cellId,
      correlationId,
      action: step,
      result,
      occurredAt
    });
  }

  private async outcome(cell: CustomerCellRecord, attempt: ProvisioningAttemptRecord): Promise<ProvisioningOutcome> {
    return { cell, attempt, auditEvents: await this.repository.auditEventsForCell(cell.id) };
  }
}

export interface ProvisioningOutcome {
  cell: CustomerCellRecord;
  attempt: ProvisioningAttemptRecord;
  auditEvents: ControlPlaneAuditEventRecord[];
}

interface ProvisioningReservation {
  cell: CustomerCellRecord;
  attempt: ProvisioningAttemptRecord;
  shouldRun: boolean;
}

class ProvisioningStepError extends Error {
  public constructor(public readonly step: ProvisioningStep, message: string) {
    super(message);
  }
}

function requiredAttempt(attempts: Map<string, ProvisioningAttemptRecord>, attemptId: string): ProvisioningAttemptRecord {
  const attempt = attempts.get(attemptId);
  if (!attempt) throw new Error(`Unknown provisioning attempt ${attemptId}`);
  return attempt;
}

function requiredCell(cells: Map<string, CustomerCellRecord>, cellId: string): CustomerCellRecord {
  const cell = cells.get(cellId);
  if (!cell) throw new Error(`Unknown customer cell ${cellId}`);
  return cell;
}
