import type { ApplicationProviderResult, CellHealth, CellProvider, CellProviderContext, ProviderReference } from "./types";

export class LocalCellProvider implements CellProvider {
  private readonly health: "healthy" | "unhealthy";

  public constructor(options: { health?: "healthy" | "unhealthy" } = {}) {
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

  public async healthCheck(_context: CellProviderContext): Promise<CellHealth> {
    return this.health === "healthy" ? { healthy: true } : { healthy: false, detail: "configured-local-health-failure" };
  }

  public async destroy(_context: CellProviderContext): Promise<void> {
    // Local provisioning is deterministic metadata generation and makes no vendor calls.
  }

  public async validateRestore(_context: CellProviderContext, _restoreReference: string): Promise<CellHealth> {
    return this.healthCheck(_context);
  }

  private reference(resource: string, context: CellProviderContext): ProviderReference {
    return { reference: `local://${resource}/${context.cellKey}` };
  }
}
