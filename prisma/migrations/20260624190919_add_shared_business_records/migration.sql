-- CreateEnum
CREATE TYPE "SharedRecordType" AS ENUM ('LEAD', 'CUSTOMER', 'CONTACT', 'OPPORTUNITY', 'ORDER');

-- CreateTable
CREATE TABLE "SharedBusinessRecord" (
    "id" TEXT NOT NULL,
    "entityType" "SharedRecordType" NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "ownerId" TEXT,
    "parentId" TEXT,
    "relatedLeadId" TEXT,
    "relatedCustomerId" TEXT,
    "relatedContactId" TEXT,
    "relatedOpportunityId" TEXT,
    "sourceApp" TEXT NOT NULL,
    "ecrmLegacyId" TEXT,
    "emailVoiceLegacyId" TEXT,
    "externalKey" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "companyName" TEXT,
    "searchText" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedBusinessRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SharedBusinessRecord_entityType_status_idx" ON "SharedBusinessRecord"("entityType", "status");

-- CreateIndex
CREATE INDEX "SharedBusinessRecord_ownerId_idx" ON "SharedBusinessRecord"("ownerId");

-- CreateIndex
CREATE INDEX "SharedBusinessRecord_parentId_idx" ON "SharedBusinessRecord"("parentId");

-- CreateIndex
CREATE INDEX "SharedBusinessRecord_relatedLeadId_idx" ON "SharedBusinessRecord"("relatedLeadId");

-- CreateIndex
CREATE INDEX "SharedBusinessRecord_relatedCustomerId_idx" ON "SharedBusinessRecord"("relatedCustomerId");

-- CreateIndex
CREATE INDEX "SharedBusinessRecord_relatedOpportunityId_idx" ON "SharedBusinessRecord"("relatedOpportunityId");

-- CreateIndex
CREATE INDEX "SharedBusinessRecord_email_idx" ON "SharedBusinessRecord"("email");

-- CreateIndex
CREATE INDEX "SharedBusinessRecord_phone_idx" ON "SharedBusinessRecord"("phone");

-- CreateIndex
CREATE INDEX "SharedBusinessRecord_companyName_idx" ON "SharedBusinessRecord"("companyName");

-- CreateIndex
CREATE INDEX "SharedBusinessRecord_updatedAt_idx" ON "SharedBusinessRecord"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SharedBusinessRecord_entityType_ecrmLegacyId_key" ON "SharedBusinessRecord"("entityType", "ecrmLegacyId");

-- CreateIndex
CREATE UNIQUE INDEX "SharedBusinessRecord_entityType_emailVoiceLegacyId_key" ON "SharedBusinessRecord"("entityType", "emailVoiceLegacyId");
