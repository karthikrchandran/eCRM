BEGIN;

-- Re-apply the membership guard for databases that already ran the earlier
-- stage. FOR SHARE conflicts with active/status revocations on all locked rows.
CREATE OR REPLACE FUNCTION public.tenant_member_is_active(target_user_id TEXT, allowed_roles_csv TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  tenant_id TEXT := NULLIF(current_setting('app.organization_id', true), '');
BEGIN
  IF tenant_id IS NULL OR NULLIF(target_user_id, '') IS NULL THEN RETURN FALSE; END IF;
  PERFORM 1
  FROM public."User" account
  JOIN public."OrganizationMembership" membership ON membership."userId" = account.id
  JOIN public."Organization" organization ON organization.id = membership."organizationId"
  WHERE account.id = target_user_id
    AND account.active
    AND membership."organizationId" = tenant_id
    AND membership.status = 'ACTIVE'
    AND organization.status = 'ACTIVE'
    AND (NULLIF(allowed_roles_csv, '') IS NULL OR membership.role::TEXT = ANY(string_to_array(allowed_roles_csv, ',')))
  FOR SHARE OF account, membership, organization;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.tenant_member_is_active(TEXT, TEXT) FROM PUBLIC;

DO $$
DECLARE
  relation RECORD;
  constraint_name TEXT;
  parent_index_name TEXT;
  delete_code "char";
  update_code "char";
  delete_action TEXT;
  update_action TEXT;
  delete_columns TEXT;
  invalid_parent BOOLEAN;
BEGIN
  FOR relation IN
    SELECT * FROM (VALUES
      ('SharedBusinessRecordVersion','recordId','SharedBusinessRecord','id'),
      ('SharedRecordExportSnapshotItem','snapshotId','SharedRecordExportSnapshot','id'),
      ('Branch','leadCustomerId','LeadCustomer','id'),
      ('Contact','leadCustomerId','LeadCustomer','id'), ('Contact','branchId','Branch','id'),
      ('Activity','leadCustomerId','LeadCustomer','id'), ('Activity','branchId','Branch','id'), ('Activity','contactId','Contact','id'),
      ('SalesTask','leadCustomerId','LeadCustomer','id'), ('SalesTask','opportunityId','Opportunity','id'), ('SalesTask','proposalId','Proposal','id'), ('SalesTask','orderId','Order','id'),
      ('SalesTextNote','taskId','SalesTask','id'), ('SalesTextNote','leadCustomerId','LeadCustomer','id'), ('SalesTextNote','opportunityId','Opportunity','id'), ('SalesTextNote','proposalId','Proposal','id'), ('SalesTextNote','orderId','Order','id'),
      ('SalesVoiceNote','taskId','SalesTask','id'), ('SalesVoiceNote','leadCustomerId','LeadCustomer','id'), ('SalesVoiceNote','opportunityId','Opportunity','id'), ('SalesVoiceNote','proposalId','Proposal','id'), ('SalesVoiceNote','orderId','Order','id'),
      ('SalesVoiceNoteAction','voiceNoteId','SalesVoiceNote','id'), ('SalesVoiceNoteAction','createdTaskId','SalesTask','id'),
      ('SalesDayReviewItem','reviewId','SalesDayReview','id'), ('SalesDayReviewItem','taskId','SalesTask','id'),
      ('LeadOwnershipHistory','leadCustomerId','LeadCustomer','id'),
      ('Opportunity','leadCustomerId','LeadCustomer','id'), ('Opportunity','branchId','Branch','id'), ('Opportunity','stageId','PipelineStage','id'),
      ('OpportunityOwnerSplit','opportunityId','Opportunity','id'),
      ('Proposal','opportunityId','Opportunity','id'),
      ('ProposalLineItem','proposalId','Proposal','id'), ('ProposalLineItem','productServiceId','ProductService','id'),
      ('ProposalPdfAttachment','proposalId','Proposal','id'),
      ('Order','proposalId','Proposal','id'), ('Order','opportunityId','Opportunity','id'), ('Order','leadCustomerId','LeadCustomer','id'), ('Order','branchId','Branch','id'),
      ('OrderLineItem','orderId','Order','id'), ('OrderLineItem','proposalLineItemId','ProposalLineItem','id'), ('OrderLineItem','productServiceId','ProductService','id'),
      ('OrderOwnerSplitSnapshot','orderId','Order','id'),
      ('ProductionTemplateStage','templateId','ProductionTemplate','id'),
      ('ProductionWorkItem','orderLineItemId','OrderLineItem','id'), ('ProductionWorkItem','productionTemplateId','ProductionTemplate','id'),
      ('ProductionStageInstance','workItemId','ProductionWorkItem','id'), ('ProductionStageInstance','templateStageId','ProductionTemplateStage','id'),
      ('ProductionNote','workItemId','ProductionWorkItem','id'), ('ProductionNote','stageInstanceId','ProductionStageInstance','id'),
      ('Invoice','orderId','Order','id'), ('Payment','orderId','Order','id'),
      ('PaymentAllocation','paymentId','Payment','id'), ('PaymentAllocation','invoiceId','Invoice','id'),
      ('CostComponent','orderId','Order','id'), ('CostComponent','orderLineItemId','OrderLineItem','id'),
      ('Incentive','orderId','Order','id'), ('IncentiveSplit','incentiveId','Incentive','id'),
      ('SharedBusinessRecord','parentId','SharedBusinessRecord','id')
    ) AS relationships(child_table, child_field, parent_table, parent_field)
  LOOP
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM %I child WHERE child.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM %I parent WHERE parent.%I = child.%I AND parent."organizationId" = child."organizationId"))',
      relation.child_table, relation.child_field, relation.parent_table, relation.parent_field, relation.child_field
    ) INTO invalid_parent;
    IF invalid_parent THEN
      RAISE EXCEPTION 'Tenant relationship mismatch: %.% -> %.%', relation.child_table, relation.child_field, relation.parent_table, relation.parent_field;
    END IF;

    parent_index_name := left(relation.parent_table || '_organizationId_' || relation.parent_field || '_key', 63);
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON %I ("organizationId", %I)', parent_index_name, relation.parent_table, relation.parent_field);

    constraint_name := left(relation.child_table || '_tenant_' || relation.child_field || '_fkey', 63);
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = constraint_name AND conrelid = to_regclass(format('%I', relation.child_table))) THEN
      SELECT constraint_row.confdeltype, constraint_row.confupdtype
      INTO delete_code, update_code
      FROM pg_constraint constraint_row
      JOIN pg_attribute child_attribute
        ON child_attribute.attrelid = constraint_row.conrelid
       AND child_attribute.attnum = constraint_row.conkey[1]
      WHERE constraint_row.contype = 'f'
        AND constraint_row.conrelid = to_regclass(format('%I', relation.child_table))
        AND constraint_row.confrelid = to_regclass(format('%I', relation.parent_table))
        AND array_length(constraint_row.conkey, 1) = 1
        AND child_attribute.attname = relation.child_field
      LIMIT 1;

      update_action := CASE update_code WHEN 'c' THEN 'CASCADE' WHEN 'r' THEN 'RESTRICT' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' ELSE 'NO ACTION' END;
      delete_action := CASE delete_code WHEN 'c' THEN 'CASCADE' WHEN 'r' THEN 'RESTRICT' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' ELSE 'NO ACTION' END;
      delete_columns := CASE WHEN delete_code IN ('n', 'd') THEN format(' (%I)', relation.child_field) ELSE '' END;

      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("organizationId", %I) REFERENCES %I ("organizationId", %I) ON UPDATE %s ON DELETE %s%s',
        relation.child_table, constraint_name, relation.child_field, relation.parent_table, relation.parent_field,
        update_action, delete_action, delete_columns
      );
    END IF;
    delete_code := NULL;
    update_code := NULL;
  END LOOP;
END;
$$;

COMMIT;
