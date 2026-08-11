import { describe, expect, it, vi } from "vitest";

import { ProductionCellProvider } from "./production-driver";

describe("ProductionCellProvider", () => {
  it("rejects incomplete production configuration before any adapter operation", async () => {
    const adapters = {
      createDatabase: vi.fn(async () => ({ reference: "database" })),
      createStoragePrefix: vi.fn(async () => ({ reference: "storage" })),
      createSecretReference: vi.fn(async () => ({ reference: "secret" })),
      applyBackupPolicy: vi.fn(async () => ({ reference: "backup" })),
      deployApplication: vi.fn(async () => ({ reference: "application", applicationUrl: "https://example.test" })),
      bindSignalLoopInstallation: vi.fn(async () => ({ reference: "signalloop" })),
      healthCheck: vi.fn(async () => ({ healthy: true })),
      destroy: vi.fn(async () => undefined),
      validateRestore: vi.fn(async () => ({ healthy: true }))
    };
    const provider = new ProductionCellProvider({
      config: { databaseEndpoint: "https://database.example.test" },
      adapters
    });
    const context = { cellId: "cell_ara", cellKey: "ara-global", correlationId: "corr-1" };

    await expect(provider.createDatabase(context)).rejects.toThrow(
      /database.*storage.*secret.*backup/i
    );
    await expect(provider.createStoragePrefix(context)).rejects.toThrow(/missing configuration/i);
    await expect(provider.createSecretReference(context)).rejects.toThrow(/missing configuration/i);
    await expect(provider.applyBackupPolicy(context)).rejects.toThrow(/missing configuration/i);
    await expect(provider.deployApplication(context)).rejects.toThrow(/missing configuration/i);
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
      bindSignalLoopInstallation: vi.fn(async () => ({ reference: "signalloop-ref" })),
      healthCheck: vi.fn(async () => ({ healthy: true })),
      destroy: vi.fn(async () => undefined),
      validateRestore: vi.fn(async () => ({ healthy: true }))
    };
    const provider = new ProductionCellProvider({ config: completeConfig(), adapters });
    const context = { cellId: "cell_ara", cellKey: "ara-global", correlationId: "corr-1" };

    await provider.createDatabase(context);
    await provider.createStoragePrefix(context);
    await provider.createSecretReference(context);
    await provider.applyBackupPolicy(context);
    await provider.deployApplication(context);
    await provider.bindSignalLoopInstallation(context);
    await provider.healthCheck(context);
    await provider.destroy(context);
    await provider.validateRestore(context, "restore_ara");

    expect(adapters.createDatabase).toHaveBeenCalledWith(expect.objectContaining({ providerScope: completeConfig() }));
    const receivedContexts = Object.values(adapters).map(
      (adapter) => (adapter as unknown as { mock: { calls: Array<[unknown, ...unknown[]]> } }).mock.calls[0]?.[0]
    );
    for (let index = 0; index < receivedContexts.length; index += 1) {
      expect(Object.values(adapters)[index]).toHaveBeenCalledTimes(1);
      const receivedContext = receivedContexts[index];
      expect(receivedContext).toEqual(expect.objectContaining({ providerScope: completeConfig() }));
    }
    expect(receivedContexts[0]).not.toHaveProperty("databaseCredentialValue");
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
