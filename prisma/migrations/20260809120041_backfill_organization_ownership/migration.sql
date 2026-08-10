-- Stage 4: bounded tenant bootstrap, accounting, backfill, and reconciliation.
-- No DDL or concurrent index construction shares this transaction.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15min';

-- ARA Global is initial tenant data, not an application fallback.
INSERT INTO "Organization" (
  "id", "key", "legalName", "displayName", "status", "deploymentRegion", "createdAt", "updatedAt", "version"
)
VALUES (
  'org_ara_global', 'ara-global', 'ARA Global', 'ARA Global', 'ACTIVE', 'ap-south-1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1
)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "OrganizationSettings" (
  "id", "organizationId", "currency", "locale", "timezone", "defaultCountry",
  "taxConfiguration", "invoiceConfiguration", "paymentConfiguration", "numberingRules",
  "retentionPolicy", "financialClosePolicy", "enabledModules", "operationalLimits",
  "createdAt", "updatedAt", "version"
)
SELECT
  'org_settings_ara_global', "id", 'INR', 'en-IN', 'Asia/Kolkata', 'India',
  '{"taxSystem":"GST"}'::jsonb,
  '{"defaultCurrency":"INR"}'::jsonb,
  '{"defaultPaymentCycleDays":30}'::jsonb,
  '{"invoicePrefix":"ARA","orderPrefix":"ARA"}'::jsonb,
  '{"businessRecordDays":2555}'::jsonb,
  '{"timezone":"Asia/Kolkata"}'::jsonb,
  '["crm","sales","pipeline","proposals","orders","production","finance","incentives"]'::jsonb,
  '{}'::jsonb,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1
FROM "Organization"
WHERE "key" = 'ara-global'
ON CONFLICT ("organizationId") DO NOTHING;

INSERT INTO "OrganizationBranding" (
  "id", "organizationId", "productName", "primaryColor", "secondaryColor",
  "emailFromName", "documentFooter", "createdAt", "updatedAt", "version"
)
SELECT
  'org_branding_ara_global', "id", 'ARA Global eCRM', '#0F3D5E', '#D4A017',
  'ARA Global', 'ARA Global', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1
FROM "Organization"
WHERE "key" = 'ara-global'
ON CONFLICT ("organizationId") DO NOTHING;

-- Legacy membership mapping during expand:
-- User.role ADMIN -> OrganizationRole ADMIN; User.role SALES -> OrganizationRole SALES.
-- User.active true -> MembershipStatus ACTIVE; false -> MembershipStatus SUSPENDED.
-- ADMIN is intentionally not promoted to OWNER because the legacy role did not
-- prove legal ownership. Existing authorization remains on User.role in this phase.
INSERT INTO "OrganizationMembership" (
  "id", "organizationId", "userId", "role", "status", "createdAt", "updatedAt"
)
SELECT
  'membership_ara_' || md5(u."id"),
  o."id",
  u."id",
  CASE u."role"::text
    WHEN 'ADMIN' THEN 'ADMIN'::"OrganizationRole"
    WHEN 'SALES' THEN 'SALES'::"OrganizationRole"
  END,
  CASE
    WHEN u."active" THEN 'ACTIVE'::"MembershipStatus"
    ELSE 'SUSPENDED'::"MembershipStatus"
  END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u
CROSS JOIN "Organization" o
WHERE o."key" = 'ara-global'
  AND u."role"::text IN ('ADMIN', 'SALES')
ON CONFLICT ("organizationId", "userId") DO NOTHING;

-- Preserve the first observed counts across repeat executions.
DO $$
DECLARE
  tenant_table TEXT;
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY[
    'SharedBusinessRecord', 'SharedBusinessRecordVersion',
    'SharedRecordExportSnapshot', 'SharedRecordExportSnapshotItem', 'WorkflowEvent',
    'LeadCustomer', 'Branch', 'Contact', 'Activity', 'LeadOwnershipHistory',
    'SalesTask', 'SalesTextNote', 'SalesVoiceNote', 'SalesVoiceNoteAction',
    'SalesDayReview', 'SalesDayReviewItem', 'PipelineStage', 'Opportunity',
    'OpportunityOwnerSplit', 'SalesTarget', 'ProductService', 'Proposal',
    'ProposalLineItem', 'ProposalPdfAttachment', 'Order', 'OrderLineItem',
    'OrderOwnerSplitSnapshot', 'ProductionTemplate', 'ProductionTemplateStage',
    'ProductionWorkItem', 'ProductionStageInstance', 'ProductionNote', 'Invoice',
    'Payment', 'PaymentAllocation', 'CostComponent', 'Incentive', 'IncentiveSplit'
  ]
  LOOP
    EXECUTE format(
      'INSERT INTO "OrganizationTenancyMigrationReconciliation" ("migrationKey", "tableName", "beforeCount", "afterCount", "nullCount", "mismatchCount") SELECT %L, %L, COUNT(*), 0, COUNT(*) FILTER (WHERE "organizationId" IS NULL), 0 FROM %I ON CONFLICT ("migrationKey", "tableName") DO NOTHING',
      '20260809120000_add_organization_tenancy', tenant_table, tenant_table
    );
  END LOOP;
END $$;

-- True roots and legacy user-owned workspace/config records have one valid
-- current tenant, ARA Global. Children derive ownership from their parents.
UPDATE "SharedBusinessRecord" SET "organizationId" = (SELECT "id" FROM "Organization" WHERE "key" = 'ara-global') WHERE "organizationId" IS NULL;
UPDATE "SharedRecordExportSnapshot" SET "organizationId" = (SELECT "id" FROM "Organization" WHERE "key" = 'ara-global') WHERE "organizationId" IS NULL;
UPDATE "WorkflowEvent" SET "organizationId" = (SELECT "id" FROM "Organization" WHERE "key" = 'ara-global') WHERE "organizationId" IS NULL;
UPDATE "LeadCustomer" SET "organizationId" = (SELECT "id" FROM "Organization" WHERE "key" = 'ara-global') WHERE "organizationId" IS NULL;
UPDATE "SalesDayReview" SET "organizationId" = (SELECT "id" FROM "Organization" WHERE "key" = 'ara-global') WHERE "organizationId" IS NULL;
UPDATE "PipelineStage" SET "organizationId" = (SELECT "id" FROM "Organization" WHERE "key" = 'ara-global') WHERE "organizationId" IS NULL;
UPDATE "SalesTarget" SET "organizationId" = (SELECT "id" FROM "Organization" WHERE "key" = 'ara-global') WHERE "organizationId" IS NULL;
UPDATE "ProductService" SET "organizationId" = (SELECT "id" FROM "Organization" WHERE "key" = 'ara-global') WHERE "organizationId" IS NULL;
UPDATE "ProductionTemplate" SET "organizationId" = (SELECT "id" FROM "Organization" WHERE "key" = 'ara-global') WHERE "organizationId" IS NULL;

UPDATE "SharedBusinessRecordVersion" child SET "organizationId" = parent."organizationId" FROM "SharedBusinessRecord" parent WHERE child."recordId" = parent."id" AND child."organizationId" IS NULL;
UPDATE "SharedRecordExportSnapshotItem" child SET "organizationId" = parent."organizationId" FROM "SharedRecordExportSnapshot" parent WHERE child."snapshotId" = parent."id" AND child."organizationId" IS NULL;
UPDATE "Branch" child SET "organizationId" = parent."organizationId" FROM "LeadCustomer" parent WHERE child."leadCustomerId" = parent."id" AND child."organizationId" IS NULL;
UPDATE "Contact" child SET "organizationId" = parent."organizationId" FROM "LeadCustomer" parent WHERE child."leadCustomerId" = parent."id" AND child."organizationId" IS NULL;
UPDATE "Activity" child SET "organizationId" = parent."organizationId" FROM "LeadCustomer" parent WHERE child."leadCustomerId" = parent."id" AND child."organizationId" IS NULL;
UPDATE "LeadOwnershipHistory" child SET "organizationId" = parent."organizationId" FROM "LeadCustomer" parent WHERE child."leadCustomerId" = parent."id" AND child."organizationId" IS NULL;
UPDATE "Opportunity" child SET "organizationId" = parent."organizationId" FROM "LeadCustomer" parent WHERE child."leadCustomerId" = parent."id" AND child."organizationId" IS NULL;
UPDATE "OpportunityOwnerSplit" child SET "organizationId" = parent."organizationId" FROM "Opportunity" parent WHERE child."opportunityId" = parent."id" AND child."organizationId" IS NULL;
UPDATE "Proposal" child SET "organizationId" = parent."organizationId" FROM "Opportunity" parent WHERE child."opportunityId" = parent."id" AND child."organizationId" IS NULL;
UPDATE "ProposalLineItem" child SET "organizationId" = parent."organizationId" FROM "Proposal" parent WHERE child."proposalId" = parent."id" AND child."organizationId" IS NULL;
UPDATE "ProposalPdfAttachment" child SET "organizationId" = parent."organizationId" FROM "Proposal" parent WHERE child."proposalId" = parent."id" AND child."organizationId" IS NULL;
UPDATE "Order" child SET "organizationId" = parent."organizationId" FROM "Proposal" parent WHERE child."proposalId" = parent."id" AND child."organizationId" IS NULL;
UPDATE "OrderLineItem" child SET "organizationId" = parent."organizationId" FROM "Order" parent WHERE child."orderId" = parent."id" AND child."organizationId" IS NULL;
UPDATE "OrderOwnerSplitSnapshot" child SET "organizationId" = parent."organizationId" FROM "Order" parent WHERE child."orderId" = parent."id" AND child."organizationId" IS NULL;
UPDATE "ProductionTemplateStage" child SET "organizationId" = parent."organizationId" FROM "ProductionTemplate" parent WHERE child."templateId" = parent."id" AND child."organizationId" IS NULL;
UPDATE "ProductionWorkItem" child SET "organizationId" = parent."organizationId" FROM "OrderLineItem" parent WHERE child."orderLineItemId" = parent."id" AND child."organizationId" IS NULL;
UPDATE "ProductionStageInstance" child SET "organizationId" = parent."organizationId" FROM "ProductionWorkItem" parent WHERE child."workItemId" = parent."id" AND child."organizationId" IS NULL;
UPDATE "ProductionNote" child SET "organizationId" = parent."organizationId" FROM "ProductionWorkItem" parent WHERE child."workItemId" = parent."id" AND child."organizationId" IS NULL;
UPDATE "Invoice" child SET "organizationId" = parent."organizationId" FROM "Order" parent WHERE child."orderId" = parent."id" AND child."organizationId" IS NULL;
UPDATE "Payment" child SET "organizationId" = parent."organizationId" FROM "Order" parent WHERE child."orderId" = parent."id" AND child."organizationId" IS NULL;
UPDATE "PaymentAllocation" child SET "organizationId" = parent."organizationId" FROM "Payment" parent WHERE child."paymentId" = parent."id" AND child."organizationId" IS NULL;
UPDATE "CostComponent" child SET "organizationId" = parent."organizationId" FROM "Order" parent WHERE child."orderId" = parent."id" AND child."organizationId" IS NULL;
UPDATE "Incentive" child SET "organizationId" = parent."organizationId" FROM "Order" parent WHERE child."orderId" = parent."id" AND child."organizationId" IS NULL;
UPDATE "IncentiveSplit" child SET "organizationId" = parent."organizationId" FROM "Incentive" parent WHERE child."incentiveId" = parent."id" AND child."organizationId" IS NULL;

UPDATE "SalesTask" child
SET "organizationId" = COALESCE(
  (SELECT "organizationId" FROM "LeadCustomer" WHERE "id" = child."leadCustomerId"),
  (SELECT "organizationId" FROM "Opportunity" WHERE "id" = child."opportunityId"),
  (SELECT "organizationId" FROM "Proposal" WHERE "id" = child."proposalId"),
  (SELECT "organizationId" FROM "Order" WHERE "id" = child."orderId"),
  (SELECT "id" FROM "Organization" WHERE "key" = 'ara-global')
)
WHERE child."organizationId" IS NULL;

UPDATE "SalesTextNote" child
SET "organizationId" = COALESCE(
  (SELECT "organizationId" FROM "SalesTask" WHERE "id" = child."taskId"),
  (SELECT "organizationId" FROM "LeadCustomer" WHERE "id" = child."leadCustomerId"),
  (SELECT "organizationId" FROM "Opportunity" WHERE "id" = child."opportunityId"),
  (SELECT "organizationId" FROM "Proposal" WHERE "id" = child."proposalId"),
  (SELECT "organizationId" FROM "Order" WHERE "id" = child."orderId"),
  (SELECT "id" FROM "Organization" WHERE "key" = 'ara-global')
)
WHERE child."organizationId" IS NULL;

UPDATE "SalesVoiceNote" child
SET "organizationId" = COALESCE(
  (SELECT "organizationId" FROM "SalesTask" WHERE "id" = child."taskId"),
  (SELECT "organizationId" FROM "LeadCustomer" WHERE "id" = child."leadCustomerId"),
  (SELECT "organizationId" FROM "Opportunity" WHERE "id" = child."opportunityId"),
  (SELECT "organizationId" FROM "Proposal" WHERE "id" = child."proposalId"),
  (SELECT "organizationId" FROM "Order" WHERE "id" = child."orderId"),
  (SELECT "id" FROM "Organization" WHERE "key" = 'ara-global')
)
WHERE child."organizationId" IS NULL;

UPDATE "SalesVoiceNoteAction" child SET "organizationId" = parent."organizationId" FROM "SalesVoiceNote" parent WHERE child."voiceNoteId" = parent."id" AND child."organizationId" IS NULL;
UPDATE "SalesDayReviewItem" child SET "organizationId" = parent."organizationId" FROM "SalesDayReview" parent WHERE child."reviewId" = parent."id" AND child."organizationId" IS NULL;

-- Reconciliation checks every tenant-to-tenant foreign-key relationship. A
-- root table has mismatchCount zero by definition, but still receives count
-- and unresolved-row accounting in the durable artifact.
UPDATE "OrganizationTenancyMigrationReconciliation"
SET "mismatchCount" = 0, "updatedAt" = CURRENT_TIMESTAMP
WHERE "migrationKey" = '20260809120000_add_organization_tenancy';

CREATE TEMP TABLE "_OrganizationParentChecks" (
  "childTable" TEXT NOT NULL,
  "parentTable" TEXT NOT NULL,
  "foreignKey" TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO "_OrganizationParentChecks" ("childTable", "parentTable", "foreignKey") VALUES
  ('SharedBusinessRecord', 'SharedBusinessRecord', 'parentId'),
  ('SharedBusinessRecordVersion', 'SharedBusinessRecord', 'recordId'),
  ('SharedRecordExportSnapshotItem', 'SharedRecordExportSnapshot', 'snapshotId'),
  ('Branch', 'LeadCustomer', 'leadCustomerId'),
  ('Contact', 'LeadCustomer', 'leadCustomerId'), ('Contact', 'Branch', 'branchId'),
  ('Activity', 'LeadCustomer', 'leadCustomerId'), ('Activity', 'Branch', 'branchId'), ('Activity', 'Contact', 'contactId'),
  ('LeadOwnershipHistory', 'LeadCustomer', 'leadCustomerId'),
  ('SalesTask', 'LeadCustomer', 'leadCustomerId'), ('SalesTask', 'Opportunity', 'opportunityId'), ('SalesTask', 'Proposal', 'proposalId'), ('SalesTask', 'Order', 'orderId'),
  ('SalesTextNote', 'SalesTask', 'taskId'), ('SalesTextNote', 'LeadCustomer', 'leadCustomerId'), ('SalesTextNote', 'Opportunity', 'opportunityId'), ('SalesTextNote', 'Proposal', 'proposalId'), ('SalesTextNote', 'Order', 'orderId'),
  ('SalesVoiceNote', 'SalesTask', 'taskId'), ('SalesVoiceNote', 'LeadCustomer', 'leadCustomerId'), ('SalesVoiceNote', 'Opportunity', 'opportunityId'), ('SalesVoiceNote', 'Proposal', 'proposalId'), ('SalesVoiceNote', 'Order', 'orderId'),
  ('SalesVoiceNoteAction', 'SalesVoiceNote', 'voiceNoteId'), ('SalesVoiceNoteAction', 'SalesTask', 'createdTaskId'),
  ('SalesDayReviewItem', 'SalesDayReview', 'reviewId'), ('SalesDayReviewItem', 'SalesTask', 'taskId'),
  ('Opportunity', 'LeadCustomer', 'leadCustomerId'), ('Opportunity', 'Branch', 'branchId'), ('Opportunity', 'PipelineStage', 'stageId'),
  ('OpportunityOwnerSplit', 'Opportunity', 'opportunityId'),
  ('Proposal', 'Opportunity', 'opportunityId'),
  ('ProposalLineItem', 'Proposal', 'proposalId'), ('ProposalLineItem', 'ProductService', 'productServiceId'),
  ('ProposalPdfAttachment', 'Proposal', 'proposalId'),
  ('Order', 'Proposal', 'proposalId'), ('Order', 'Opportunity', 'opportunityId'), ('Order', 'LeadCustomer', 'leadCustomerId'), ('Order', 'Branch', 'branchId'),
  ('OrderLineItem', 'Order', 'orderId'), ('OrderLineItem', 'ProposalLineItem', 'proposalLineItemId'), ('OrderLineItem', 'ProductService', 'productServiceId'),
  ('OrderOwnerSplitSnapshot', 'Order', 'orderId'),
  ('ProductionTemplateStage', 'ProductionTemplate', 'templateId'),
  ('ProductionWorkItem', 'OrderLineItem', 'orderLineItemId'), ('ProductionWorkItem', 'ProductionTemplate', 'productionTemplateId'),
  ('ProductionStageInstance', 'ProductionWorkItem', 'workItemId'), ('ProductionStageInstance', 'ProductionTemplateStage', 'templateStageId'),
  ('ProductionNote', 'ProductionWorkItem', 'workItemId'), ('ProductionNote', 'ProductionStageInstance', 'stageInstanceId'),
  ('Invoice', 'Order', 'orderId'), ('Payment', 'Order', 'orderId'),
  ('PaymentAllocation', 'Payment', 'paymentId'), ('PaymentAllocation', 'Invoice', 'invoiceId'),
  ('CostComponent', 'Order', 'orderId'), ('CostComponent', 'OrderLineItem', 'orderLineItemId'),
  ('Incentive', 'Order', 'orderId'), ('IncentiveSplit', 'Incentive', 'incentiveId');

DO $$
DECLARE
  parent_check RECORD;
  mismatch_total BIGINT;
BEGIN
  FOR parent_check IN SELECT * FROM "_OrganizationParentChecks"
  LOOP
    EXECUTE format(
      'SELECT COUNT(*) FROM %I child LEFT JOIN %I parent ON parent."id" = child.%I WHERE child.%I IS NOT NULL AND (parent."id" IS NULL OR child."organizationId" IS DISTINCT FROM parent."organizationId")',
      parent_check."childTable", parent_check."parentTable", parent_check."foreignKey", parent_check."foreignKey"
    ) INTO mismatch_total;

    UPDATE "OrganizationTenancyMigrationReconciliation"
    SET "mismatchCount" = "mismatchCount" + mismatch_total,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "migrationKey" = '20260809120000_add_organization_tenancy'
      AND "tableName" = parent_check."childTable";
  END LOOP;
END $$;

DO $$
DECLARE
  tenant_table TEXT;
  after_count BIGINT;
  null_count BIGINT;
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY[
    'SharedBusinessRecord', 'SharedBusinessRecordVersion',
    'SharedRecordExportSnapshot', 'SharedRecordExportSnapshotItem', 'WorkflowEvent',
    'LeadCustomer', 'Branch', 'Contact', 'Activity', 'LeadOwnershipHistory',
    'SalesTask', 'SalesTextNote', 'SalesVoiceNote', 'SalesVoiceNoteAction',
    'SalesDayReview', 'SalesDayReviewItem', 'PipelineStage', 'Opportunity',
    'OpportunityOwnerSplit', 'SalesTarget', 'ProductService', 'Proposal',
    'ProposalLineItem', 'ProposalPdfAttachment', 'Order', 'OrderLineItem',
    'OrderOwnerSplitSnapshot', 'ProductionTemplate', 'ProductionTemplateStage',
    'ProductionWorkItem', 'ProductionStageInstance', 'ProductionNote', 'Invoice',
    'Payment', 'PaymentAllocation', 'CostComponent', 'Incentive', 'IncentiveSplit'
  ]
  LOOP
    EXECUTE format(
      'SELECT COUNT(*), COUNT(*) FILTER (WHERE "organizationId" IS NULL) FROM %I',
      tenant_table
    ) INTO after_count, null_count;

    UPDATE "OrganizationTenancyMigrationReconciliation"
    SET "afterCount" = after_count,
        "nullCount" = null_count,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "migrationKey" = '20260809120000_add_organization_tenancy'
      AND "tableName" = tenant_table;
  END LOOP;
END $$;

DO $$
DECLARE
  unresolved_total BIGINT;
  mismatch_total BIGINT;
  count_mismatch_total BIGINT;
BEGIN
  SELECT COALESCE(SUM("nullCount"), 0),
         COALESCE(SUM("mismatchCount"), 0),
         COUNT(*) FILTER (WHERE "beforeCount" <> "afterCount")
  INTO unresolved_total, mismatch_total, count_mismatch_total
  FROM "OrganizationTenancyMigrationReconciliation"
  WHERE "migrationKey" = '20260809120000_add_organization_tenancy';

  IF unresolved_total > 0 THEN
    RAISE EXCEPTION 'Organization tenancy backfill unresolved: % rows still have null organizationId', unresolved_total;
  END IF;

  IF mismatch_total > 0 THEN
    RAISE EXCEPTION 'Organization tenancy backfill mismatch: % parent/child organization relationships disagree', mismatch_total;
  END IF;

  IF count_mismatch_total > 0 THEN
    RAISE EXCEPTION 'Organization tenancy reconciliation count mismatch: % tables changed row count', count_mismatch_total;
  END IF;
END $$;

COMMIT;
