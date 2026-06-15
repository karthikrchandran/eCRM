-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "versionLabel" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "validUntil" TIMESTAMP(3),
    "commercialSummary" TEXT,
    "assumptions" TEXT,
    "inclusions" TEXT,
    "exclusions" TEXT,
    "paymentTerms" TEXT,
    "deliveryTimeline" TEXT,
    "internalNotes" TEXT,
    "subtotalPaisa" INTEGER NOT NULL DEFAULT 0,
    "gstPaisa" INTEGER NOT NULL DEFAULT 0,
    "totalPaisa" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalLineItem" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "productServiceId" TEXT NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "productCategorySnapshot" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPricePaisa" INTEGER NOT NULL,
    "gstRateBps" INTEGER NOT NULL,
    "gstOverrideReason" TEXT,
    "lineSubtotalPaisa" INTEGER NOT NULL,
    "lineGstPaisa" INTEGER NOT NULL,
    "lineTotalPaisa" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalPdfAttachment" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storedFileName" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "sha256" TEXT,
    "canvaDesignUrl" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replacedAt" TIMESTAMP(3),

    CONSTRAINT "ProposalPdfAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Proposal_opportunityId_idx" ON "Proposal"("opportunityId");

-- CreateIndex
CREATE INDEX "Proposal_status_idx" ON "Proposal"("status");

-- CreateIndex
CREATE INDEX "Proposal_createdAt_idx" ON "Proposal"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_opportunityId_sequenceNumber_key" ON "Proposal"("opportunityId", "sequenceNumber");

-- CreateIndex
CREATE INDEX "ProposalLineItem_proposalId_idx" ON "ProposalLineItem"("proposalId");

-- CreateIndex
CREATE INDEX "ProposalLineItem_productServiceId_idx" ON "ProposalLineItem"("productServiceId");

-- CreateIndex
CREATE INDEX "ProposalPdfAttachment_proposalId_idx" ON "ProposalPdfAttachment"("proposalId");

-- CreateIndex
CREATE INDEX "ProposalPdfAttachment_uploadedAt_idx" ON "ProposalPdfAttachment"("uploadedAt");

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalLineItem" ADD CONSTRAINT "ProposalLineItem_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalLineItem" ADD CONSTRAINT "ProposalLineItem_productServiceId_fkey" FOREIGN KEY ("productServiceId") REFERENCES "ProductService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalPdfAttachment" ADD CONSTRAINT "ProposalPdfAttachment_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalPdfAttachment" ADD CONSTRAINT "ProposalPdfAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
