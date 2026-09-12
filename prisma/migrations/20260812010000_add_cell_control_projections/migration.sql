CREATE TABLE "CellControlProjection" (
    "cellId" TEXT NOT NULL,
    "lifecycleStatus" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "sourceIdempotencyKey" TEXT NOT NULL,
    CONSTRAINT "CellControlProjection_pkey" PRIMARY KEY ("cellId")
);

CREATE TABLE "CellControlProjectionEvent" (
    "id" TEXT NOT NULL,
    "cellId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    CONSTRAINT "CellControlProjectionEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CellSupportGrantProjection" (
    "id" TEXT NOT NULL,
    "cellId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "caseReference" TEXT NOT NULL,
    "capabilities" TEXT[],
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "projectionVersion" INTEGER NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CellSupportGrantProjection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CellControlProjection_sourceIdempotencyKey_key" ON "CellControlProjection"("sourceIdempotencyKey");
CREATE UNIQUE INDEX "CellControlProjectionEvent_idempotencyKey_key" ON "CellControlProjectionEvent"("idempotencyKey");
CREATE UNIQUE INDEX "CellControlProjectionEvent_cellId_version_key" ON "CellControlProjectionEvent"("cellId", "version");
CREATE INDEX "CellControlProjectionEvent_cellId_appliedAt_idx" ON "CellControlProjectionEvent"("cellId", "appliedAt");
CREATE INDEX "CellControlProjectionEvent_correlationId_idx" ON "CellControlProjectionEvent"("correlationId");
CREATE INDEX "CellSupportGrantProjection_cellId_expiresAt_idx" ON "CellSupportGrantProjection"("cellId", "expiresAt");
ALTER TABLE "CellControlProjectionEvent" ADD CONSTRAINT "CellControlProjectionEvent_cellId_fkey" FOREIGN KEY ("cellId") REFERENCES "CellControlProjection"("cellId") ON DELETE RESTRICT ON UPDATE CASCADE;
