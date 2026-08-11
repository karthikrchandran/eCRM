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
});
