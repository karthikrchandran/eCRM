import { describe, expect, it, vi } from "vitest";

import { LocalCellProvider } from "./local-driver";

describe("LocalCellProvider", () => {
  it("produces deterministic opaque references without invoking a vendor", async () => {
    const provider = new LocalCellProvider();
    const context = { cellId: "cell_ara", cellKey: "ara-global", correlationId: "corr-1", idempotencyKey: "idem-1" };

    await expect(provider.createDatabase(context)).resolves.toEqual({ reference: "local://database/ara-global" });
    await expect(provider.createStoragePrefix(context)).resolves.toEqual({ reference: "local://storage/ara-global" });
    await expect(provider.createSecretReference(context)).resolves.toEqual({ reference: "local://secret/ara-global" });
    await expect(provider.applyBackupPolicy(context)).resolves.toEqual({ reference: "local://backup/ara-global" });
    await expect(provider.deployApplication(context)).resolves.toEqual({
      reference: "local://application/ara-global",
      applicationUrl: "http://ara-global.localhost"
    });
    await expect(provider.healthCheck(context)).resolves.toEqual({ healthy: true });
  });

  it("refuses to construct outside the test runtime so platform deployments cannot emit local references", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_MODE", "platform");

    try {
      expect(() => new LocalCellProvider()).toThrow(/test-only/i);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
