-- CreateEnum
CREATE TYPE "CurrencyCode" AS ENUM ('INR', 'USD');

-- CreateTable
CREATE TABLE "BusinessSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "defaultCurrency" "CurrencyCode" NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesTextNote" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "taskId" TEXT,
    "leadCustomerId" TEXT,
    "opportunityId" TEXT,
    "proposalId" TEXT,
    "orderId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesTextNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesTextNote_ownerId_createdAt_idx" ON "SalesTextNote"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "SalesTextNote_taskId_idx" ON "SalesTextNote"("taskId");

-- CreateIndex
CREATE INDEX "SalesTextNote_leadCustomerId_idx" ON "SalesTextNote"("leadCustomerId");

-- CreateIndex
CREATE INDEX "SalesTextNote_opportunityId_idx" ON "SalesTextNote"("opportunityId");

-- CreateIndex
CREATE INDEX "SalesTextNote_proposalId_idx" ON "SalesTextNote"("proposalId");

-- CreateIndex
CREATE INDEX "SalesTextNote_orderId_idx" ON "SalesTextNote"("orderId");

-- AddForeignKey
ALTER TABLE "SalesTextNote" ADD CONSTRAINT "SalesTextNote_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTextNote" ADD CONSTRAINT "SalesTextNote_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "SalesTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTextNote" ADD CONSTRAINT "SalesTextNote_leadCustomerId_fkey" FOREIGN KEY ("leadCustomerId") REFERENCES "LeadCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTextNote" ADD CONSTRAINT "SalesTextNote_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTextNote" ADD CONSTRAINT "SalesTextNote_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTextNote" ADD CONSTRAINT "SalesTextNote_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
