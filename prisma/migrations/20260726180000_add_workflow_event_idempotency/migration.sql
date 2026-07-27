CREATE TABLE "WorkflowEvent" (
    "id" TEXT NOT NULL,
    "sourceApp" TEXT NOT NULL,
    "sourceEventId" TEXT,
    "sourceEventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "relatedRecordType" TEXT,
    "relatedRecordId" TEXT,
    "summary" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowEvent_sourceApp_sourceEventId_key"
ON "WorkflowEvent"("sourceApp", "sourceEventId");

CREATE INDEX "WorkflowEvent_sourceApp_occurredAt_idx"
ON "WorkflowEvent"("sourceApp", "occurredAt");

CREATE INDEX "WorkflowEvent_entityType_entityId_idx"
ON "WorkflowEvent"("entityType", "entityId");

CREATE INDEX "WorkflowEvent_relatedRecordType_relatedRecordId_idx"
ON "WorkflowEvent"("relatedRecordType", "relatedRecordId");

CREATE INDEX "WorkflowEvent_sourceEventType_occurredAt_idx"
ON "WorkflowEvent"("sourceEventType", "occurredAt");
