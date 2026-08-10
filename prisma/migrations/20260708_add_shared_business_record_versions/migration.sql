-- AlterTable
ALTER TABLE "SharedBusinessRecord"
ADD COLUMN "headVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "lastChangedByApp" TEXT,
ADD COLUMN "lastChangeAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SharedBusinessRecordVersion" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "entityType" "SharedRecordType" NOT NULL,
    "sourceApp" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "idempotencyKey" TEXT,
    "baseVersion" INTEGER,
    "snapshot" JSONB NOT NULL,
    "changedFields" JSONB,

    CONSTRAINT "SharedBusinessRecordVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SharedBusinessRecord_headVersion_idx" ON "SharedBusinessRecord"("headVersion");

-- CreateIndex
CREATE UNIQUE INDEX "SharedBusinessRecordVersion_recordId_versionNumber_key" ON "SharedBusinessRecordVersion"("recordId", "versionNumber");

-- CreateIndex
CREATE INDEX "SharedBusinessRecordVersion_entityType_changedAt_idx" ON "SharedBusinessRecordVersion"("entityType", "changedAt");

-- CreateIndex
CREATE INDEX "SharedBusinessRecordVersion_sourceApp_changedAt_idx" ON "SharedBusinessRecordVersion"("sourceApp", "changedAt");

-- CreateIndex
CREATE INDEX "SharedBusinessRecordVersion_idempotencyKey_idx" ON "SharedBusinessRecordVersion"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "SharedBusinessRecordVersion" ADD CONSTRAINT "SharedBusinessRecordVersion_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "SharedBusinessRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
