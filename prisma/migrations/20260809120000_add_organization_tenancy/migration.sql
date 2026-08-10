-- Expand-phase organization tenancy foundation.
-- This migration intentionally leaves every business organizationId nullable;
-- application scoping, NOT NULL enforcement, and RLS belong to later phases.

-- Fail quickly when an enterprise deployment cannot acquire a metadata lock;
-- allow the bounded data phase enough time for a controlled maintenance window.
SET lock_timeout = '5s';
SET statement_timeout = '15min';

DO $$
BEGIN
  CREATE TYPE "OrganizationStatus" AS ENUM ('PROVISIONING', 'ACTIVE', 'SUSPENDED', 'OFFBOARDING', 'DELETED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'ADMIN', 'SALES', 'FINANCE', 'PRODUCTION', 'READ_ONLY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Organization" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "status" "OrganizationStatus" NOT NULL DEFAULT 'PROVISIONING',
  "deploymentRegion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Organization_key_key" ON "Organization"("key");

CREATE TABLE IF NOT EXISTS "OrganizationMembership" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "OrganizationRole" NOT NULL,
  "status" "MembershipStatus" NOT NULL DEFAULT 'INVITED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationMembership_organizationId_userId_key"
  ON "OrganizationMembership"("organizationId", "userId");
CREATE INDEX IF NOT EXISTS "OrganizationMembership_userId_status_idx"
  ON "OrganizationMembership"("userId", "status");

CREATE TABLE IF NOT EXISTS "OrganizationSettings" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "currency" "CurrencyCode" NOT NULL DEFAULT 'USD',
  "locale" TEXT NOT NULL DEFAULT 'en',
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "defaultCountry" TEXT,
  "taxConfiguration" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "invoiceConfiguration" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "paymentConfiguration" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "numberingRules" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "retentionPolicy" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "financialClosePolicy" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "enabledModules" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "operationalLimits" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "OrganizationSettings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationSettings_organizationId_key"
  ON "OrganizationSettings"("organizationId");

CREATE TABLE IF NOT EXISTS "OrganizationBranding" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "productName" TEXT NOT NULL DEFAULT 'eCRM',
  "logoAssetId" TEXT,
  "imageAssetId" TEXT,
  "primaryColor" TEXT NOT NULL DEFAULT '#1F2937',
  "secondaryColor" TEXT NOT NULL DEFAULT '#6B7280',
  "supportUrl" TEXT,
  "legalUrl" TEXT,
  "supportEmail" TEXT,
  "emailFromName" TEXT NOT NULL DEFAULT 'eCRM',
  "documentFooter" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "OrganizationBranding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationBranding_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationBranding_organizationId_key"
  ON "OrganizationBranding"("organizationId");

CREATE TABLE IF NOT EXISTS "OrganizationTenancyMigrationReconciliation" (
  "migrationKey" TEXT NOT NULL,
  "tableName" TEXT NOT NULL,
  "beforeCount" BIGINT NOT NULL,
  "afterCount" BIGINT NOT NULL DEFAULT 0,
  "nullCount" BIGINT NOT NULL DEFAULT 0,
  "mismatchCount" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationTenancyMigrationReconciliation_pkey" PRIMARY KEY ("migrationKey", "tableName")
);

-- Stage 1: this short, metadata-only additive DDL migration is isolated from
-- all index construction, foreign-key validation, and ownership backfill.
ALTER TABLE "SharedBusinessRecord" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "SharedBusinessRecordVersion" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "SharedRecordExportSnapshot" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "SharedRecordExportSnapshotItem" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "WorkflowEvent" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "LeadCustomer" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "LeadOwnershipHistory" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "SalesTask" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "SalesTextNote" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "SalesVoiceNote" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "SalesVoiceNoteAction" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "SalesDayReview" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "SalesDayReviewItem" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "PipelineStage" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "OpportunityOwnerSplit" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "SalesTarget" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "ProductService" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Proposal" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "ProposalLineItem" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "ProposalPdfAttachment" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "OrderLineItem" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "OrderOwnerSplitSnapshot" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "ProductionTemplate" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "ProductionTemplateStage" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "ProductionWorkItem" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "ProductionStageInstance" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "ProductionNote" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "PaymentAllocation" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "CostComponent" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Incentive" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "IncentiveSplit" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
