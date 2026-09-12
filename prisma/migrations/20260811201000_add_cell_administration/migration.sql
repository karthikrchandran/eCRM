CREATE TABLE "CellConfiguration" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "displayName" TEXT NOT NULL DEFAULT 'eCRM',
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#1e3a5f',
    "locale" TEXT NOT NULL DEFAULT 'en-US',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "defaultCurrency" "CurrencyCode" NOT NULL DEFAULT 'INR',
    "enabledModules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "allowedModules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "planCode" TEXT NOT NULL DEFAULT 'UNASSIGNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CellConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CellAuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "error" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CellAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CellAuditEvent_actorId_occurredAt_idx" ON "CellAuditEvent"("actorId", "occurredAt");
CREATE INDEX "CellAuditEvent_correlationId_idx" ON "CellAuditEvent"("correlationId");
CREATE INDEX "CellAuditEvent_targetType_targetId_occurredAt_idx" ON "CellAuditEvent"("targetType", "targetId", "occurredAt");
