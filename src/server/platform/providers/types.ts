import type { ProvisioningStep } from "../types";

export interface CellProviderContext {
  cellId: string;
  cellKey: string;
  correlationId: string;
}

export interface ProviderReference {
  reference: string;
}

export interface ApplicationProviderResult extends ProviderReference {
  applicationUrl: string;
}

export interface CellHealth {
  healthy: boolean;
  detail?: string;
}

export interface CellProvider {
  createDatabase(context: CellProviderContext): Promise<ProviderReference>;
  createStoragePrefix(context: CellProviderContext): Promise<ProviderReference>;
  createSecretReference(context: CellProviderContext): Promise<ProviderReference>;
  applyBackupPolicy(context: CellProviderContext): Promise<ProviderReference>;
  deployApplication(context: CellProviderContext): Promise<ApplicationProviderResult>;
  bindSignalLoopInstallation(context: CellProviderContext): Promise<ProviderReference>;
  healthCheck(context: CellProviderContext): Promise<CellHealth>;
  destroy(context: CellProviderContext): Promise<void>;
  validateRestore(context: CellProviderContext, restoreReference: string): Promise<CellHealth>;
}

export type ProviderOperation = Exclude<ProvisioningStep, "health-check"> | "destroy" | "restore-validation";
