import type { ApplicationProviderResult, CellHealth, CellProvider, CellProviderContext, ProviderReference } from "./types";

export interface ProductionProviderConfig {
  databaseEndpoint?: string;
  databaseCredentialReference?: string;
  storageEndpoint?: string;
  storageCredentialReference?: string;
  secretEndpoint?: string;
  secretCredentialReference?: string;
  backupEndpoint?: string;
  backupCredentialReference?: string;
  applicationEndpoint?: string;
  applicationCredentialReference?: string;
  signalLoopEndpoint?: string;
  signalLoopCredentialReference?: string;
}

export interface ProductionProviderAdapterContext extends CellProviderContext {
  providerScope: Readonly<ProductionProviderConfig>;
}

export interface ProductionProviderAdapters {
  createDatabase?: (context: ProductionProviderAdapterContext) => Promise<ProviderReference>;
  createStoragePrefix?: (context: ProductionProviderAdapterContext) => Promise<ProviderReference>;
  createSecretReference?: (context: ProductionProviderAdapterContext) => Promise<ProviderReference>;
  applyBackupPolicy?: (context: ProductionProviderAdapterContext) => Promise<ProviderReference>;
  deployApplication?: (context: ProductionProviderAdapterContext) => Promise<ApplicationProviderResult>;
  bindSignalLoopInstallation?: (context: ProductionProviderAdapterContext) => Promise<ProviderReference>;
  healthCheck?: (context: ProductionProviderAdapterContext) => Promise<CellHealth>;
  destroy?: (context: ProductionProviderAdapterContext) => Promise<void>;
  validateRestore?: (context: ProductionProviderAdapterContext, restoreReference: string) => Promise<CellHealth>;
}

export class ProductionCellProvider implements CellProvider {
  private readonly config: ProductionProviderConfig;
  private readonly adapters: ProductionProviderAdapters;

  public constructor(options: { config: ProductionProviderConfig; adapters: ProductionProviderAdapters }) {
    this.config = options.config;
    this.adapters = options.adapters;
  }

  public async createDatabase(context: CellProviderContext): Promise<ProviderReference> {
    return this.call("createDatabase", context);
  }

  public async createStoragePrefix(context: CellProviderContext): Promise<ProviderReference> {
    return this.call("createStoragePrefix", context);
  }

  public async createSecretReference(context: CellProviderContext): Promise<ProviderReference> {
    return this.call("createSecretReference", context);
  }

  public async applyBackupPolicy(context: CellProviderContext): Promise<ProviderReference> {
    return this.call("applyBackupPolicy", context);
  }

  public async deployApplication(context: CellProviderContext): Promise<ApplicationProviderResult> {
    this.assertConfigured();
    const operation = this.adapters.deployApplication;
    if (!operation) {
      throw new Error("Production provider adapter deployApplication is not configured");
    }
    return operation(this.withScope(context));
  }

  public async bindSignalLoopInstallation(context: CellProviderContext): Promise<ProviderReference> {
    return this.call("bindSignalLoopInstallation", context);
  }

  public async healthCheck(context: CellProviderContext): Promise<CellHealth> {
    this.assertConfigured();
    return this.callHealth("healthCheck", context);
  }

  public async destroy(context: CellProviderContext): Promise<void> {
    this.assertConfigured();
    const operation = this.adapters.destroy;
    if (!operation) {
      throw new Error("Production provider adapter destroy is not configured");
    }
    await operation(this.withScope(context));
  }

  public async validateRestore(context: CellProviderContext, restoreReference: string): Promise<CellHealth> {
    this.assertConfigured();
    const operation = this.adapters.validateRestore;
    if (!operation) {
      throw new Error("Production provider adapter validateRestore is not configured");
    }
    return operation(this.withScope(context), restoreReference);
  }

  private assertConfigured(): void {
    const required: Array<[string, keyof ProductionProviderConfig, keyof ProductionProviderConfig]> = [
      ["database", "databaseEndpoint", "databaseCredentialReference"],
      ["storage", "storageEndpoint", "storageCredentialReference"],
      ["secret", "secretEndpoint", "secretCredentialReference"],
      ["backup", "backupEndpoint", "backupCredentialReference"],
      ["application", "applicationEndpoint", "applicationCredentialReference"],
      ["SignalLoop", "signalLoopEndpoint", "signalLoopCredentialReference"]
    ];
    const missing = required
      .filter(([, endpoint, credential]) => !this.config[endpoint] || !this.config[credential])
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new Error(`Production provider is missing configuration for: ${missing.join(", ")}`);
    }
  }

  private async call(
    name:
      | "createDatabase"
      | "createStoragePrefix"
      | "createSecretReference"
      | "applyBackupPolicy"
      | "bindSignalLoopInstallation",
    context: CellProviderContext
  ): Promise<ProviderReference> {
    this.assertConfigured();
    const operation = this.adapters[name];
    if (!operation) {
      throw new Error(`Production provider adapter ${name} is not configured`);
    }
    return operation(this.withScope(context));
  }

  private async callHealth(name: "healthCheck", context: CellProviderContext): Promise<CellHealth> {
    const operation = this.adapters[name];
    if (!operation) {
      throw new Error(`Production provider adapter ${name} is not configured`);
    }
    return operation(this.withScope(context));
  }

  private withScope(context: CellProviderContext): ProductionProviderAdapterContext {
    return { ...context, providerScope: this.config };
  }
}
