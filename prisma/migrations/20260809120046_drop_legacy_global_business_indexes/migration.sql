BEGIN;

-- Prisma's original @unique declarations were emitted as unique indexes, not
-- ALTER TABLE constraints. The contract stage used DROP CONSTRAINT defensively,
-- so ensure the tenant-scoped indexes exist before removing those legacy indexes.
CREATE UNIQUE INDEX IF NOT EXISTS "SharedBusinessRecord_organizationId_entityType_ecrmLegacyId_key"
  ON "SharedBusinessRecord"("organizationId", "entityType", "ecrmLegacyId");
CREATE UNIQUE INDEX IF NOT EXISTS "SharedBusinessRecord_organizationId_entityType_emailVoiceLegacyId_key"
  ON "SharedBusinessRecord"("organizationId", "entityType", "emailVoiceLegacyId");
CREATE UNIQUE INDEX IF NOT EXISTS "SharedBusinessRecord_organizationId_entityType_externalKey_key"
  ON "SharedBusinessRecord"("organizationId", "entityType", "externalKey");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowEvent_organizationId_sourceApp_sourceEventId_key"
  ON "WorkflowEvent"("organizationId", "sourceApp", "sourceEventId");
CREATE UNIQUE INDEX IF NOT EXISTS "SalesDayReview_organizationId_ownerId_reviewDate_key"
  ON "SalesDayReview"("organizationId", "ownerId", "reviewDate");
CREATE UNIQUE INDEX IF NOT EXISTS "SalesDayReviewItem_organizationId_reviewId_taskId_key"
  ON "SalesDayReviewItem"("organizationId", "reviewId", "taskId");
CREATE UNIQUE INDEX IF NOT EXISTS "PipelineStage_organizationId_name_key"
  ON "PipelineStage"("organizationId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductService_organizationId_code_key"
  ON "ProductService"("organizationId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "SalesTarget_organizationId_ownerId_financialYear_quarter_key"
  ON "SalesTarget"("organizationId", "ownerId", "financialYear", "quarter");
CREATE UNIQUE INDEX IF NOT EXISTS "Proposal_organizationId_opportunityId_sequenceNumber_key"
  ON "Proposal"("organizationId", "opportunityId", "sequenceNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "Order_organizationId_orderNumber_key"
  ON "Order"("organizationId", "orderNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionTemplate_organizationId_key_key"
  ON "ProductionTemplate"("organizationId", "key");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionTemplateStage_organizationId_templateId_key_key"
  ON "ProductionTemplateStage"("organizationId", "templateId", "key");
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_organizationId_invoiceNumber_key"
  ON "Invoice"("organizationId", "invoiceNumber");

DROP INDEX IF EXISTS "SharedBusinessRecord_entityType_ecrmLegacyId_key";
DROP INDEX IF EXISTS "SharedBusinessRecord_entityType_emailVoiceLegacyId_key";
DROP INDEX IF EXISTS "SharedBusinessRecord_entityType_externalKey_key";
DROP INDEX IF EXISTS "WorkflowEvent_sourceApp_sourceEventId_key";
DROP INDEX IF EXISTS "SalesDayReview_ownerId_reviewDate_key";
DROP INDEX IF EXISTS "SalesDayReviewItem_reviewId_taskId_key";
DROP INDEX IF EXISTS "PipelineStage_name_key";
DROP INDEX IF EXISTS "ProductService_code_key";
DROP INDEX IF EXISTS "SalesTarget_ownerId_financialYear_quarter_key";
DROP INDEX IF EXISTS "Proposal_opportunityId_sequenceNumber_key";
DROP INDEX IF EXISTS "Order_orderNumber_key";
DROP INDEX IF EXISTS "ProductionTemplate_key_key";
DROP INDEX IF EXISTS "ProductionTemplateStage_templateId_key_key";
DROP INDEX IF EXISTS "Invoice_invoiceNumber_key";

COMMIT;
