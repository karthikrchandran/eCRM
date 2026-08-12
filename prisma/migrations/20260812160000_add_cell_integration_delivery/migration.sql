CREATE TYPE "IntegrationCredentialStatus" AS ENUM ('ACTIVE', 'ROTATED', 'REVOKED');
CREATE TYPE "CellIntegrationOutboxStatus" AS ENUM ('PENDING', 'CLAIMED', 'FAILED', 'DELIVERED', 'DEAD_LETTER');
CREATE TYPE "CellIntegrationRepairStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

CREATE TABLE "IntegrationCredential" (
  "id" TEXT NOT NULL,
  "cellId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "secretHash" TEXT NOT NULL,
  "capabilities" TEXT[],
  "status" "IntegrationCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "rotatedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntegrationCredential_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CellIntegrationOutbox" (
  "id" TEXT NOT NULL,
  "cellId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payloadVersion" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "correlationId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "destinationInstallation" TEXT NOT NULL,
  "status" "CellIntegrationOutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "leaseOwner" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "fenceToken" TEXT,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" TEXT,
  "errorCode" TEXT,
  "acknowledgementId" TEXT,
  "destinationCheckpoint" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CellIntegrationOutbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CellIntegrationOutbox_cellId_destinationInstallation_idempotencyKey_key" UNIQUE ("cellId", "destinationInstallation", "idempotencyKey")
);

CREATE TABLE "CellIntegrationDeliveryAttempt" (
  "id" TEXT NOT NULL,
  "outboxId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "workerId" TEXT NOT NULL,
  "fenceToken" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "result" TEXT NOT NULL,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "acknowledgementId" TEXT,
  CONSTRAINT "CellIntegrationDeliveryAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CellIntegrationDeliveryAttempt_outboxId_attemptNumber_key" UNIQUE ("outboxId", "attemptNumber"),
  CONSTRAINT "CellIntegrationDeliveryAttempt_outboxId_fkey" FOREIGN KEY ("outboxId") REFERENCES "CellIntegrationOutbox"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CellIntegrationProjectionCheckpoint" (
  "id" TEXT NOT NULL,
  "cellId" TEXT NOT NULL,
  "destinationInstallation" TEXT NOT NULL,
  "sourceCheckpoint" TEXT,
  "destinationCheckpoint" TEXT,
  "sourceCount" INTEGER NOT NULL DEFAULT 0,
  "destinationCount" INTEGER NOT NULL DEFAULT 0,
  "reconciledAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CellIntegrationProjectionCheckpoint_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CellIntegrationProjectionCheckpoint_cellId_destinationInstallation_key" UNIQUE ("cellId", "destinationInstallation")
);

CREATE TABLE "CellIntegrationRepairCandidate" (
  "id" TEXT NOT NULL,
  "cellId" TEXT NOT NULL,
  "destinationInstallation" TEXT NOT NULL,
  "sourceCheckpoint" TEXT,
  "destinationCheckpoint" TEXT,
  "sourceCount" INTEGER NOT NULL,
  "destinationCount" INTEGER NOT NULL,
  "status" "CellIntegrationRepairStatus" NOT NULL DEFAULT 'OPEN',
  "correlationId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "CellIntegrationRepairCandidate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IntegrationCredential_cellId_status_expiresAt_idx" ON "IntegrationCredential"("cellId", "status", "expiresAt");
CREATE INDEX "CellIntegrationOutbox_cellId_status_nextAttemptAt_idx" ON "CellIntegrationOutbox"("cellId", "status", "nextAttemptAt");
CREATE INDEX "CellIntegrationOutbox_leaseUntil_idx" ON "CellIntegrationOutbox"("leaseUntil");
CREATE INDEX "CellIntegrationOutbox_correlationId_idx" ON "CellIntegrationOutbox"("correlationId");
CREATE INDEX "CellIntegrationDeliveryAttempt_result_startedAt_idx" ON "CellIntegrationDeliveryAttempt"("result", "startedAt");
CREATE INDEX "CellIntegrationRepairCandidate_cellId_status_createdAt_idx" ON "CellIntegrationRepairCandidate"("cellId", "status", "createdAt");
CREATE INDEX "CellIntegrationRepairCandidate_correlationId_idx" ON "CellIntegrationRepairCandidate"("correlationId");
