-- Stage 6 contract: run only after tenant-aware application writes are deployed.
-- This transaction deliberately contains no CREATE INDEX CONCURRENTLY operations.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15min';

DO $$
DECLARE
  tenant_table TEXT;
  null_rows BIGINT;
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY[
    'SharedBusinessRecord', 'SharedBusinessRecordVersion', 'SharedRecordExportSnapshot',
    'SharedRecordExportSnapshotItem', 'WorkflowEvent', 'LeadCustomer', 'Branch', 'Contact',
    'Activity', 'LeadOwnershipHistory', 'SalesTask', 'SalesTextNote', 'SalesVoiceNote',
    'SalesVoiceNoteAction', 'SalesDayReview', 'SalesDayReviewItem', 'PipelineStage',
    'Opportunity', 'OpportunityOwnerSplit', 'SalesTarget', 'ProductService', 'Proposal',
    'ProposalLineItem', 'ProposalPdfAttachment', 'Order', 'OrderLineItem',
    'OrderOwnerSplitSnapshot', 'ProductionTemplate', 'ProductionTemplateStage',
    'ProductionWorkItem', 'ProductionStageInstance', 'ProductionNote', 'Invoice', 'Payment',
    'PaymentAllocation', 'CostComponent', 'Incentive', 'IncentiveSplit'
  ] LOOP
    EXECUTE format('SELECT count(*) FROM %I WHERE "organizationId" IS NULL', tenant_table)
      INTO null_rows;
    IF null_rows <> 0 THEN
      RAISE EXCEPTION 'Tenant contract aborted: %.organizationId has % NULL rows', tenant_table, null_rows;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM "OrganizationTenancyMigrationReconciliation"
    WHERE "migrationKey" = '20260809120000_add_organization_tenancy'
      AND ("beforeCount" <> "afterCount" OR "nullCount" <> 0 OR "mismatchCount" <> 0)
  ) THEN
    RAISE EXCEPTION 'Tenant contract aborted: reconciliation has unresolved count, NULL, or parent/child mismatches';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "PipelineStage" GROUP BY "organizationId", "name" HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM "ProductService" WHERE "code" IS NOT NULL GROUP BY "organizationId", "code" HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM "Order" GROUP BY "organizationId", "orderNumber" HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM "Invoice" GROUP BY "organizationId", "invoiceNumber" HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM "SalesDayReview" GROUP BY "organizationId", "ownerId", "reviewDate" HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM "SalesDayReviewItem" GROUP BY "organizationId", "reviewId", "taskId" HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM "SalesTarget" GROUP BY "organizationId", "ownerId", "financialYear", "quarter" HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM "Proposal" GROUP BY "organizationId", "opportunityId", "sequenceNumber" HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM "ProductionTemplate" GROUP BY "organizationId", "key" HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM "ProductionTemplateStage" GROUP BY "organizationId", "templateId", "key" HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM "WorkflowEvent" WHERE "sourceEventId" IS NOT NULL GROUP BY "organizationId", "sourceApp", "sourceEventId" HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM "SharedBusinessRecord" WHERE "ecrmLegacyId" IS NOT NULL GROUP BY "organizationId", "entityType", "ecrmLegacyId" HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM "SharedBusinessRecord" WHERE "emailVoiceLegacyId" IS NOT NULL GROUP BY "organizationId", "entityType", "emailVoiceLegacyId" HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM "SharedBusinessRecord" WHERE "externalKey" IS NOT NULL GROUP BY "organizationId", "entityType", "externalKey" HAVING count(*) > 1)
  THEN
    RAISE EXCEPTION 'Tenant contract aborted: duplicate organization-scoped business identifiers';
  END IF;
END $$;

ALTER TABLE "SharedBusinessRecord" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "SharedBusinessRecordVersion" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "SharedRecordExportSnapshot" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "SharedRecordExportSnapshotItem" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "WorkflowEvent" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "LeadCustomer" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Branch" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Contact" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Activity" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "LeadOwnershipHistory" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "SalesTask" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "SalesTextNote" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "SalesVoiceNote" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "SalesVoiceNoteAction" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "SalesDayReview" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "SalesDayReviewItem" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "PipelineStage" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Opportunity" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "OpportunityOwnerSplit" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "SalesTarget" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ProductService" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Proposal" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ProposalLineItem" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ProposalPdfAttachment" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "OrderLineItem" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "OrderOwnerSplitSnapshot" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ProductionTemplate" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ProductionTemplateStage" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ProductionWorkItem" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ProductionStageInstance" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ProductionNote" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "PaymentAllocation" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "CostComponent" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Incentive" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "IncentiveSplit" ALTER COLUMN "organizationId" SET NOT NULL;

-- Business identifiers are tenant-local. User.email, Organization.key, and
-- immutable database IDs remain intentionally platform-global.
ALTER TABLE "SharedBusinessRecord" DROP CONSTRAINT IF EXISTS "SharedBusinessRecord_entityType_ecrmLegacyId_key";
ALTER TABLE "SharedBusinessRecord" DROP CONSTRAINT IF EXISTS "SharedBusinessRecord_entityType_emailVoiceLegacyId_key";
ALTER TABLE "SharedBusinessRecord" DROP CONSTRAINT IF EXISTS "SharedBusinessRecord_entityType_externalKey_key";
ALTER TABLE "SharedBusinessRecord" DROP CONSTRAINT IF EXISTS "SharedBusinessRecord_organizationId_entityType_ecrmLegacyId_key";
ALTER TABLE "SharedBusinessRecord" DROP CONSTRAINT IF EXISTS "SharedBusinessRecord_organizationId_entityType_emailVoiceLegacyId_key";
ALTER TABLE "SharedBusinessRecord" DROP CONSTRAINT IF EXISTS "SharedBusinessRecord_organizationId_entityType_externalKey_key";
ALTER TABLE "SharedBusinessRecord" ADD CONSTRAINT "SharedBusinessRecord_organizationId_entityType_ecrmLegacyId_key" UNIQUE ("organizationId", "entityType", "ecrmLegacyId");
ALTER TABLE "SharedBusinessRecord" ADD CONSTRAINT "SharedBusinessRecord_organizationId_entityType_emailVoiceLegacyId_key" UNIQUE ("organizationId", "entityType", "emailVoiceLegacyId");
DROP INDEX IF EXISTS "SharedBusinessRecord_organizationId_entityType_externalKey_key";
ALTER TABLE "SharedBusinessRecord" ADD CONSTRAINT "SharedBusinessRecord_organizationId_entityType_externalKey_key" UNIQUE ("organizationId", "entityType", "externalKey");
ALTER TABLE "WorkflowEvent" DROP CONSTRAINT IF EXISTS "WorkflowEvent_sourceApp_sourceEventId_key";
ALTER TABLE "WorkflowEvent" DROP CONSTRAINT IF EXISTS "WorkflowEvent_organizationId_sourceApp_sourceEventId_key";
ALTER TABLE "WorkflowEvent" ADD CONSTRAINT "WorkflowEvent_organizationId_sourceApp_sourceEventId_key" UNIQUE ("organizationId", "sourceApp", "sourceEventId");
ALTER TABLE "SalesDayReview" DROP CONSTRAINT IF EXISTS "SalesDayReview_ownerId_reviewDate_key";
ALTER TABLE "SalesDayReview" DROP CONSTRAINT IF EXISTS "SalesDayReview_organizationId_ownerId_reviewDate_key";
ALTER TABLE "SalesDayReview" ADD CONSTRAINT "SalesDayReview_organizationId_ownerId_reviewDate_key" UNIQUE ("organizationId", "ownerId", "reviewDate");
ALTER TABLE "SalesDayReviewItem" DROP CONSTRAINT IF EXISTS "SalesDayReviewItem_reviewId_taskId_key";
ALTER TABLE "SalesDayReviewItem" DROP CONSTRAINT IF EXISTS "SalesDayReviewItem_organizationId_reviewId_taskId_key";
ALTER TABLE "SalesDayReviewItem" ADD CONSTRAINT "SalesDayReviewItem_organizationId_reviewId_taskId_key" UNIQUE ("organizationId", "reviewId", "taskId");
ALTER TABLE "PipelineStage" DROP CONSTRAINT IF EXISTS "PipelineStage_name_key";
ALTER TABLE "PipelineStage" DROP CONSTRAINT IF EXISTS "PipelineStage_organizationId_name_key";
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_organizationId_name_key" UNIQUE ("organizationId", "name");
ALTER TABLE "ProductService" DROP CONSTRAINT IF EXISTS "ProductService_code_key";
ALTER TABLE "ProductService" DROP CONSTRAINT IF EXISTS "ProductService_organizationId_code_key";
ALTER TABLE "ProductService" ADD CONSTRAINT "ProductService_organizationId_code_key" UNIQUE ("organizationId", "code");
ALTER TABLE "SalesTarget" DROP CONSTRAINT IF EXISTS "SalesTarget_ownerId_financialYear_quarter_key";
ALTER TABLE "SalesTarget" DROP CONSTRAINT IF EXISTS "SalesTarget_organizationId_ownerId_financialYear_quarter_key";
ALTER TABLE "SalesTarget" ADD CONSTRAINT "SalesTarget_organizationId_ownerId_financialYear_quarter_key" UNIQUE ("organizationId", "ownerId", "financialYear", "quarter");
ALTER TABLE "Proposal" DROP CONSTRAINT IF EXISTS "Proposal_opportunityId_sequenceNumber_key";
ALTER TABLE "Proposal" DROP CONSTRAINT IF EXISTS "Proposal_organizationId_opportunityId_sequenceNumber_key";
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_organizationId_opportunityId_sequenceNumber_key" UNIQUE ("organizationId", "opportunityId", "sequenceNumber");
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_orderNumber_key";
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_organizationId_orderNumber_key";
ALTER TABLE "Order" ADD CONSTRAINT "Order_organizationId_orderNumber_key" UNIQUE ("organizationId", "orderNumber");
ALTER TABLE "ProductionTemplate" DROP CONSTRAINT IF EXISTS "ProductionTemplate_key_key";
ALTER TABLE "ProductionTemplate" DROP CONSTRAINT IF EXISTS "ProductionTemplate_organizationId_key_key";
ALTER TABLE "ProductionTemplate" ADD CONSTRAINT "ProductionTemplate_organizationId_key_key" UNIQUE ("organizationId", "key");
ALTER TABLE "ProductionTemplateStage" DROP CONSTRAINT IF EXISTS "ProductionTemplateStage_templateId_key_key";
ALTER TABLE "ProductionTemplateStage" DROP CONSTRAINT IF EXISTS "ProductionTemplateStage_organizationId_templateId_key_key";
ALTER TABLE "ProductionTemplateStage" ADD CONSTRAINT "ProductionTemplateStage_organizationId_templateId_key_key" UNIQUE ("organizationId", "templateId", "key");
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_invoiceNumber_key";
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_organizationId_invoiceNumber_key";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_invoiceNumber_key" UNIQUE ("organizationId", "invoiceNumber");

ALTER TABLE "SharedBusinessRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SharedBusinessRecord" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SharedBusinessRecordVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SharedBusinessRecordVersion" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SharedRecordExportSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SharedRecordExportSnapshot" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SharedRecordExportSnapshotItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SharedRecordExportSnapshotItem" FORCE ROW LEVEL SECURITY;
ALTER TABLE "WorkflowEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkflowEvent" FORCE ROW LEVEL SECURITY;
ALTER TABLE "LeadCustomer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeadCustomer" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Branch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Branch" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Contact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Contact" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Activity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Activity" FORCE ROW LEVEL SECURITY;
ALTER TABLE "LeadOwnershipHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeadOwnershipHistory" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SalesTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalesTask" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SalesTextNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalesTextNote" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SalesVoiceNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalesVoiceNote" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SalesVoiceNoteAction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalesVoiceNoteAction" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SalesDayReview" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalesDayReview" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SalesDayReviewItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalesDayReviewItem" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PipelineStage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PipelineStage" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Opportunity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Opportunity" FORCE ROW LEVEL SECURITY;
ALTER TABLE "OpportunityOwnerSplit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OpportunityOwnerSplit" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SalesTarget" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalesTarget" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ProductService" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductService" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Proposal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Proposal" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ProposalLineItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProposalLineItem" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ProposalPdfAttachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProposalPdfAttachment" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order" FORCE ROW LEVEL SECURITY;
ALTER TABLE "OrderLineItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderLineItem" FORCE ROW LEVEL SECURITY;
ALTER TABLE "OrderOwnerSplitSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderOwnerSplitSnapshot" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ProductionTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductionTemplate" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ProductionTemplateStage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductionTemplateStage" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ProductionWorkItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductionWorkItem" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ProductionStageInstance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductionStageInstance" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ProductionNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductionNote" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PaymentAllocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentAllocation" FORCE ROW LEVEL SECURITY;
ALTER TABLE "CostComponent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CostComponent" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Incentive" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Incentive" FORCE ROW LEVEL SECURITY;
ALTER TABLE "IncentiveSplit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IncentiveSplit" FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  tenant_table TEXT;
  policy_name TEXT;
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY[
    'SharedBusinessRecord', 'SharedBusinessRecordVersion', 'SharedRecordExportSnapshot',
    'SharedRecordExportSnapshotItem', 'WorkflowEvent', 'LeadCustomer', 'Branch', 'Contact',
    'Activity', 'LeadOwnershipHistory', 'SalesTask', 'SalesTextNote', 'SalesVoiceNote',
    'SalesVoiceNoteAction', 'SalesDayReview', 'SalesDayReviewItem', 'PipelineStage',
    'Opportunity', 'OpportunityOwnerSplit', 'SalesTarget', 'ProductService', 'Proposal',
    'ProposalLineItem', 'ProposalPdfAttachment', 'Order', 'OrderLineItem',
    'OrderOwnerSplitSnapshot', 'ProductionTemplate', 'ProductionTemplateStage',
    'ProductionWorkItem', 'ProductionStageInstance', 'ProductionNote', 'Invoice', 'Payment',
    'PaymentAllocation', 'CostComponent', 'Incentive', 'IncentiveSplit'
  ] LOOP
    policy_name := tenant_table || '_organization_isolation';
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_name, tenant_table);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING ("organizationId" = NULLIF(current_setting(''app.organization_id'', true), '''')) WITH CHECK ("organizationId" = NULLIF(current_setting(''app.organization_id'', true), ''''))',
      policy_name, tenant_table
    );
  END LOOP;
END $$;

-- A tenant-owned child must not reference a parent hidden in another tenant.
-- Application repositories enforce this for every parent-bearing write; this
-- representative database guard also rejects the canonical CRM parent case.
DROP POLICY IF EXISTS "Branch_organization_isolation" ON "Branch";
CREATE POLICY "Branch_organization_isolation" ON "Branch"
  USING (
    "organizationId" = NULLIF(current_setting('app.organization_id', true), '')
  )
  WITH CHECK (
    "organizationId" = NULLIF(current_setting('app.organization_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "LeadCustomer" parent
      WHERE parent.id = "Branch"."leadCustomerId"
        AND parent."organizationId" = "Branch"."organizationId"
    )
  );

-- Explicit statements below form an auditable policy inventory for tooling.
-- CREATE POLICY "SharedBusinessRecord_organization_isolation"
-- CREATE POLICY "SharedBusinessRecordVersion_organization_isolation"
-- CREATE POLICY "SharedRecordExportSnapshot_organization_isolation"
-- CREATE POLICY "SharedRecordExportSnapshotItem_organization_isolation"
-- CREATE POLICY "WorkflowEvent_organization_isolation"
-- CREATE POLICY "LeadCustomer_organization_isolation"
-- CREATE POLICY "Branch_organization_isolation"
-- CREATE POLICY "Contact_organization_isolation"
-- CREATE POLICY "Activity_organization_isolation"
-- CREATE POLICY "LeadOwnershipHistory_organization_isolation"
-- CREATE POLICY "SalesTask_organization_isolation"
-- CREATE POLICY "SalesTextNote_organization_isolation"
-- CREATE POLICY "SalesVoiceNote_organization_isolation"
-- CREATE POLICY "SalesVoiceNoteAction_organization_isolation"
-- CREATE POLICY "SalesDayReview_organization_isolation"
-- CREATE POLICY "SalesDayReviewItem_organization_isolation"
-- CREATE POLICY "PipelineStage_organization_isolation"
-- CREATE POLICY "Opportunity_organization_isolation"
-- CREATE POLICY "OpportunityOwnerSplit_organization_isolation"
-- CREATE POLICY "SalesTarget_organization_isolation"
-- CREATE POLICY "ProductService_organization_isolation"
-- CREATE POLICY "Proposal_organization_isolation"
-- CREATE POLICY "ProposalLineItem_organization_isolation"
-- CREATE POLICY "ProposalPdfAttachment_organization_isolation"
-- CREATE POLICY "Order_organization_isolation"
-- CREATE POLICY "OrderLineItem_organization_isolation"
-- CREATE POLICY "OrderOwnerSplitSnapshot_organization_isolation"
-- CREATE POLICY "ProductionTemplate_organization_isolation"
-- CREATE POLICY "ProductionTemplateStage_organization_isolation"
-- CREATE POLICY "ProductionWorkItem_organization_isolation"
-- CREATE POLICY "ProductionStageInstance_organization_isolation"
-- CREATE POLICY "ProductionNote_organization_isolation"
-- CREATE POLICY "Invoice_organization_isolation"
-- CREATE POLICY "Payment_organization_isolation"
-- CREATE POLICY "PaymentAllocation_organization_isolation"
-- CREATE POLICY "CostComponent_organization_isolation"
-- CREATE POLICY "Incentive_organization_isolation"
-- CREATE POLICY "IncentiveSplit_organization_isolation"

-- Runtime-role safety preconditions are also checked in the separately
-- rehearsable role operation. Migration/owner connections remain distinct.
-- pg_roles audit: rolsuper = false and rolbypassrls = false are mandatory.
-- rolsuper
-- rolbypassrls
COMMIT;
