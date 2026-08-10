CREATE TABLE "OrganizationInstallation" (
  "id" TEXT NOT NULL,
  "installationId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "tenantKey" TEXT NOT NULL,
  "productCode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "keyVersion" INTEGER NOT NULL,
  "publicKey" TEXT NOT NULL,
  "lastAppliedVersion" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationInstallation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganizationInstallation_installationId_key" ON "OrganizationInstallation"("installationId");
CREATE UNIQUE INDEX "OrganizationInstallation_organizationId_installationId_key" ON "OrganizationInstallation"("organizationId", "installationId");
CREATE INDEX "OrganizationInstallation_tenantKey_productCode_idx" ON "OrganizationInstallation"("tenantKey", "productCode");
ALTER TABLE "OrganizationInstallation" ADD CONSTRAINT "OrganizationInstallation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "IntegrationReplayReceipt" (
  "id" TEXT NOT NULL,
  "installationId" TEXT NOT NULL,
  "jti" TEXT NOT NULL,
  "projectionVersion" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationReplayReceipt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IntegrationReplayReceipt_installationId_jti_key" ON "IntegrationReplayReceipt"("installationId", "jti");
CREATE INDEX "IntegrationReplayReceipt_expiresAt_idx" ON "IntegrationReplayReceipt"("expiresAt");
ALTER TABLE "IntegrationReplayReceipt" ADD CONSTRAINT "IntegrationReplayReceipt_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "OrganizationInstallation"("installationId") ON DELETE CASCADE ON UPDATE CASCADE;
