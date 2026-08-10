BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- The compound contracts installed in 120048 supersede the original global-id
-- foreign keys. Remove only the obsolete single-column copies so Prisma and
-- PostgreSQL describe the same tenant contract.
DO $$
DECLARE
  relation RECORD;
  old_constraint RECORD;
BEGIN
  FOR relation IN SELECT * FROM (VALUES
    ('SharedBusinessRecordVersion','recordId'), ('SharedRecordExportSnapshotItem','snapshotId'),
    ('Branch','leadCustomerId'), ('Contact','leadCustomerId'), ('Contact','branchId'),
    ('Activity','leadCustomerId'), ('Activity','branchId'), ('Activity','contactId'),
    ('SalesTask','leadCustomerId'), ('SalesTask','opportunityId'), ('SalesTask','proposalId'), ('SalesTask','orderId'),
    ('SalesTextNote','taskId'), ('SalesTextNote','leadCustomerId'), ('SalesTextNote','opportunityId'), ('SalesTextNote','proposalId'), ('SalesTextNote','orderId'),
    ('SalesVoiceNote','taskId'), ('SalesVoiceNote','leadCustomerId'), ('SalesVoiceNote','opportunityId'), ('SalesVoiceNote','proposalId'), ('SalesVoiceNote','orderId'),
    ('SalesVoiceNoteAction','voiceNoteId'), ('SalesVoiceNoteAction','createdTaskId'),
    ('SalesDayReviewItem','reviewId'), ('SalesDayReviewItem','taskId'), ('LeadOwnershipHistory','leadCustomerId'),
    ('Opportunity','leadCustomerId'), ('Opportunity','branchId'), ('Opportunity','stageId'),
    ('OpportunityOwnerSplit','opportunityId'), ('Proposal','opportunityId'),
    ('ProposalLineItem','proposalId'), ('ProposalLineItem','productServiceId'), ('ProposalPdfAttachment','proposalId'),
    ('Order','proposalId'), ('Order','opportunityId'), ('Order','leadCustomerId'), ('Order','branchId'),
    ('OrderLineItem','orderId'), ('OrderLineItem','proposalLineItemId'), ('OrderLineItem','productServiceId'),
    ('OrderOwnerSplitSnapshot','orderId'), ('ProductionTemplateStage','templateId'),
    ('ProductionWorkItem','orderLineItemId'), ('ProductionWorkItem','productionTemplateId'),
    ('ProductionStageInstance','workItemId'), ('ProductionStageInstance','templateStageId'),
    ('ProductionNote','workItemId'), ('ProductionNote','stageInstanceId'),
    ('Invoice','orderId'), ('Payment','orderId'), ('PaymentAllocation','paymentId'), ('PaymentAllocation','invoiceId'),
    ('CostComponent','orderId'), ('CostComponent','orderLineItemId'), ('Incentive','orderId'), ('IncentiveSplit','incentiveId')
  ) AS relationships(child_table, child_field)
  LOOP
    FOR old_constraint IN
      SELECT constraint_row.conname
      FROM pg_constraint constraint_row
      JOIN pg_attribute child_attribute ON child_attribute.attrelid = constraint_row.conrelid
        AND child_attribute.attnum = constraint_row.conkey[1]
      WHERE constraint_row.contype = 'f'
        AND constraint_row.conrelid = to_regclass(format('%I', relation.child_table))
        AND array_length(constraint_row.conkey, 1) = 1
        AND child_attribute.attname = relation.child_field
    LOOP
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', relation.child_table, old_constraint.conname);
    END LOOP;
  END LOOP;
END $$;

-- 120047 installed seven representative compound constraints before the
-- exhaustive, consistently named set. Retain only the exhaustive contracts.
ALTER TABLE "Branch" DROP CONSTRAINT IF EXISTS "Branch_organizationId_leadCustomerId_fkey";
ALTER TABLE "SalesTextNote" DROP CONSTRAINT IF EXISTS "SalesTextNote_organizationId_taskId_fkey";
ALTER TABLE "Proposal" DROP CONSTRAINT IF EXISTS "Proposal_organizationId_opportunityId_fkey";
ALTER TABLE "ProposalLineItem" DROP CONSTRAINT IF EXISTS "ProposalLineItem_organizationId_productServiceId_fkey";
ALTER TABLE "ProductionTemplateStage" DROP CONSTRAINT IF EXISTS "ProductionTemplateStage_organizationId_templateId_fkey";
ALTER TABLE "PaymentAllocation" DROP CONSTRAINT IF EXISTS "PaymentAllocation_organizationId_invoiceId_fkey";
ALTER TABLE "SharedBusinessRecordVersion" DROP CONSTRAINT IF EXISTS "SharedBusinessRecordVersion_organizationId_recordId_fkey";

-- Replace the remaining globally unique one-to-one business identifiers with
-- tenant-scoped contracts. Handle either constraint- or index-backed history.
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_proposalId_key";
ALTER TABLE "OrderLineItem" DROP CONSTRAINT IF EXISTS "OrderLineItem_proposalLineItemId_key";
ALTER TABLE "Incentive" DROP CONSTRAINT IF EXISTS "Incentive_orderId_key";
DROP INDEX IF EXISTS "Order_proposalId_key";
DROP INDEX IF EXISTS "OrderLineItem_proposalLineItemId_key";
DROP INDEX IF EXISTS "Incentive_orderId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Order_organizationId_proposalId_key" ON "Order"("organizationId", "proposalId");
CREATE UNIQUE INDEX IF NOT EXISTS "OrderLineItem_organizationId_proposalLineItemId_key" ON "OrderLineItem"("organizationId", "proposalLineItemId");
CREATE UNIQUE INDEX IF NOT EXISTS "Incentive_organizationId_orderId_key" ON "Incentive"("organizationId", "orderId");

COMMIT;
