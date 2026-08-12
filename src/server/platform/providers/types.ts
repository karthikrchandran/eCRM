import type { ProvisioningStep } from "../types";

export interface CellProviderContext {
  cellId: string;
  cellKey: string;
  correlationId: string;
  idempotencyKey: string;
  leaseVersion: number;
  fencingToken: string;
  deadline: Date;
  signal: AbortSignal;
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

export interface CellConfigurationProjection {
  displayName: string;
  planCode: string;
  allowedModules: string[];
  initialAdminEmail: string;
}

export interface CellProvider {
  createDatabase(context: CellProviderContext): Promise<ProviderReference>;
  createStoragePrefix(context: CellProviderContext): Promise<ProviderReference>;
  createSecretReference(context: CellProviderContext): Promise<ProviderReference>;
  applyBackupPolicy(context: CellProviderContext): Promise<ProviderReference>;
  deployApplication(context: CellProviderContext): Promise<ApplicationProviderResult>;
  initializeCellConfiguration(context: CellProviderContext, projection: CellConfigurationProjection): Promise<ProviderReference>;
  bindSignalLoopInstallation(context: CellProviderContext): Promise<ProviderReference>;
  healthCheck(context: CellProviderContext): Promise<CellHealth>;
  destroy(context: CellProviderContext): Promise<void>;
  validateRestore(context: CellProviderContext, restoreReference: string): Promise<CellHealth>;
}

export type ProviderOperation = Exclude<ProvisioningStep, "health-check"> | "destroy" | "restore-validation";

export function assertProviderContextActive(context: CellProviderContext): void {
  if (!context.idempotencyKey.trim()) throw new Error("Provider idempotency key is required");
  if (!Number.isSafeInteger(context.leaseVersion) || context.leaseVersion < 1) {
    throw new Error("Provider lease version must be a positive integer");
  }
  if (!context.fencingToken.trim()) throw new Error("Provider fencing token is required");
  if (!(context.deadline instanceof Date) || !Number.isFinite(context.deadline.getTime())) {
    throw new Error("Provider deadline is invalid");
  }
  if (context.signal.aborted) {
    throw context.signal.reason instanceof Error ? context.signal.reason : new Error("Provider operation aborted");
  }
  if (context.deadline.getTime() <= Date.now()) throw new Error("Provider operation deadline exceeded");
}
