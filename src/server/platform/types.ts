export type CustomerCellLifecycleStatus = "PROVISIONING" | "ACTIVE" | "PROVISIONING_FAILED" | "SUSPENDING" | "SUSPENDED" | "OFFBOARDING" | "DELETED";

export type ProvisioningStep =
  | "database"
  | "storage"
  | "secret-reference"
  | "backup-policy"
  | "application"
  | "cell-initialization"
  | "signalloop-binding"
  | "health-check";

export type ProvisioningResult = "SUCCEEDED" | "FAILED";

export interface CustomerCellRecord {
  id: string;
  cellKey: string;
  legalName: string;
  displayName: string;
  region: string;
  desiredSubdomain: string;
  planCode: string;
  allowedModules: string[];
  lifecycleStatus: CustomerCellLifecycleStatus;
  desiredLifecycleStatus?: CustomerCellLifecycleStatus;
  databaseReference?: string;
  storageReference?: string;
  secretReference?: string;
  backupReference?: string;
  applicationReference?: string;
  applicationUrl?: string;
  signalLoopWorkspaceReference?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProvisioningRequest {
  cellId: string;
  cellKey: string;
  legalName: string;
  displayName: string;
  region: string;
  desiredSubdomain: string;
  planCode: string;
  allowedModules: string[];
  initialAdminEmail: string;
  idempotencyKey: string;
  correlationId: string;
  actor: string;
  reason?: string;
}

export interface ProvisioningAction {
  step: ProvisioningStep;
  result: ProvisioningResult | "IN_PROGRESS";
  reference?: string;
  errorCode?: string;
  occurredAt: Date;
}

export interface ProvisioningAttemptRecord {
  id: string;
  cellId: string;
  idempotencyKey: string;
  correlationId: string;
  leaseVersion: number;
  result: ProvisioningResult | "IN_PROGRESS";
  actions: ProvisioningAction[];
  createdAt: Date;
  updatedAt: Date;
}

export class ProvisioningLeaseLostError extends Error {
  public constructor(attemptId: string) {
    super(`Provisioning lease lost for attempt ${attemptId}`);
    this.name = "ProvisioningLeaseLostError";
  }
}

export interface ControlPlaneAuditEventRecord {
  id: string;
  cellId: string;
  correlationId: string;
  action: string;
  result: ProvisioningResult;
  actor: string;
  reason?: string;
  error?: string;
  errorCode?: string;
  secretReference?: string;
  occurredAt: Date;
}

export interface SupportGrantRecord {
  id: string;
  cellId: string;
  operatorId: string;
  caseReference: string;
  capabilities: string[];
  reason: string;
  startsAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
  revokedBy?: string;
  revocationReason?: string;
  actor: string;
  correlationId: string;
  createdAt: Date;
}

export type ControlProjectionDeliveryStatus = "PENDING" | "FAILED" | "DELIVERED";

export interface ControlProjectionDeliveryRecord {
  id: string;
  cellId: string;
  version: number;
  type: "LIFECYCLE" | "SUPPORT_GRANT";
  correlationId: string;
  idempotencyKey: string;
  issuedAt: Date;
  payload: Record<string, unknown>;
  status: ControlProjectionDeliveryStatus;
  attempts: number;
  lastAttemptAt?: Date;
  deliveredAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}
