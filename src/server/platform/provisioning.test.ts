import { afterEach, describe, expect, it, vi } from "vitest";

import { LocalCellProvider } from "./providers/local-driver";
import { ProductionCellProvider } from "./providers/production-driver";
import {
  createInMemoryPlatformRepository,
  CustomerCellProvisioner,
  type PlatformRepository
} from "./provisioning";

const request = {
  cellId: "cell_ara_global",
  cellKey: "ara-global",
  legalName: "ARA Global LLC",
  displayName: "ARA Global",
  region: "us-east-1",
  desiredSubdomain: "ara-global",
  initialAdminEmail: "admin@ara.example",
  idempotencyKey: "onboard-ara-global-1",
  correlationId: "corr-ara-1",
  actor: "operator:karthik",
  reason: "initial customer-cell onboarding"
};

describe("CustomerCellProvisioner", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs every provider operation once across a successful duplicate idempotency retry", async () => {
    const repository = createInMemoryPlatformRepository();
    const provider = new CountingLocalCellProvider();
    const provisioner = new CustomerCellProvisioner(repository, provider);

    const first = await provisioner.provision(request);
    const second = await provisioner.provision(request);

    expect(second.cell.id).toBe(first.cell.id);
    expect(first.cell).toMatchObject({ id: request.cellId, cellKey: request.cellKey });
    expect(second.cell.lifecycleStatus).toBe("ACTIVE");
    expect(second.attempt.result).toBe("SUCCEEDED");
    expect(second.attempt.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ step: "database", result: "SUCCEEDED" }),
        expect.objectContaining({ step: "health-check", result: "SUCCEEDED" })
      ])
    );
    expect(repository.cells()).toHaveLength(1);
    expect(provider.operationCalls).toEqual({
      database: 1,
      storage: 1,
      secretReference: 1,
      backup: 1,
      application: 1,
      signalLoop: 1,
      health: 1
    });
  });

  it("reuses the same provider resource when recording its result fails", async () => {
    const repository = createInMemoryPlatformRepository();
    const appendProvisioningAction = repository.appendProvisioningAction.bind(repository);
    let rejectedDatabaseResult = false;
    repository.appendProvisioningAction = async (attemptId, action) => {
      if (action.step === "database" && action.result === "SUCCEEDED" && !rejectedDatabaseResult) {
        rejectedDatabaseResult = true;
        throw new Error("database result persistence unavailable");
      }
      return appendProvisioningAction(attemptId, action);
    };
    const provider = new IdempotentCountingProvider();
    const provisioner = new CustomerCellProvisioner(repository, provider);

    const first = await provisioner.provision(request);
    expect(first.cell.lifecycleStatus).toBe("PROVISIONING_FAILED");
    const second = await provisioner.provision(request);

    expect(second.cell.lifecycleStatus).toBe("ACTIVE");
    expect(provider.databaseCalls).toBe(2);
    expect(provider.databaseCreations).toBe(1);
    expect(provider.databaseIdempotencyKeys).toEqual([
      `cell/${request.cellId}/attempt/${first.attempt.id}/step/database`,
      `cell/${request.cellId}/attempt/${first.attempt.id}/step/database`
    ]);
  });

  it("reuses the application resource when updating the cell fails after deployment", async () => {
    const repository = createInMemoryPlatformRepository();
    const updateCell = repository.updateCell.bind(repository);
    let rejectedApplicationUpdate = false;
    repository.updateCell = async (cellId, update) => {
      if (update.applicationReference && !rejectedApplicationUpdate) {
        rejectedApplicationUpdate = true;
        throw new Error("application cell update unavailable");
      }
      return updateCell(cellId, update);
    };
    const provider = new IdempotentCountingProvider();
    const provisioner = new CustomerCellProvisioner(repository, provider);

    const first = await provisioner.provision(request);
    expect(first.cell.lifecycleStatus).toBe("PROVISIONING_FAILED");
    const second = await provisioner.provision(request);

    expect(second.cell.lifecycleStatus).toBe("ACTIVE");
    expect(provider.applicationCalls).toBe(2);
    expect(provider.applicationCreations).toBe(1);
    expect(provider.applicationIdempotencyKeys).toEqual([
      `cell/${request.cellId}/attempt/${first.attempt.id}/step/application`,
      `cell/${request.cellId}/attempt/${first.attempt.id}/step/application`
    ]);
  });

  it("persists references returned by configured production adapters", async () => {
    const repository = createInMemoryPlatformRepository();
    const provisioner = new CustomerCellProvisioner(
      repository,
      new ProductionCellProvider({
        config: productionConfig(),
        adapters: {
          createDatabase: async () => ({ reference: "database://ara" }),
          createStoragePrefix: async () => ({ reference: "storage://ara" }),
          createSecretReference: async () => ({ reference: "vault://ara/credential" }),
          applyBackupPolicy: async () => ({ reference: "backup://ara" }),
          deployApplication: async () => ({ reference: "application://ara", applicationUrl: "https://ara.example.test" }),
          bindSignalLoopInstallation: async () => ({ reference: "signalloop://ara" }),
          healthCheck: async () => ({ healthy: true })
        }
      })
    );

    const result = await provisioner.provision({ ...request, cellId: "cell_production_ara", idempotencyKey: "onboard-production-ara" });

    expect(result.cell).toMatchObject({
      databaseReference: "database://ara",
      storageReference: "storage://ara",
      secretReference: "vault://ara/credential",
      backupReference: "backup://ara",
      applicationReference: "application://ara",
      applicationUrl: "https://ara.example.test",
      signalLoopWorkspaceReference: "signalloop://ara"
    });
  });

  it("rejects a request whose cell ID is already bound to a different durable cell key", async () => {
    const repository = createInMemoryPlatformRepository();
    const provisioner = new CustomerCellProvisioner(repository, new LocalCellProvider());

    await provisioner.provision(request);

    await expect(repository.findCellByIdentity(request.cellId, "other-customer")).resolves.toBeUndefined();
    await expect(provisioner.provision({ ...request, cellKey: "other-customer" })).rejects.toThrow(
      /identity mismatch/i
    );
    expect(repository.cells()).toHaveLength(1);
  });

  it("does not activate a cell when the provider result lacks a valid application URL", async () => {
    const repository = createInMemoryPlatformRepository();
    const provisioner = new CustomerCellProvisioner(repository, new InvalidApplicationUrlProvider());

    const result = await provisioner.provision(request);

    expect(result.cell.lifecycleStatus).toBe("PROVISIONING_FAILED");
    expect(result.cell.applicationUrl).toBeUndefined();
  });

  it("marks the cell PROVISIONING_FAILED and records durable evidence when health fails", async () => {
    const repository = createInMemoryPlatformRepository();
    const provisioner = new CustomerCellProvisioner(repository, new LocalCellProvider({ health: "unhealthy" }));

    const result = await provisioner.provision(request);

    expect(result.cell.lifecycleStatus).toBe("PROVISIONING_FAILED");
    expect(result.auditEvents.some((event) => event.action === "health-check" && event.result === "FAILED")).toBe(true);
    expect(result.attempt.actions.some((action) => action.step === "health-check" && action.result === "FAILED")).toBe(true);
  });

  it("retries a failed health check with the same durable cell identity", async () => {
    const repository = createInMemoryPlatformRepository();
    const provider = new RecoveringHealthProvider();
    const provisioner = new CustomerCellProvisioner(repository, provider);

    const first = await provisioner.provision(request);
    expect(first.cell.lifecycleStatus).toBe("PROVISIONING_FAILED");
    const second = await provisioner.provision(request);

    expect(second.cell.lifecycleStatus).toBe("ACTIVE");
    expect(second.attempt.id).toBe(first.attempt.id);
    expect(repository.cells()).toHaveLength(1);
    expect(provider.operationCalls).toEqual({
      database: 1,
      storage: 1,
      secretReference: 1,
      backup: 1,
      application: 1,
      signalLoop: 1,
      health: 2
    });
  });

  it("atomically claims a failed attempt so concurrent callers cannot both retry it", async () => {
    const repository = createInMemoryPlatformRepository();
    const provider = new RecoveringHealthProvider();
    const provisioner = new CustomerCellProvisioner(repository, provider);

    const first = await provisioner.provision(request);
    expect(first.cell.lifecycleStatus).toBe("PROVISIONING_FAILED");

    const retries = await Promise.all([provisioner.provision(request), provisioner.provision(request)]);

    expect(retries.some((outcome) => outcome.cell.lifecycleStatus === "ACTIVE")).toBe(true);
    expect(provider.operationCalls.health).toBe(2);
  });

  it("does not claim an active in-progress provisioning lease", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T12:00:00Z"));
    const repository = createInMemoryPlatformRepository();
    const attempt = await seedInterruptedAttempt(repository);
    const provider = new IdempotentCountingProvider();
    const provisioner = new CustomerCellProvisioner(repository, provider);

    vi.setSystemTime(new Date("2026-08-11T12:04:59Z"));
    const result = await provisioner.provision(request);

    expect(result.attempt.id).toBe(attempt.id);
    expect(result.attempt.result).toBe("IN_PROGRESS");
    expect(provider.databaseCalls).toBe(0);
    expect(provider.storageCalls).toBe(0);
  });

  it("claims a stale in-progress attempt and resumes from its durable step evidence", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T12:00:00Z"));
    const repository = createInMemoryPlatformRepository();
    const attempt = await seedInterruptedAttempt(repository);
    const provider = new IdempotentCountingProvider();
    const provisioner = new CustomerCellProvisioner(repository, provider);

    vi.setSystemTime(new Date("2026-08-11T12:05:00Z"));
    const result = await provisioner.provision(request);

    expect(result.cell.lifecycleStatus).toBe("ACTIVE");
    expect(result.attempt.id).toBe(attempt.id);
    expect(provider.databaseCalls).toBe(0);
    expect(provider.storageCalls).toBe(1);
    expect(provider.storageIdempotencyKeys).toEqual([
      `cell/${request.cellId}/attempt/${attempt.id}/step/storage`
    ]);
  });

  it("allows only one concurrent caller to claim a stale in-progress attempt", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T12:00:00Z"));
    const repository = createInMemoryPlatformRepository();
    await seedInterruptedAttempt(repository);
    const provider = new IdempotentCountingProvider();
    const provisioner = new CustomerCellProvisioner(repository, provider);

    vi.setSystemTime(new Date("2026-08-11T12:05:00Z"));
    const results = await Promise.all([provisioner.provision(request), provisioner.provision(request)]);

    expect(results.some((result) => result.cell.lifecycleStatus === "ACTIVE")).toBe(true);
    expect(provider.storageCalls).toBe(1);
  });

  it("returns success when finalization committed but its acknowledgement was lost", async () => {
    const repository = createInMemoryPlatformRepository();
    const finalizeProvisioningSuccess = repository.finalizeProvisioningSuccess.bind(repository);
    repository.finalizeProvisioningSuccess = async (input) => {
      await finalizeProvisioningSuccess(input);
      throw new Error("finalization acknowledgement lost");
    };
    const provisioner = new CustomerCellProvisioner(repository, new LocalCellProvider());

    const result = await provisioner.provision(request);

    expect(result.cell.lifecycleStatus).toBe("ACTIVE");
    expect(result.attempt.result).toBe("SUCCEEDED");
    expect(result.attempt.actions).toContainEqual(expect.objectContaining({ step: "health-check", result: "SUCCEEDED" }));
    expect(result.attempt.actions).not.toContainEqual(expect.objectContaining({ step: "health-check", result: "FAILED" }));
  });

  it("records retryable failure when finalization actually rolled back", async () => {
    const repository = createInMemoryPlatformRepository();
    const updateCell = repository.updateCell.bind(repository);
    let rejectActivation = true;
    repository.updateCell = async (cellId, update) => {
      if (update.lifecycleStatus === "ACTIVE" && rejectActivation) {
        rejectActivation = false;
        throw new Error("activation write rolled back");
      }
      return updateCell(cellId, update);
    };
    const provisioner = new CustomerCellProvisioner(repository, new LocalCellProvider());

    const result = await provisioner.provision(request);

    expect(result.cell.lifecycleStatus).toBe("PROVISIONING_FAILED");
    expect(result.attempt.result).toBe("FAILED");
    expect(result.attempt.actions).toContainEqual(
      expect.objectContaining({ step: "health-check", result: "FAILED", errorCode: "REPOSITORY_PERSISTENCE_FAILED" })
    );
    expect(result.attempt.actions).not.toContainEqual(expect.objectContaining({ step: "health-check", result: "SUCCEEDED" }));
  });

  it("records repository persistence failure at the actual step and safely retries it", async () => {
    const repository = createInMemoryPlatformRepository();
    const upsertSignalLoopConnection = repository.upsertSignalLoopConnection.bind(repository);
    let connectionWrites = 0;
    repository.upsertSignalLoopConnection = async (input) => {
      connectionWrites += 1;
      if (connectionWrites === 1) throw new Error("connection persistence unavailable");
      await upsertSignalLoopConnection(input);
    };
    const provisioner = new CustomerCellProvisioner(repository, new LocalCellProvider());

    const first = await provisioner.provision(request);
    const second = await provisioner.provision(request);

    expect(first.attempt.actions).toContainEqual(
      expect.objectContaining({ step: "signalloop-binding", result: "FAILED", errorCode: "REPOSITORY_PERSISTENCE_FAILED" })
    );
    expect(first.auditEvents).toContainEqual(
      expect.objectContaining({
        action: "signalloop-binding",
        result: "FAILED",
        reason: request.reason,
        error: "connection persistence unavailable",
        errorCode: "REPOSITORY_PERSISTENCE_FAILED"
      })
    );
    expect(new Set(first.auditEvents.map((event) => event.id)).size).toBe(first.auditEvents.length);
    expect(second.cell.lifecycleStatus).toBe("ACTIVE");
    expect(repository.cells()).toHaveLength(1);
    expect(connectionWrites).toBe(2);
  });

  it("persists the audit actor, request reason, failure details, and secret reference", async () => {
    const repository = createInMemoryPlatformRepository();
    const provisioner = new CustomerCellProvisioner(repository, new LocalCellProvider({ health: "unhealthy" }));

    const result = await provisioner.provision(request);

    expect(result.auditEvents).toContainEqual(
      expect.objectContaining({
        action: "secret-reference",
        actor: request.actor,
        reason: request.reason,
        secretReference: "local://secret/ara-global"
      })
    );
    expect(result.auditEvents).toContainEqual(
      expect.objectContaining({
        action: "health-check",
        result: "FAILED",
        actor: request.actor,
        reason: request.reason,
        error: "configured-local-health-failure",
        errorCode: "HEALTH_CHECK_FAILED"
      })
    );
  });

  it("records an audit persistence failure without replacing the request reason", async () => {
    const repository = createInMemoryPlatformRepository();
    const addAuditEvent = repository.addAuditEvent.bind(repository);
    let auditWrites = 0;
    repository.addAuditEvent = async (event) => {
      auditWrites += 1;
      if (auditWrites === 1) throw new Error("audit store unavailable");
      await addAuditEvent(event);
    };
    const provisioner = new CustomerCellProvisioner(repository, new LocalCellProvider());

    const result = await provisioner.provision(request);

    expect(result.cell.lifecycleStatus).toBe("PROVISIONING_FAILED");
    expect(result.auditEvents).toContainEqual(
      expect.objectContaining({
        action: "database",
        result: "FAILED",
        reason: request.reason,
        error: "audit store unavailable",
        errorCode: "AUDIT_PERSISTENCE_FAILED"
      })
    );
  });

  it("rejects cell-mode provisioning before any repository or provider call", async () => {
    const originalAppMode = process.env.APP_MODE;
    let repositoryCalls = 0;
    const repository = createInMemoryPlatformRepository();
    const transaction = repository.transaction.bind(repository);
    repository.transaction = async <T>(operation: (innerRepository: PlatformRepository) => Promise<T>) => {
        repositoryCalls += 1;
        return transaction(operation);
      };
    const provider = new CountingLocalCellProvider();
    const provisioner = new CustomerCellProvisioner(repository, provider);

    process.env.APP_MODE = "cell";
    try {
      await expect(provisioner.provision(request)).rejects.toThrow("Customer-cell mode cannot run control-plane provisioning");
    } finally {
      if (originalAppMode === undefined) delete process.env.APP_MODE;
      else process.env.APP_MODE = originalAppMode;
    }

    expect(repositoryCalls).toBe(0);
    expect(provider.operationCalls).toEqual({
      database: 0,
      storage: 0,
      secretReference: 0,
      backup: 0,
      application: 0,
      signalLoop: 0,
      health: 0
    });
  });
});

class CountingLocalCellProvider extends LocalCellProvider {
  public operationCalls = {
    database: 0,
    storage: 0,
    secretReference: 0,
    backup: 0,
    application: 0,
    signalLoop: 0,
    health: 0
  };

  public override async createDatabase(context: Parameters<LocalCellProvider["createDatabase"]>[0]) {
    this.operationCalls.database += 1;
    return super.createDatabase(context);
  }

  public override async createStoragePrefix(context: Parameters<LocalCellProvider["createStoragePrefix"]>[0]) {
    this.operationCalls.storage += 1;
    return super.createStoragePrefix(context);
  }

  public override async createSecretReference(context: Parameters<LocalCellProvider["createSecretReference"]>[0]) {
    this.operationCalls.secretReference += 1;
    return super.createSecretReference(context);
  }

  public override async applyBackupPolicy(context: Parameters<LocalCellProvider["applyBackupPolicy"]>[0]) {
    this.operationCalls.backup += 1;
    return super.applyBackupPolicy(context);
  }

  public override async deployApplication(context: Parameters<LocalCellProvider["deployApplication"]>[0]) {
    this.operationCalls.application += 1;
    return super.deployApplication(context);
  }

  public override async bindSignalLoopInstallation(context: Parameters<LocalCellProvider["bindSignalLoopInstallation"]>[0]) {
    this.operationCalls.signalLoop += 1;
    return super.bindSignalLoopInstallation(context);
  }

  public override async healthCheck(context: Parameters<LocalCellProvider["healthCheck"]>[0]) {
    this.operationCalls.health += 1;
    return super.healthCheck(context);
  }
}

class InvalidApplicationUrlProvider extends LocalCellProvider {
  public override async deployApplication(context: Parameters<LocalCellProvider["deployApplication"]>[0]) {
    const application = await super.deployApplication(context);
    return { ...application, applicationUrl: "not-a-valid-url" };
  }
}

class RecoveringHealthProvider extends CountingLocalCellProvider {
  public override async healthCheck(context: Parameters<LocalCellProvider["healthCheck"]>[0]) {
    void context;
    this.operationCalls.health += 1;
    return this.operationCalls.health === 1
      ? { healthy: false, detail: "transient-health-failure" }
      : { healthy: true };
  }
}

class IdempotentCountingProvider extends LocalCellProvider {
  public databaseCalls = 0;
  public databaseCreations = 0;
  public databaseIdempotencyKeys: string[] = [];
  public storageCalls = 0;
  public storageIdempotencyKeys: string[] = [];
  public applicationCalls = 0;
  public applicationCreations = 0;
  public applicationIdempotencyKeys: string[] = [];
  private readonly databaseReferences = new Map<string, { reference: string }>();
  private readonly applicationReferences = new Map<string, { reference: string; applicationUrl: string }>();

  public override async createDatabase(context: Parameters<LocalCellProvider["createDatabase"]>[0]) {
    this.databaseCalls += 1;
    this.databaseIdempotencyKeys.push(context.idempotencyKey);
    const existing = this.databaseReferences.get(context.idempotencyKey);
    if (existing) return existing;
    this.databaseCreations += 1;
    const created = await super.createDatabase(context);
    this.databaseReferences.set(context.idempotencyKey, created);
    return created;
  }

  public override async createStoragePrefix(context: Parameters<LocalCellProvider["createStoragePrefix"]>[0]) {
    this.storageCalls += 1;
    this.storageIdempotencyKeys.push(context.idempotencyKey);
    return super.createStoragePrefix(context);
  }

  public override async deployApplication(context: Parameters<LocalCellProvider["deployApplication"]>[0]) {
    this.applicationCalls += 1;
    this.applicationIdempotencyKeys.push(context.idempotencyKey);
    const existing = this.applicationReferences.get(context.idempotencyKey);
    if (existing) return existing;
    this.applicationCreations += 1;
    const created = await super.deployApplication(context);
    this.applicationReferences.set(context.idempotencyKey, created);
    return created;
  }
}

async function seedInterruptedAttempt(repository: PlatformRepository) {
  const reservation = await repository.reserveCustomerCell(request);
  const attempt = await repository.reserveProvisioningAttempt(
    reservation.cell.id,
    request.idempotencyKey,
    request.correlationId
  );
  await repository.appendProvisioningAction(attempt.id, {
    step: "database",
    result: "SUCCEEDED",
    reference: "local://postgres/ara-global",
    occurredAt: new Date()
  });
  return repository.appendProvisioningAction(attempt.id, {
    step: "storage",
    result: "IN_PROGRESS",
    occurredAt: new Date()
  });
}

function productionConfig() {
  return {
    databaseEndpoint: "https://database.example.test",
    databaseCredentialReference: "vault://platform/database",
    storageEndpoint: "https://storage.example.test",
    storageCredentialReference: "vault://platform/storage",
    secretEndpoint: "https://secrets.example.test",
    secretCredentialReference: "vault://platform/secrets",
    backupEndpoint: "https://backup.example.test",
    backupCredentialReference: "vault://platform/backup",
    applicationEndpoint: "https://application.example.test",
    applicationCredentialReference: "vault://platform/application",
    signalLoopEndpoint: "https://signalloop.example.test",
    signalLoopCredentialReference: "vault://platform/signalloop"
  };
}
