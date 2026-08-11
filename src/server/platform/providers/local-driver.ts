import type { ApplicationProviderResult, CellHealth, CellProvider, CellProviderContext, ProviderReference } from "./types";

export class LocalCellProvider implements CellProvider {
  private readonly health: "healthy" | "unhealthy";

  public constructor(options: { health?: "healthy" | "unhealthy" } = {}) {
    if (process.env.NODE_ENV !== "test") {
      throw new Error("LocalCellProvider is test-only and cannot emit local:// references outside tests");
    }
    this.health = options.health ?? "healthy";
  }

  public async createDatabase(context: CellProviderContext): Promise<ProviderReference> {
    return this.reference("database", context);
  }

  public async createStoragePrefix(context: CellProviderContext): Promise<ProviderReference> {
    return this.reference("storage", context);
  }

  public async createSecretReference(context: CellProviderContext): Promise<ProviderReference> {
    return this.reference("secret", context);
  }

  public async applyBackupPolicy(context: CellProviderContext): Promise<ProviderReference> {
    return this.reference("backup", context);
  }

  public async deployApplication(context: CellProviderContext): Promise<ApplicationProviderResult> {
    return {
      ...this.reference("application", context),
      applicationUrl: `http://${context.cellKey}.localhost`
    };
  }

  public async bindSignalLoopInstallation(context: CellProviderContext): Promise<ProviderReference> {
    return this.reference("signalloop", context);
  }

  public async healthCheck(context: CellProviderContext): Promise<CellHealth> {
    void context;
    return this.health === "healthy" ? { healthy: true } : { healthy: false, detail: "configured-local-health-failure" };
  }

  public async destroy(context: CellProviderContext): Promise<void> {
    void context;
    // Local provisioning is deterministic metadata generation and makes no vendor calls.
  }

  public async validateRestore(context: CellProviderContext, restoreReference: string): Promise<CellHealth> {
    void restoreReference;
    return this.healthCheck(context);
  }

  private reference(resource: string, context: CellProviderContext): ProviderReference {
    return { reference: `local://${resource}/${context.cellKey}` };
  }
}
