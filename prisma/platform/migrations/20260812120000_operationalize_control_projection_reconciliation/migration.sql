ALTER TYPE "CustomerCellLifecycleStatus" ADD VALUE IF NOT EXISTS 'DELETING';
ALTER TYPE "ControlProjectionDeliveryStatus" ADD VALUE IF NOT EXISTS 'DEAD_LETTER';

ALTER TABLE "ControlProjectionDelivery"
    ADD COLUMN "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "leaseOwner" TEXT,
    ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
    ADD COLUMN "deadLetteredAt" TIMESTAMP(3);

DROP INDEX IF EXISTS "ControlProjectionDelivery_status_updatedAt_idx";
CREATE INDEX "ControlProjectionDelivery_status_nextAttemptAt_idx"
    ON "ControlProjectionDelivery"("status", "nextAttemptAt");
CREATE INDEX "ControlProjectionDelivery_leaseExpiresAt_idx"
    ON "ControlProjectionDelivery"("leaseExpiresAt");
