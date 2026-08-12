import type { CellProvider, CellProviderContext, ProviderReference } from "./providers/types";
import { ProvisioningLeaseLostError } from "./types";
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
  findCellByIdentity(cellId: string, cellKey: string): Promise<CustomerCellRecord | undefined>;
  findLatestAttemptForCell(cellId: string): Promise<ProvisioningAttemptRecord | undefined>;
  findProvisioningAttempt(attemptId: string): Promise<ProvisioningAttemptRecord | undefined>;
  reserveCustomerCell(request: ProvisioningRequest): Promise<{ cell: CustomerCellRecord; created: boolean }>;
  reserveProvisioningAttempt(cellId: string, idempotencyKey: string, correlationId: string): Promise<ProvisioningAttemptRecord>;
  claimProvisioningAttempt(attemptId: string, staleBefore: Date): Promise<ProvisioningAttemptRecord | undefined>;
  heartbeatProvisioningAttempt(attemptId: string, leaseVersion: number): Promise<ProvisioningAttemptRecord>;
  appendProvisioningAction(attemptId: string, leaseVersion: number, action: ProvisioningAction): Promise<ProvisioningAttemptRecord>;
  recordProvisioningResult(input: ProvisioningResultEvidence): Promise<ProvisioningAttemptRecord>;
  finalizeProvisioningSuccess(input: ProvisioningFinalization): Promise<{ cell: CustomerCellRecord; attempt: ProvisioningAttemptRecord }>;
  finalizeProvisioningFailure(input: ProvisioningFinalization): Promise<{ cell: CustomerCellRecord; attempt: ProvisioningAttemptRecord }>;
  setAttemptResult(attemptId: string, leaseVersion: number, result: ProvisioningResult): Promise<ProvisioningAttemptRecord>;
  updateCell(cellId: string, attemptId: string, leaseVersion: number, update: Partial<CustomerCellRecord>): Promise<CustomerCellRecord>;
  addAuditEvent(event: ControlPlaneAuditEventRecord): Promise<void>;
  upsertSignalLoopConnection(input: {
    cellId: string;
    attemptId: string;
    leaseVersion: number;
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

const PROVISIONING_CLAIM_LEASE_MS = 5 * 60 * 1000;
const PROVISIONING_HEARTBEAT_MS = 60 * 1000;
const PROVIDER_OPERATION_TIMEOUT_MS = 15 * 60 * 1000;

export function createInMemoryPlatformRepository(): InMemoryPlatformRepository {
  const cells = new Map<string, CustomerCellRecord>();
  const attempts = new Map<string, ProvisioningAttemptRecord>();
  const auditEvents: ControlPlaneAuditEventRecord[] = [];
  let nextId = 1;
  let transactionQueue = Promise.resolve();

  const repository: InMemoryPlatformRepository = {
    transaction: async <T>(operation: (repository: PlatformRepository) => Promise<T>) => {
      const execute = async () => {
        const cellSnapshot = [...cells.entries()].map(([id, cell]) => [id, { ...cell }] as const);
        const attemptSnapshot = [...attempts.entries()].map(([id, attempt]) => [id, { ...attempt, actions: attempt.actions.map((action) => ({ ...action })) }] as const);
        const auditSnapshot = auditEvents.map((event) => ({ ...event }));
        try {
          return await operation(repository);
        } catch (error) {
          cells.clear();
          cellSnapshot.forEach(([id, cell]) => cells.set(id, cell));
          attempts.clear();
          attemptSnapshot.forEach(([id, attempt]) => attempts.set(id, attempt));
          auditEvents.splice(0, auditEvents.length, ...auditSnapshot);
          throw error;
        }
      };
      const result = transactionQueue.then(execute, execute);
      transactionQueue = result.then(() => undefined, () => undefined);
      return result;
    },
    findCellByIdentity: async (cellId, cellKey) => {
      const cell = cells.get(cellId);
      return cell?.cellKey === cellKey ? cell : undefined;
    },
    findLatestAttemptForCell: async (cellId) =>
      [...attempts.values()].filter((attempt) => attempt.cellId === cellId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0],
    findProvisioningAttempt: async (attemptId) => attempts.get(attemptId),
    reserveCustomerCell: async (request) => {
      const existingById = cells.get(request.cellId);
      if (existingById) {
        if (existingById.cellKey !== request.cellKey) throw new Error("Customer cell identity mismatch");
        return { cell: existingById, created: false };
      }
      const existingByKey = [...cells.values()].find((cell) => cell.cellKey === request.cellKey);
      if (existingByKey) throw new Error("Customer cell identity mismatch");
      const now = new Date();
      const record: CustomerCellRecord = {
        id: request.cellId,
        cellKey: request.cellKey,
        legalName: request.legalName,
        displayName: request.displayName,
        region: request.region,
        desiredSubdomain: request.desiredSubdomain,
        planCode: request.planCode,
        allowedModules: [...request.allowedModules],
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
        leaseVersion: 1,
        result: "IN_PROGRESS",
        actions: [],
        createdAt: now,
        updatedAt: now
      };
      attempts.set(attempt.id, attempt);
      return attempt;
    },
    claimProvisioningAttempt: async (attemptId, staleBefore) => {
      const attempt = requiredAttempt(attempts, attemptId);
      const claimable = attempt.result === "FAILED"
        || (attempt.result === "IN_PROGRESS" && attempt.updatedAt.getTime() <= staleBefore.getTime());
      if (!claimable) return undefined;
      const claimedAttempt = {
        ...attempt,
        leaseVersion: attempt.leaseVersion + 1,
        result: "IN_PROGRESS" as const,
        actions: attempt.actions.map((action) => ({ ...action })),
        updatedAt: new Date()
      };
      attempts.set(attemptId, claimedAttempt);
      return claimedAttempt;
    },
    heartbeatProvisioningAttempt: async (attemptId, leaseVersion) => {
      const attempt = requiredLease(attempts, attemptId, leaseVersion);
      attempt.updatedAt = new Date();
      return attempt;
    },
    appendProvisioningAction: async (attemptId, leaseVersion, action) => {
      const attempt = requiredLease(attempts, attemptId, leaseVersion);
      attempt.actions.push(action);
      attempt.updatedAt = new Date();
      return attempt;
    },
    recordProvisioningResult: async ({ attemptId, leaseVersion, action, auditEvent }) => repository.transaction(async (transactionRepository) => {
      const attempt = await transactionRepository.appendProvisioningAction(attemptId, leaseVersion, action);
      await transactionRepository.addAuditEvent(auditEvent);
      return attempt;
    }),
    finalizeProvisioningSuccess: async ({ cellId, attemptId, leaseVersion, action, auditEvent, keepCellProvisioning }) => repository.transaction(async (transactionRepository) => {
      await transactionRepository.appendProvisioningAction(attemptId, leaseVersion, action);
      await transactionRepository.addAuditEvent(auditEvent);
      const cell = await transactionRepository.updateCell(cellId, attemptId, leaseVersion, keepCellProvisioning ? {} : { lifecycleStatus: "ACTIVE" });
      const attempt = await transactionRepository.setAttemptResult(attemptId, leaseVersion, "SUCCEEDED");
      return { cell, attempt };
    }),
    finalizeProvisioningFailure: async ({ cellId, attemptId, leaseVersion, action, auditEvent }) => repository.transaction(async (transactionRepository) => {
      await transactionRepository.appendProvisioningAction(attemptId, leaseVersion, action);
      await transactionRepository.addAuditEvent(auditEvent);
      const cell = await transactionRepository.updateCell(cellId, attemptId, leaseVersion, { lifecycleStatus: "PROVISIONING_FAILED" });
      const attempt = await transactionRepository.setAttemptResult(attemptId, leaseVersion, "FAILED");
      return { cell, attempt };
    }),
    setAttemptResult: async (attemptId, leaseVersion, result) => {
      const attempt = requiredLease(attempts, attemptId, leaseVersion);
      attempt.result = result;
      attempt.updatedAt = new Date();
      return attempt;
    },
    updateCell: async (cellId, attemptId, leaseVersion, update) => {
      const attempt = requiredLease(attempts, attemptId, leaseVersion);
      attempt.updatedAt = new Date();
      return updateCellRecord(cells, cellId, update);
    },
    addAuditEvent: async (event) => {
      auditEvents.push(event);
    },
    upsertSignalLoopConnection: async ({ attemptId, leaseVersion }) => {
      const attempt = requiredLease(attempts, attemptId, leaseVersion);
      attempt.updatedAt = new Date();
    },
    auditEventsForCell: async (cellId) => auditEvents.filter((event) => event.cellId === cellId),
    cells: () => [...cells.values()]
  };
  return repository;
}

export class CustomerCellProvisioner {
  public constructor(
    private readonly repository: PlatformRepository,
    private readonly provider: CellProvider,
    private readonly activation?: {
      activate(cell: CustomerCellRecord, attempt: ProvisioningAttemptRecord, request: ProvisioningRequest): Promise<CustomerCellRecord>;
    }
  ) {}

  public async provision(request: ProvisioningRequest): Promise<ProvisioningOutcome> {
    if (process.env.APP_MODE === "cell") {
      throw new Error("Customer-cell mode cannot run control-plane provisioning");
    }

    const reservation = await this.repository.transaction(async (repository) => {
      const existingCell = await repository.findCellByIdentity(request.cellId, request.cellKey);
      if (existingCell) {
        const existingAttempt = await repository.findLatestAttemptForCell(existingCell.id);
        if (!existingAttempt) throw new Error(`Customer cell ${existingCell.id} has no provisioning attempt`);
        const claimedAttempt = existingAttempt.result === "FAILED" || existingAttempt.result === "IN_PROGRESS"
          ? await repository.claimProvisioningAttempt(existingAttempt.id, this.staleClaimBoundary())
          : undefined;
        return { cell: existingCell, attempt: claimedAttempt ?? existingAttempt, shouldRun: Boolean(claimedAttempt) };
      }

      const reservation = await repository.reserveCustomerCell(request);
      if (!reservation.created) {
        const existingAttempt = await repository.findLatestAttemptForCell(reservation.cell.id);
        if (!existingAttempt) throw new Error(`Customer cell ${reservation.cell.id} has no provisioning attempt`);
        const claimedAttempt = existingAttempt.result === "FAILED" || existingAttempt.result === "IN_PROGRESS"
          ? await repository.claimProvisioningAttempt(existingAttempt.id, this.staleClaimBoundary())
          : undefined;
        return { cell: reservation.cell, attempt: claimedAttempt ?? existingAttempt, shouldRun: Boolean(claimedAttempt) };
      }
      const cell = reservation.cell;
      const attempt = await repository.reserveProvisioningAttempt(cell.id, request.idempotencyKey, request.correlationId);
      return { cell, attempt, shouldRun: true };
    });

    if (!reservation.shouldRun) return this.outcome(reservation.cell, reservation.attempt);

    const context: ProviderContextBase = {
      cellId: reservation.cell.id,
      cellKey: reservation.cell.cellKey,
      correlationId: request.correlationId
    };

    let currentStep: ProvisioningStep = "database";
    let secretReference: string | undefined;
    try {
      const database = await this.resourceFor(reservation, context, request, "database", (stepContext) => this.provider.createDatabase(stepContext));
      await this.persist("database", () => this.repository.updateCell(
        reservation.cell.id,
        reservation.attempt.id,
        reservation.attempt.leaseVersion,
        { databaseReference: database.reference }
      ));
      currentStep = "storage";
      const storage = await this.resourceFor(reservation, context, request, "storage", (stepContext) => this.provider.createStoragePrefix(stepContext));
      await this.persist("storage", () => this.repository.updateCell(
        reservation.cell.id,
        reservation.attempt.id,
        reservation.attempt.leaseVersion,
        { storageReference: storage.reference }
      ));
      currentStep = "secret-reference";
      const secret = await this.resourceFor(reservation, context, request, "secret-reference", (stepContext) => this.provider.createSecretReference(stepContext));
      secretReference = secret.reference;
      await this.persist("secret-reference", () => this.repository.updateCell(
        reservation.cell.id,
        reservation.attempt.id,
        reservation.attempt.leaseVersion,
        { secretReference }
      ));
      currentStep = "backup-policy";
      const backup = await this.resourceFor(reservation, context, request, "backup-policy", (stepContext) => this.provider.applyBackupPolicy(stepContext));
      await this.persist("backup-policy", () => this.repository.updateCell(
        reservation.cell.id,
        reservation.attempt.id,
        reservation.attempt.leaseVersion,
        { backupReference: backup.reference }
      ));
      currentStep = "application";
      const applicationReference = successfulReference(reservation.attempt, "application");
      const application = applicationReference && reservation.cell.applicationUrl
        ? { reference: applicationReference, applicationUrl: reservation.cell.applicationUrl }
        : await this.runStep(reservation, context, request, "application", (stepContext) => this.provider.deployApplication(stepContext));
      if (!isApplicationUrl(application.applicationUrl)) {
        throw new ProvisioningFailure("application", "APPLICATION_VALIDATION_FAILED", "invalid-application-url");
      }
      await this.persist("application", () => this.repository.updateCell(
        reservation.cell.id,
        reservation.attempt.id,
        reservation.attempt.leaseVersion,
        {
        applicationReference: application.reference,
        applicationUrl: application.applicationUrl
        }
      ));
      currentStep = "cell-initialization";
      await this.resourceFor(reservation, context, request, "cell-initialization", (stepContext) =>
        this.provider.initializeCellConfiguration(stepContext, {
          displayName: request.displayName,
          planCode: request.planCode,
          allowedModules: [...request.allowedModules],
          initialAdminEmail: request.initialAdminEmail
        })
      );
      currentStep = "signalloop-binding";
      const signalLoop = await this.resourceFor(reservation, context, request, "signalloop-binding", (stepContext) => this.provider.bindSignalLoopInstallation(stepContext));
      await this.persist("signalloop-binding", () => this.repository.updateCell(
        reservation.cell.id,
        reservation.attempt.id,
        reservation.attempt.leaseVersion,
        { signalLoopWorkspaceReference: signalLoop.reference }
      ));
      await this.persist("signalloop-binding", () => this.repository.upsertSignalLoopConnection({
        cellId: reservation.cell.id,
        attemptId: reservation.attempt.id,
        leaseVersion: reservation.attempt.leaseVersion,
        workspaceReference: signalLoop.reference,
        secretReference: secretReference ?? "",
        correlationId: request.correlationId,
        idempotencyKey: request.idempotencyKey
      }));

      currentStep = "health-check";
      reservation.attempt = await this.claimStep(reservation.attempt, "health-check");
      const health = await this.healthCheck(reservation.attempt, context);
      if (!health.healthy) throw new ProvisioningFailure("health-check", "HEALTH_CHECK_FAILED", health.detail ?? "health-check-failed");
      let finalization: { cell: CustomerCellRecord; attempt: ProvisioningAttemptRecord };
      try {
        finalization = await this.repository.finalizeProvisioningSuccess({
          cellId: reservation.cell.id,
          attemptId: reservation.attempt.id,
          leaseVersion: reservation.attempt.leaseVersion,
          ...this.resultEvidence(reservation.cell.id, reservation.attempt.id, request, "health-check", "SUCCEEDED", undefined, undefined, undefined, secretReference),
          keepCellProvisioning: Boolean(this.activation)
        });
      } catch (error) {
        const committed = await this.committedFinalization(reservation.cell, reservation.attempt.id);
        if (committed) return this.outcome(committed.cell, committed.attempt);
        throw new ProvisioningFailure("health-check", "REPOSITORY_PERSISTENCE_FAILED", errorMessage(error));
      }
      reservation.attempt = finalization.attempt;
      if (this.activation) {
        const activated = await this.activation.activate(finalization.cell, finalization.attempt, request);
        return this.outcome(activated, reservation.attempt);
      }
      return this.outcome(finalization.cell, reservation.attempt);
    } catch (error) {
      if (error instanceof ProvisioningLeaseLostError) {
        return this.outcome(reservation.cell, reservation.attempt);
      }
      const failure = error instanceof ProvisioningFailure
        ? error
        : new ProvisioningFailure(currentStep, "REPOSITORY_PERSISTENCE_FAILED", errorMessage(error));
      try {
        const finalization = await this.repository.finalizeProvisioningFailure({
          cellId: reservation.cell.id,
          attemptId: reservation.attempt.id,
          leaseVersion: reservation.attempt.leaseVersion,
          ...this.resultEvidence(
            reservation.cell.id,
            reservation.attempt.id,
            request,
            failure.step,
            "FAILED",
            undefined,
            failure.errorCode,
            failure.message,
            secretReference
          )
        });
        reservation.attempt = finalization.attempt;
        return this.outcome(finalization.cell, reservation.attempt);
      } catch (finalizationError) {
        if (finalizationError instanceof ProvisioningLeaseLostError) {
          return this.outcome(reservation.cell, reservation.attempt);
        }
        throw finalizationError;
      }
    }
  }

  private async runStep<T extends ProviderReference>(
    reservation: ProvisioningReservation,
    context: ProviderContextBase,
    request: ProvisioningRequest,
    step: Exclude<ProvisioningStep, "health-check">,
    operation: (context: CellProviderContext) => Promise<T>
  ): Promise<T> {
    reservation.attempt = await this.claimStep(reservation.attempt, step);
    let resource: T;
    try {
      resource = await this.callProvider(reservation.attempt, context, step, operation);
    } catch (error) {
      if (error instanceof ProvisioningLeaseLostError || error instanceof ProvisioningFailure) throw error;
      throw new ProvisioningFailure(step, "PROVIDER_OPERATION_FAILED", errorMessage(error));
    }
    reservation.attempt = await this.record(
      this.repository,
      reservation.cell.id,
      reservation.attempt.id,
      reservation.attempt.leaseVersion,
      request,
      step,
      "SUCCEEDED",
      resource.reference
    );
    return resource;
  }

  private async resourceFor<T extends ProviderReference>(
    reservation: ProvisioningReservation,
    context: ProviderContextBase,
    request: ProvisioningRequest,
    step: Exclude<ProvisioningStep, "health-check">,
    operation: (context: CellProviderContext) => Promise<T>
  ): Promise<T> {
    const reference = successfulReference(reservation.attempt, step);
    return reference ? ({ reference } as T) : this.runStep(reservation, context, request, step, operation);
  }

  private async healthCheck(attempt: ProvisioningAttemptRecord, context: ProviderContextBase) {
    try {
      return await this.callProvider(attempt, context, "health-check", (stepContext) => this.provider.healthCheck(stepContext));
    } catch (error) {
      if (error instanceof ProvisioningLeaseLostError || error instanceof ProvisioningFailure) throw error;
      throw new ProvisioningFailure("health-check", "HEALTH_CHECK_FAILED", errorMessage(error));
    }
  }

  private async callProvider<T>(
    attempt: ProvisioningAttemptRecord,
    context: ProviderContextBase,
    step: ProvisioningStep,
    operation: (context: CellProviderContext) => Promise<T>
  ): Promise<T> {
    const controller = new AbortController();
    const deadline = new Date(Date.now() + PROVIDER_OPERATION_TIMEOUT_MS);
    let active = true;
    let heartbeatInFlight = false;
    let rejectGuard!: (error: unknown) => void;
    const guard = new Promise<never>((_resolve, reject) => {
      rejectGuard = reject;
    });
    const failGuard = (error: unknown) => {
      if (!active) return;
      controller.abort(error);
      rejectGuard(error);
    };
    const heartbeat = setInterval(() => {
      if (!active || heartbeatInFlight) return;
      heartbeatInFlight = true;
      void this.repository.heartbeatProvisioningAttempt(attempt.id, attempt.leaseVersion)
        .catch((error: unknown) => {
          failGuard(error instanceof ProvisioningLeaseLostError
            ? error
            : new ProvisioningFailure(step, "REPOSITORY_PERSISTENCE_FAILED", errorMessage(error)));
        })
        .finally(() => {
          heartbeatInFlight = false;
        });
    }, PROVISIONING_HEARTBEAT_MS);
    const timeout = setTimeout(() => {
      failGuard(new ProvisioningFailure(step, "PROVIDER_OPERATION_FAILED", `Provider operation deadline exceeded for ${step}`));
    }, PROVIDER_OPERATION_TIMEOUT_MS);

    try {
      const providerCall = Promise.resolve().then(() => operation(this.stepContext(context, attempt, step, controller.signal, deadline)));
      return await Promise.race([providerCall, guard]);
    } finally {
      active = false;
      clearInterval(heartbeat);
      clearTimeout(timeout);
    }
  }

  private async claimStep(attempt: ProvisioningAttemptRecord, step: ProvisioningStep): Promise<ProvisioningAttemptRecord> {
    return this.persist(step, () => this.repository.appendProvisioningAction(attempt.id, attempt.leaseVersion, {
      step,
      result: "IN_PROGRESS",
      occurredAt: new Date()
    }));
  }

  private stepContext(
    context: ProviderContextBase,
    attempt: ProvisioningAttemptRecord,
    step: ProvisioningStep,
    signal: AbortSignal,
    deadline: Date
  ): CellProviderContext {
    return {
      ...context,
      idempotencyKey: `cell/${context.cellId}/attempt/${attempt.id}/step/${step}`,
      leaseVersion: attempt.leaseVersion,
      fencingToken: `attempt/${attempt.id}/lease/${attempt.leaseVersion}`,
      signal,
      deadline
    };
  }

  private async persist<T>(step: ProvisioningStep, operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof ProvisioningLeaseLostError) throw error;
      throw new ProvisioningFailure(step, "REPOSITORY_PERSISTENCE_FAILED", errorMessage(error));
    }
  }

  private async record(
    repository: PlatformRepository,
    cellId: string,
    attemptId: string,
    leaseVersion: number,
    request: ProvisioningRequest,
    step: ProvisioningStep,
    result: ProvisioningResult,
    reference?: string,
    errorCode?: string,
    errorReason?: string,
    secretReference?: string
  ): Promise<ProvisioningAttemptRecord> {
    const evidence = this.resultEvidence(cellId, attemptId, request, step, result, reference, errorCode, errorReason, secretReference);
    try {
      return await repository.recordProvisioningResult({
        attemptId,
        leaseVersion,
        ...evidence
      });
    } catch (error) {
      if (error instanceof ProvisioningLeaseLostError) throw error;
      throw new ProvisioningFailure(step, "AUDIT_PERSISTENCE_FAILED", errorMessage(error));
    }
  }

  private resultEvidence(
    cellId: string,
    attemptId: string,
    request: ProvisioningRequest,
    step: ProvisioningStep,
    result: ProvisioningResult,
    reference?: string,
    errorCode?: string,
    errorReason?: string,
    secretReference?: string
  ): Pick<ProvisioningResultEvidence, "action" | "auditEvent"> {
    const occurredAt = new Date();
    return {
      action: { step, result, reference, errorCode, occurredAt },
      auditEvent: {
        id: `audit_${cellId}_${attemptId}_${step}_${result}_${occurredAt.getTime()}`,
        cellId,
        correlationId: request.correlationId,
        action: step,
        result,
        actor: request.actor,
        reason: request.reason,
        error: errorReason,
        errorCode,
        secretReference: secretReference ?? (step === "secret-reference" ? reference : undefined),
        occurredAt
      }
    };
  }

  private async outcome(cell: CustomerCellRecord, attempt: ProvisioningAttemptRecord): Promise<ProvisioningOutcome> {
    const currentAttempt = await this.repository.findProvisioningAttempt(attempt.id);
    return { cell, attempt: currentAttempt ?? attempt, auditEvents: await this.repository.auditEventsForCell(cell.id) };
  }

  private staleClaimBoundary(): Date {
    return new Date(Date.now() - PROVISIONING_CLAIM_LEASE_MS);
  }

  private async committedFinalization(
    reservedCell: CustomerCellRecord,
    attemptId: string
  ): Promise<{ cell: CustomerCellRecord; attempt: ProvisioningAttemptRecord } | undefined> {
    try {
      const [cell, attempt] = await Promise.all([
        this.repository.findCellByIdentity(reservedCell.id, reservedCell.cellKey),
        this.repository.findProvisioningAttempt(attemptId)
      ]);
      const healthEvidenceCommitted = attempt?.actions.some(
        (action) => action.step === "health-check" && action.result === "SUCCEEDED"
      );
      return cell?.lifecycleStatus === "ACTIVE" && attempt?.result === "SUCCEEDED" && healthEvidenceCommitted
        ? { cell, attempt }
        : undefined;
    } catch {
      return undefined;
    }
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

type ProviderContextBase = Pick<CellProviderContext, "cellId" | "cellKey" | "correlationId">;

export interface ProvisioningResultEvidence {
  attemptId: string;
  leaseVersion: number;
  action: ProvisioningAction;
  auditEvent: ControlPlaneAuditEventRecord;
}

export interface ProvisioningFinalization extends ProvisioningResultEvidence {
  cellId: string;
  keepCellProvisioning?: boolean;
}

class ProvisioningFailure extends Error {
  public constructor(
    public readonly step: ProvisioningStep,
    public readonly errorCode: "PROVIDER_OPERATION_FAILED" | "HEALTH_CHECK_FAILED" | "APPLICATION_VALIDATION_FAILED" | "REPOSITORY_PERSISTENCE_FAILED" | "AUDIT_PERSISTENCE_FAILED",
    message: string
  ) {
    super(message);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown-provisioning-error";
}

function successfulReference(attempt: ProvisioningAttemptRecord, step: Exclude<ProvisioningStep, "health-check">): string | undefined {
  return [...attempt.actions].reverse().find((action) => action.step === step && action.result === "SUCCEEDED")?.reference;
}

function requiredAttempt(attempts: Map<string, ProvisioningAttemptRecord>, attemptId: string): ProvisioningAttemptRecord {
  const attempt = attempts.get(attemptId);
  if (!attempt) throw new Error(`Unknown provisioning attempt ${attemptId}`);
  return attempt;
}

function requiredLease(
  attempts: Map<string, ProvisioningAttemptRecord>,
  attemptId: string,
  leaseVersion: number
): ProvisioningAttemptRecord {
  const attempt = requiredAttempt(attempts, attemptId);
  if (attempt.result !== "IN_PROGRESS" || attempt.leaseVersion !== leaseVersion) {
    throw new ProvisioningLeaseLostError(attemptId);
  }
  return attempt;
}

function requiredCell(cells: Map<string, CustomerCellRecord>, cellId: string): CustomerCellRecord {
  const cell = cells.get(cellId);
  if (!cell) throw new Error(`Unknown customer cell ${cellId}`);
  return cell;
}

function updateCellRecord(
  cells: Map<string, CustomerCellRecord>,
  cellId: string,
  update: Partial<CustomerCellRecord>
): CustomerCellRecord {
  const cell = requiredCell(cells, cellId);
  const mutableUpdate = { ...update };
  delete mutableUpdate.id;
  delete mutableUpdate.cellKey;
  delete mutableUpdate.createdAt;
  delete mutableUpdate.updatedAt;
  Object.assign(cell, mutableUpdate, { updatedAt: new Date() });
  return cell;
}

function isApplicationUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}
