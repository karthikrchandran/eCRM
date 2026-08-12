import { describe, expect, it, vi } from "vitest";

import { ProductionCellProvider } from "./production-driver";

describe("ProductionCellProvider", () => {
  it("fails closed when adapters do not declare provider-side deduplication and fencing", async () => {
    const createDatabase = vi.fn(async () => ({ reference: "database-ref" }));
    const provider = new ProductionCellProvider({
      config: completeConfig(),
      adapters: { createDatabase }
    } as unknown as ConstructorParameters<typeof ProductionCellProvider>[0]);

    await expect(provider.createDatabase(providerContext())).rejects.toThrow(/provider-side safety contract/i);
    expect(createDatabase).not.toHaveBeenCalled();
  });

  it("rejects incomplete production configuration before any adapter operation", async () => {
    const adapters = {
      createDatabase: vi.fn(async () => ({ reference: "database" })),
      createStoragePrefix: vi.fn(async () => ({ reference: "storage" })),
      createSecretReference: vi.fn(async () => ({ reference: "secret" })),
      applyBackupPolicy: vi.fn(async () => ({ reference: "backup" })),
      deployApplication: vi.fn(async () => ({ reference: "application", applicationUrl: "https://example.test" })),
      initializeCellConfiguration: vi.fn(async () => ({ reference: "cell-configuration" })),
      bindSignalLoopInstallation: vi.fn(async () => ({ reference: "signalloop" })),
      healthCheck: vi.fn(async () => ({ healthy: true })),
      destroy: vi.fn(async () => undefined),
      validateRestore: vi.fn(async () => ({ healthy: true }))
    };
    const provider = new ProductionCellProvider({
      config: { databaseEndpoint: "https://database.example.test" },
      adapters,
      safety: providerSafetyContract()
    });
    const context = providerContext();

    await expect(provider.createDatabase(context)).rejects.toThrow(
      /database.*storage.*secret.*backup/i
    );
    await expect(provider.createStoragePrefix(context)).rejects.toThrow(/missing configuration/i);
    await expect(provider.createSecretReference(context)).rejects.toThrow(/missing configuration/i);
    await expect(provider.applyBackupPolicy(context)).rejects.toThrow(/missing configuration/i);
    await expect(provider.deployApplication(context)).rejects.toThrow(/missing configuration/i);
    await expect(provider.initializeCellConfiguration(context, projection())).rejects.toThrow(/missing configuration/i);
    await expect(provider.bindSignalLoopInstallation(context)).rejects.toThrow(/missing configuration/i);
    await expect(provider.healthCheck(context)).rejects.toThrow(/missing configuration/i);
    await expect(provider.destroy(context)).rejects.toThrow(/missing configuration/i);
    await expect(provider.validateRestore(context, "restore_ara")).rejects.toThrow(/missing configuration/i);

    for (const adapter of Object.values(adapters)) {
      expect(adapter).not.toHaveBeenCalled();
    }
  });

  it("passes scoped endpoint and credential references to every configured adapter", async () => {
    const adapters = {
      createDatabase: vi.fn(async () => ({ reference: "database-ref" })),
      createStoragePrefix: vi.fn(async () => ({ reference: "storage-ref" })),
      createSecretReference: vi.fn(async () => ({ reference: "secret-ref" })),
      applyBackupPolicy: vi.fn(async () => ({ reference: "backup-ref" })),
      deployApplication: vi.fn(async () => ({ reference: "application-ref", applicationUrl: "https://ara.example.test" })),
      initializeCellConfiguration: vi.fn(async () => ({ reference: "cell-configuration-ref" })),
      bindSignalLoopInstallation: vi.fn(async () => ({ reference: "signalloop-ref" })),
      healthCheck: vi.fn(async () => ({ healthy: true })),
      destroy: vi.fn(async () => undefined),
      validateRestore: vi.fn(async () => ({ healthy: true }))
    };
    const provider = new ProductionCellProvider({ config: completeConfig(), adapters, safety: providerSafetyContract() });
    const context = providerContext();

    await provider.createDatabase(context);
    await provider.createStoragePrefix(context);
    await provider.createSecretReference(context);
    await provider.applyBackupPolicy(context);
    await provider.deployApplication(context);
    await provider.initializeCellConfiguration(context, projection());
    await provider.bindSignalLoopInstallation(context);
    await provider.healthCheck(context);
    await provider.destroy(context);
    await provider.validateRestore(context, "restore_ara");

    const expectedScopes = [
      serviceScope("database"),
      serviceScope("storage"),
      serviceScope("secret"),
      serviceScope("backup"),
      serviceScope("application"),
      serviceScope("application"),
      serviceScope("signalLoop"),
      serviceScope("application"),
      serviceScope("application"),
      serviceScope("backup")
    ];
    const receivedContexts = Object.values(adapters).map((adapter, index) => {
      expect(adapter).toHaveBeenCalledTimes(1);
      const received = (adapter as unknown as { mock: { calls: Array<[Record<string, unknown>, ...unknown[]]> } }).mock.calls[0]?.[0];
      expect(received).toEqual({ ...context, providerScope: expectedScopes[index] });
      return received;
    });
    expect(receivedContexts[0]).not.toHaveProperty("databaseCredentialValue");
    expect(receivedContexts[0]).not.toHaveProperty("storageEndpoint");
    expect(adapters.initializeCellConfiguration).toHaveBeenCalledWith(
      { ...context, providerScope: serviceScope("application") },
      projection()
    );
  });
});

function completeConfig() {
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

function projection() {
  return {
    displayName: "ARA Global",
    planCode: "ENTERPRISE",
    allowedModules: ["crm", "finance"],
    initialAdminEmail: "admin@ara.example"
  };
}

function providerContext() {
  return {
    cellId: "cell_ara",
    cellKey: "ara-global",
    correlationId: "corr-1",
    idempotencyKey: "idem-1",
    leaseVersion: 7,
    fencingToken: "attempt/attempt_1/lease/7",
    deadline: new Date(Date.now() + 60_000),
    signal: new AbortController().signal
  };
}

function providerSafetyContract() {
  return {
    idempotency: "provider-enforced" as const,
    fencing: "provider-enforced" as const,
    cancellation: "abort-signal" as const
  };
}

function serviceScope(service: "database" | "storage" | "secret" | "backup" | "application" | "signalLoop") {
  const config = completeConfig();
  return {
    endpoint: config[`${service}Endpoint`],
    credentialReference: config[`${service}CredentialReference`]
  };
}
