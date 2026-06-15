-- CreateTable
CREATE TABLE "ProductService" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "defaultGstRateBps" INTEGER NOT NULL DEFAULT 1800,
    "defaultProductionTemplateKey" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductService_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductService_code_key" ON "ProductService"("code");

-- CreateIndex
CREATE INDEX "ProductService_active_sortOrder_idx" ON "ProductService"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductService_category_idx" ON "ProductService"("category");

-- CreateIndex
CREATE INDEX "ProductService_name_idx" ON "ProductService"("name");

-- AddForeignKey
ALTER TABLE "ProductService" ADD CONSTRAINT "ProductService_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductService" ADD CONSTRAINT "ProductService_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
