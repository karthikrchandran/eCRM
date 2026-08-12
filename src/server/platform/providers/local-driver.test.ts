import { describe, expect, it, vi } from "vitest";

import { LocalCellProvider } from "./local-driver";

describe("LocalCellProvider", () => {
  it("produces deterministic opaque references without invoking a vendor", async () => {
    const provider = new LocalCellProvider();
    const context = providerContext();

    await expect(provider.createDatabase(context)).resolves.toEqual({ reference: "local://database/ara-global" });
    await expect(provider.createStoragePrefix(context)).resolves.toEqual({ reference: "local://storage/ara-global" });
    await expect(provider.createSecretReference(context)).resolves.toEqual({ reference: "local://secret/ara-global" });
    await expect(provider.applyBackupPolicy(context)).resolves.toEqual({ reference: "local://backup/ara-global" });
    await expect(provider.deployApplication(context)).resolves.toEqual({
      reference: "local://application/ara-global",
      applicationUrl: "http://ara-global.localhost"
    });
    await expect(provider.initializeCellConfiguration(context, {
      displayName: "ARA Global",
      planCode: "ENTERPRISE",
      allowedModules: ["crm", "finance"],
      initialAdminEmail: "admin@ara.example"
    })).resolves.toEqual({ reference: "local://cell-configuration/ara-global" });
    await expect(provider.healthCheck(context)).resolves.toEqual({ healthy: true });
  });

  it("honors the provider cancellation and deadline contract", async () => {
    const provider = new LocalCellProvider();
    const controller = new AbortController();
    controller.abort(new Error("lease lost"));

    await expect(provider.createDatabase({ ...providerContext(), signal: controller.signal })).rejects.toThrow("lease lost");
    await expect(provider.createDatabase({
      ...providerContext(),
      deadline: new Date(Date.now() - 1)
    })).rejects.toThrow(/deadline/i);
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
