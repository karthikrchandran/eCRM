-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'BOOKED', 'IN_PRODUCTION', 'READY_FOR_DELIVERY', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductionStageStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'SKIPPED');

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "leadCustomerId" TEXT NOT NULL,
    "branchId" TEXT,
    "ownerId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'BOOKED',
    "poNumber" TEXT,
    "poDate" TIMESTAMP(3),
    "poFileName" TEXT,
    "poStorageKey" TEXT,
    "poFileSizeBytes" INTEGER,
    "poMimeType" TEXT,
    "bookedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryDueAt" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "subtotalPaisa" INTEGER NOT NULL,
    "gstPaisa" INTEGER NOT NULL,
    "totalPaisa" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLineItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "proposalLineItemId" TEXT NOT NULL,
    "productServiceId" TEXT,
    "productNameSnapshot" TEXT NOT NULL,
    "productCategorySnapshot" TEXT NOT NULL,
    "productionTemplateKeySnapshot" TEXT,
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

    CONSTRAINT "OrderLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderOwnerSplitSnapshot" (
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "percent" INTEGER NOT NULL,

    CONSTRAINT "OrderOwnerSplitSnapshot_pkey" PRIMARY KEY ("orderId","userId")
);

-- CreateTable
CREATE TABLE "ProductionTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionTemplateStage" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "defaultDurationDays" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionTemplateStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionWorkItem" (
    "id" TEXT NOT NULL,
    "orderLineItemId" TEXT NOT NULL,
    "productionTemplateId" TEXT,
    "title" TEXT NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "productCategorySnapshot" TEXT NOT NULL,
    "status" "ProductionStageStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "assignedToId" TEXT,
    "dueAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionWorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionStageInstance" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "templateStageId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProductionStageStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "assignedToId" TEXT,
    "dueAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "skippedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionStageInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionNote" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "stageInstanceId" TEXT,
    "body" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Order_proposalId_key" ON "Order"("proposalId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_ownerId_idx" ON "Order"("ownerId");

-- CreateIndex
CREATE INDEX "Order_leadCustomerId_idx" ON "Order"("leadCustomerId");

-- CreateIndex
CREATE INDEX "Order_opportunityId_idx" ON "Order"("opportunityId");

-- CreateIndex
CREATE INDEX "Order_bookedAt_idx" ON "Order"("bookedAt");

-- CreateIndex
CREATE INDEX "Order_deliveryDueAt_idx" ON "Order"("deliveryDueAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderLineItem_proposalLineItemId_key" ON "OrderLineItem"("proposalLineItemId");

-- CreateIndex
CREATE INDEX "OrderLineItem_orderId_idx" ON "OrderLineItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderLineItem_productServiceId_idx" ON "OrderLineItem"("productServiceId");

-- CreateIndex
CREATE INDEX "OrderLineItem_productCategorySnapshot_idx" ON "OrderLineItem"("productCategorySnapshot");

-- CreateIndex
CREATE INDEX "OrderOwnerSplitSnapshot_userId_idx" ON "OrderOwnerSplitSnapshot"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionTemplate_key_key" ON "ProductionTemplate"("key");

-- CreateIndex
CREATE INDEX "ProductionTemplate_active_sortOrder_idx" ON "ProductionTemplate"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductionTemplateStage_templateId_sortOrder_idx" ON "ProductionTemplateStage"("templateId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionTemplateStage_templateId_key_key" ON "ProductionTemplateStage"("templateId", "key");

-- CreateIndex
CREATE INDEX "ProductionWorkItem_orderLineItemId_idx" ON "ProductionWorkItem"("orderLineItemId");

-- CreateIndex
CREATE INDEX "ProductionWorkItem_productionTemplateId_idx" ON "ProductionWorkItem"("productionTemplateId");

-- CreateIndex
CREATE INDEX "ProductionWorkItem_status_idx" ON "ProductionWorkItem"("status");

-- CreateIndex
CREATE INDEX "ProductionWorkItem_assignedToId_idx" ON "ProductionWorkItem"("assignedToId");

-- CreateIndex
CREATE INDEX "ProductionWorkItem_dueAt_idx" ON "ProductionWorkItem"("dueAt");

-- CreateIndex
CREATE INDEX "ProductionWorkItem_productCategorySnapshot_idx" ON "ProductionWorkItem"("productCategorySnapshot");

-- CreateIndex
CREATE INDEX "ProductionStageInstance_workItemId_idx" ON "ProductionStageInstance"("workItemId");

-- CreateIndex
CREATE INDEX "ProductionStageInstance_templateStageId_idx" ON "ProductionStageInstance"("templateStageId");

-- CreateIndex
CREATE INDEX "ProductionStageInstance_status_idx" ON "ProductionStageInstance"("status");

-- CreateIndex
CREATE INDEX "ProductionStageInstance_assignedToId_idx" ON "ProductionStageInstance"("assignedToId");

-- CreateIndex
CREATE INDEX "ProductionStageInstance_dueAt_idx" ON "ProductionStageInstance"("dueAt");

-- CreateIndex
CREATE INDEX "ProductionNote_workItemId_idx" ON "ProductionNote"("workItemId");

-- CreateIndex
CREATE INDEX "ProductionNote_stageInstanceId_idx" ON "ProductionNote"("stageInstanceId");

-- CreateIndex
CREATE INDEX "ProductionNote_createdById_idx" ON "ProductionNote"("createdById");

-- CreateIndex
CREATE INDEX "ProductionNote_createdAt_idx" ON "ProductionNote"("createdAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_leadCustomerId_fkey" FOREIGN KEY ("leadCustomerId") REFERENCES "LeadCustomer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLineItem" ADD CONSTRAINT "OrderLineItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLineItem" ADD CONSTRAINT "OrderLineItem_proposalLineItemId_fkey" FOREIGN KEY ("proposalLineItemId") REFERENCES "ProposalLineItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLineItem" ADD CONSTRAINT "OrderLineItem_productServiceId_fkey" FOREIGN KEY ("productServiceId") REFERENCES "ProductService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderOwnerSplitSnapshot" ADD CONSTRAINT "OrderOwnerSplitSnapshot_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderOwnerSplitSnapshot" ADD CONSTRAINT "OrderOwnerSplitSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTemplateStage" ADD CONSTRAINT "ProductionTemplateStage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProductionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionWorkItem" ADD CONSTRAINT "ProductionWorkItem_orderLineItemId_fkey" FOREIGN KEY ("orderLineItemId") REFERENCES "OrderLineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionWorkItem" ADD CONSTRAINT "ProductionWorkItem_productionTemplateId_fkey" FOREIGN KEY ("productionTemplateId") REFERENCES "ProductionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionWorkItem" ADD CONSTRAINT "ProductionWorkItem_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionWorkItem" ADD CONSTRAINT "ProductionWorkItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionWorkItem" ADD CONSTRAINT "ProductionWorkItem_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionStageInstance" ADD CONSTRAINT "ProductionStageInstance_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "ProductionWorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionStageInstance" ADD CONSTRAINT "ProductionStageInstance_templateStageId_fkey" FOREIGN KEY ("templateStageId") REFERENCES "ProductionTemplateStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionStageInstance" ADD CONSTRAINT "ProductionStageInstance_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionStageInstance" ADD CONSTRAINT "ProductionStageInstance_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionNote" ADD CONSTRAINT "ProductionNote_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "ProductionWorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionNote" ADD CONSTRAINT "ProductionNote_stageInstanceId_fkey" FOREIGN KEY ("stageInstanceId") REFERENCES "ProductionStageInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionNote" ADD CONSTRAINT "ProductionNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
