-- CreateTable
CREATE TABLE "SharedRecordExportSnapshot" (
    "id" TEXT NOT NULL,
    "entityType" "SharedRecordType",
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedRecordExportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedRecordExportSnapshotItem" (
    "snapshotId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "SharedRecordExportSnapshotItem_pkey" PRIMARY KEY ("snapshotId","position")
);

-- CreateIndex
CREATE INDEX "SharedRecordExportSnapshot_createdAt_idx" ON "SharedRecordExportSnapshot"("createdAt");

-- CreateIndex
CREATE INDEX "SharedRecordExportSnapshot_expiresAt_idx" ON "SharedRecordExportSnapshot"("expiresAt");

-- AddForeignKey
ALTER TABLE "SharedRecordExportSnapshotItem" ADD CONSTRAINT "SharedRecordExportSnapshotItem_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "SharedRecordExportSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
