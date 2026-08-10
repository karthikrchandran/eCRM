SET lock_timeout = '5s';
SET statement_timeout = '15min';

-- Stage 5: validate each business foreign key independently after successful
-- reconciliation. Replays skip constraints that PostgreSQL already validated.
CREATE OR REPLACE PROCEDURE "_ecrm_validate_organization_fk"(tenant_table TEXT)
LANGUAGE plpgsql
AS $procedure$
DECLARE
  constraint_name TEXT := left(tenant_table || '_organizationId_fkey', 63);
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = constraint_name
      AND conrelid = to_regclass(format('%I', tenant_table))
      AND NOT convalidated
  ) THEN
    EXECUTE format(
      'ALTER TABLE %I VALIDATE CONSTRAINT %I',
      tenant_table,
      constraint_name
    );
  END IF;
END
$procedure$;

CALL "_ecrm_validate_organization_fk"('SharedBusinessRecord');
CALL "_ecrm_validate_organization_fk"('SharedBusinessRecordVersion');
CALL "_ecrm_validate_organization_fk"('SharedRecordExportSnapshot');
CALL "_ecrm_validate_organization_fk"('SharedRecordExportSnapshotItem');
CALL "_ecrm_validate_organization_fk"('WorkflowEvent');
CALL "_ecrm_validate_organization_fk"('LeadCustomer');
CALL "_ecrm_validate_organization_fk"('Branch');
CALL "_ecrm_validate_organization_fk"('Contact');
CALL "_ecrm_validate_organization_fk"('Activity');
CALL "_ecrm_validate_organization_fk"('LeadOwnershipHistory');
CALL "_ecrm_validate_organization_fk"('SalesTask');
CALL "_ecrm_validate_organization_fk"('SalesTextNote');
CALL "_ecrm_validate_organization_fk"('SalesVoiceNote');
CALL "_ecrm_validate_organization_fk"('SalesVoiceNoteAction');
CALL "_ecrm_validate_organization_fk"('SalesDayReview');
CALL "_ecrm_validate_organization_fk"('SalesDayReviewItem');
CALL "_ecrm_validate_organization_fk"('PipelineStage');
CALL "_ecrm_validate_organization_fk"('Opportunity');
CALL "_ecrm_validate_organization_fk"('OpportunityOwnerSplit');
CALL "_ecrm_validate_organization_fk"('SalesTarget');
CALL "_ecrm_validate_organization_fk"('ProductService');
CALL "_ecrm_validate_organization_fk"('Proposal');
CALL "_ecrm_validate_organization_fk"('ProposalLineItem');
CALL "_ecrm_validate_organization_fk"('ProposalPdfAttachment');
CALL "_ecrm_validate_organization_fk"('Order');
CALL "_ecrm_validate_organization_fk"('OrderLineItem');
CALL "_ecrm_validate_organization_fk"('OrderOwnerSplitSnapshot');
CALL "_ecrm_validate_organization_fk"('ProductionTemplate');
CALL "_ecrm_validate_organization_fk"('ProductionTemplateStage');
CALL "_ecrm_validate_organization_fk"('ProductionWorkItem');
CALL "_ecrm_validate_organization_fk"('ProductionStageInstance');
CALL "_ecrm_validate_organization_fk"('ProductionNote');
CALL "_ecrm_validate_organization_fk"('Invoice');
CALL "_ecrm_validate_organization_fk"('Payment');
CALL "_ecrm_validate_organization_fk"('PaymentAllocation');
CALL "_ecrm_validate_organization_fk"('CostComponent');
CALL "_ecrm_validate_organization_fk"('Incentive');
CALL "_ecrm_validate_organization_fk"('IncentiveSplit');
DROP PROCEDURE "_ecrm_validate_organization_fk"(TEXT);

RESET lock_timeout;
RESET statement_timeout;
