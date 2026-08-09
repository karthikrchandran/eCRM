-- Prisma sends a multi-statement migration as one PostgreSQL transaction.
-- Concurrent indexes therefore live in the preceding one-statement migration
-- files; this file contains only the short unvalidated-FK DDL stage.
SET lock_timeout = '5s';
SET statement_timeout = '15min';

-- Stage 3: add organization foreign keys without scanning the business tables.
-- The short DDL transaction avoids table scans because every FK is NOT VALID;
-- validation follows only after the separately committed reconciliation stage.
CREATE OR REPLACE PROCEDURE "_ecrm_ensure_organization_fk"(tenant_table TEXT)
LANGUAGE plpgsql
AS $procedure$
DECLARE
  constraint_name TEXT := left(tenant_table || '_organizationId_fkey', 63);
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = constraint_name
      AND conrelid = to_regclass(format('%I', tenant_table))
  ) THEN
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID',
      tenant_table,
      constraint_name
    );
  END IF;
END
$procedure$;

CALL "_ecrm_ensure_organization_fk"('SharedBusinessRecord');
CALL "_ecrm_ensure_organization_fk"('SharedBusinessRecordVersion');
CALL "_ecrm_ensure_organization_fk"('SharedRecordExportSnapshot');
CALL "_ecrm_ensure_organization_fk"('SharedRecordExportSnapshotItem');
CALL "_ecrm_ensure_organization_fk"('WorkflowEvent');
CALL "_ecrm_ensure_organization_fk"('LeadCustomer');
CALL "_ecrm_ensure_organization_fk"('Branch');
CALL "_ecrm_ensure_organization_fk"('Contact');
CALL "_ecrm_ensure_organization_fk"('Activity');
CALL "_ecrm_ensure_organization_fk"('LeadOwnershipHistory');
CALL "_ecrm_ensure_organization_fk"('SalesTask');
CALL "_ecrm_ensure_organization_fk"('SalesTextNote');
CALL "_ecrm_ensure_organization_fk"('SalesVoiceNote');
CALL "_ecrm_ensure_organization_fk"('SalesVoiceNoteAction');
CALL "_ecrm_ensure_organization_fk"('SalesDayReview');
CALL "_ecrm_ensure_organization_fk"('SalesDayReviewItem');
CALL "_ecrm_ensure_organization_fk"('PipelineStage');
CALL "_ecrm_ensure_organization_fk"('Opportunity');
CALL "_ecrm_ensure_organization_fk"('OpportunityOwnerSplit');
CALL "_ecrm_ensure_organization_fk"('SalesTarget');
CALL "_ecrm_ensure_organization_fk"('ProductService');
CALL "_ecrm_ensure_organization_fk"('Proposal');
CALL "_ecrm_ensure_organization_fk"('ProposalLineItem');
CALL "_ecrm_ensure_organization_fk"('ProposalPdfAttachment');
CALL "_ecrm_ensure_organization_fk"('Order');
CALL "_ecrm_ensure_organization_fk"('OrderLineItem');
CALL "_ecrm_ensure_organization_fk"('OrderOwnerSplitSnapshot');
CALL "_ecrm_ensure_organization_fk"('ProductionTemplate');
CALL "_ecrm_ensure_organization_fk"('ProductionTemplateStage');
CALL "_ecrm_ensure_organization_fk"('ProductionWorkItem');
CALL "_ecrm_ensure_organization_fk"('ProductionStageInstance');
CALL "_ecrm_ensure_organization_fk"('ProductionNote');
CALL "_ecrm_ensure_organization_fk"('Invoice');
CALL "_ecrm_ensure_organization_fk"('Payment');
CALL "_ecrm_ensure_organization_fk"('PaymentAllocation');
CALL "_ecrm_ensure_organization_fk"('CostComponent');
CALL "_ecrm_ensure_organization_fk"('Incentive');
CALL "_ecrm_ensure_organization_fk"('IncentiveSplit');
DROP PROCEDURE "_ecrm_ensure_organization_fk"(TEXT);

RESET lock_timeout;
RESET statement_timeout;
