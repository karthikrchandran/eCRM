import { describe, expect, it } from "vitest";

import { LocalCellProvider } from "./providers/local-driver";
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
  correlationId: "corr-ara-1"
};

describe("CustomerCellProvisioner", () => {
  it("runs every provider operation once across a successful duplicate idempotency retry", async () => {
    const repository = createInMemoryPlatformRepository();
    const provider = new CountingLocalCellProvider();
    const provisioner = new CustomerCellProvisioner(repository, provider);

    const first = await provisioner.provision(request);
    const second = await provisioner.provision(request);

    expect(second.cell.id).toBe(first.cell.id);
    expect(first.cell).toMatchObject({ id: request.cellId, cellKey: request.cellKey });
    expect(second.cell.lifecycleStatus).toBe("ACTIVE");
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

  it("returns the durable health failure on retry without creating a second cell or rerunning providers", async () => {
    const repository = createInMemoryPlatformRepository();
    const provider = new CountingLocalCellProvider({ health: "unhealthy" });
    const provisioner = new CustomerCellProvisioner(repository, provider);

    const first = await provisioner.provision(request);
    const operationCallsAfterFailure = { ...provider.operationCalls };
    const second = await provisioner.provision(request);

    expect(first.cell.lifecycleStatus).toBe("PROVISIONING_FAILED");
    expect(second.cell.lifecycleStatus).toBe("PROVISIONING_FAILED");
    expect(second.attempt.id).toBe(first.attempt.id);
    expect(repository.cells()).toHaveLength(1);
    expect(provider.operationCalls).toEqual(operationCallsAfterFailure);
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
