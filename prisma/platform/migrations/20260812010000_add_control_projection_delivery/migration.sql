CREATE TYPE "ControlProjectionDeliveryStatus" AS ENUM ('PENDING', 'FAILED', 'DELIVERED');

CREATE TABLE "ControlProjectionDelivery" (
    "id" TEXT NOT NULL,
    "cellId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "ControlProjectionDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ControlProjectionDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ControlProjectionDelivery_idempotencyKey_key" ON "ControlProjectionDelivery"("idempotencyKey");
CREATE UNIQUE INDEX "ControlProjectionDelivery_cellId_version_key" ON "ControlProjectionDelivery"("cellId", "version");
CREATE INDEX "ControlProjectionDelivery_status_updatedAt_idx" ON "ControlProjectionDelivery"("status", "updatedAt");
CREATE INDEX "ControlProjectionDelivery_cellId_createdAt_idx" ON "ControlProjectionDelivery"("cellId", "createdAt");
CREATE INDEX "ControlProjectionDelivery_correlationId_idx" ON "ControlProjectionDelivery"("correlationId");
ALTER TABLE "ControlProjectionDelivery" ADD CONSTRAINT "ControlProjectionDelivery_cellId_fkey" FOREIGN KEY ("cellId") REFERENCES "CustomerCell"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
