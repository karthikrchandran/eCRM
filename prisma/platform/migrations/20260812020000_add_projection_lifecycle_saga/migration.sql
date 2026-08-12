ALTER TYPE "CustomerCellLifecycleStatus" ADD VALUE IF NOT EXISTS 'SUSPENDING';

ALTER TABLE "CustomerCell" ADD COLUMN "desiredLifecycleStatus" "CustomerCellLifecycleStatus";

DROP INDEX IF EXISTS "SupportGrant_correlationId_idx";
CREATE UNIQUE INDEX "SupportGrant_cellId_correlationId_key" ON "SupportGrant"("cellId", "correlationId");
