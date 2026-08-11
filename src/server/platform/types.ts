export type CustomerCellLifecycleStatus = "PROVISIONING" | "ACTIVE" | "PROVISIONING_FAILED" | "SUSPENDED" | "OFFBOARDING" | "DELETED";

export type ProvisioningStep =
  | "database"
  | "storage"
  | "secret-reference"
  | "backup-policy"
  | "application"
  | "signalloop-binding"
  | "health-check";

export type ProvisioningResult = "SUCCEEDED" | "FAILED";

export interface CustomerCellRecord {
  id: string;
  customerKey: string;
  legalName: string;
  displayName: string;
  region: string;
  desiredSubdomain: string;
  lifecycleStatus: CustomerCellLifecycleStatus;
  databaseReference?: string;
  storageReference?: string;
  secretReference?: string;
  backupReference?: string;
  applicationReference?: string;
  signalLoopWorkspaceReference?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProvisioningRequest {
  customerKey: string;
  legalName: string;
  displayName: string;
  region: string;
  desiredSubdomain: string;
  initialAdminEmail: string;
  idempotencyKey: string;
  correlationId: string;
}

export interface ProvisioningAction {
  step: ProvisioningStep;
  result: ProvisioningResult;
  reference?: string;
  errorCode?: string;
  occurredAt: Date;
}

export interface ProvisioningAttemptRecord {
  id: string;
  cellId: string;
  idempotencyKey: string;
  correlationId: string;
  result: ProvisioningResult | "IN_PROGRESS";
  actions: ProvisioningAction[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ControlPlaneAuditEventRecord {
  id: string;
  cellId: string;
  correlationId: string;
  action: ProvisioningStep;
  result: ProvisioningResult;
  occurredAt: Date;
}
