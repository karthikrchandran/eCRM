CREATE TYPE "CellIntegrationCircuitState" AS ENUM ('CLOSED', 'OPEN', 'HALF_OPEN');
CREATE TYPE "CellIntegrationProjectionStream" AS ENUM ('SHARED_RECORD', 'WORKFLOW_EVENT');

ALTER TABLE "CellIntegrationProjectionCheckpoint"
  ADD COLUMN "stream" "CellIntegrationProjectionStream" NOT NULL DEFAULT 'SHARED_RECORD',
  ADD COLUMN "sourceVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "destinationVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CellIntegrationProjectionCheckpoint"
  DROP CONSTRAINT "CellIntegrationProjectionCheckpoint_cellId_destinationInstallation_key";
CREATE UNIQUE INDEX "CellIntegrationProjectionCheckpoint_cellId_destinationInstallation_stream_key"
  ON "CellIntegrationProjectionCheckpoint"("cellId", "destinationInstallation", "stream");

ALTER TABLE "CellIntegrationRepairCandidate"
  ADD COLUMN "stream" "CellIntegrationProjectionStream" NOT NULL DEFAULT 'SHARED_RECORD',
  ADD COLUMN "sourceVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "destinationVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "resolvedBy" TEXT,
  ADD COLUMN "resolutionReason" TEXT;
CREATE INDEX "CellIntegrationRepairCandidate_cellId_destinationInstallation_stream_status_idx"
  ON "CellIntegrationRepairCandidate"("cellId", "destinationInstallation", "stream", "status");
CREATE UNIQUE INDEX "CellIntegrationRepairCandidate_open_stream_key"
  ON "CellIntegrationRepairCandidate"("cellId", "destinationInstallation", "stream")
  WHERE "status" = 'OPEN';

CREATE TABLE "CellIntegrationCircuitBreaker" (
  "id" TEXT NOT NULL,
  "cellId" TEXT NOT NULL,
  "destinationInstallation" TEXT NOT NULL,
  "state" "CellIntegrationCircuitState" NOT NULL DEFAULT 'CLOSED',
  "failureCount" INTEGER NOT NULL DEFAULT 0,
  "windowStartedAt" TIMESTAMP(3),
  "lastFailureAt" TIMESTAMP(3),
  "openedAt" TIMESTAMP(3),
  "openUntil" TIMESTAMP(3),
  "probeLeaseOwner" TEXT,
  "probeLeaseUntil" TIMESTAMP(3),
  "probeFenceToken" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CellIntegrationCircuitBreaker_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CellIntegrationCircuitBreaker_cellId_destinationInstallation_key"
  ON "CellIntegrationCircuitBreaker"("cellId", "destinationInstallation");
CREATE INDEX "CellIntegrationCircuitBreaker_cellId_state_openUntil_idx"
  ON "CellIntegrationCircuitBreaker"("cellId", "state", "openUntil");
CREATE INDEX "CellIntegrationCircuitBreaker_probeLeaseUntil_idx"
  ON "CellIntegrationCircuitBreaker"("probeLeaseUntil");
