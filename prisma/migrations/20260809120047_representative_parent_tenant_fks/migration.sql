BEGIN;

-- Abort before adding compound foreign keys if reconciliation missed any
-- representative root/child relationship exercised by the adversarial matrix.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Branch" child JOIN "LeadCustomer" parent ON parent.id = child."leadCustomerId" WHERE child."organizationId" <> parent."organizationId")
    OR EXISTS (SELECT 1 FROM "SalesTextNote" child JOIN "SalesTask" parent ON parent.id = child."taskId" WHERE child."organizationId" <> parent."organizationId")
    OR EXISTS (SELECT 1 FROM "Proposal" child JOIN "Opportunity" parent ON parent.id = child."opportunityId" WHERE child."organizationId" <> parent."organizationId")
    OR EXISTS (SELECT 1 FROM "ProposalLineItem" child JOIN "ProductService" parent ON parent.id = child."productServiceId" WHERE child."organizationId" <> parent."organizationId")
    OR EXISTS (SELECT 1 FROM "ProductionTemplateStage" child JOIN "ProductionTemplate" parent ON parent.id = child."templateId" WHERE child."organizationId" <> parent."organizationId")
    OR EXISTS (SELECT 1 FROM "PaymentAllocation" child JOIN "Invoice" parent ON parent.id = child."invoiceId" WHERE child."organizationId" <> parent."organizationId")
    OR EXISTS (SELECT 1 FROM "SharedBusinessRecordVersion" child JOIN "SharedBusinessRecord" parent ON parent.id = child."recordId" WHERE child."organizationId" <> parent."organizationId")
  THEN
    RAISE EXCEPTION 'Tenant parent/child mismatch blocks representative compound foreign keys';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "LeadCustomer_organizationId_id_key" ON "LeadCustomer"("organizationId", id);
CREATE UNIQUE INDEX IF NOT EXISTS "SalesTask_organizationId_id_key" ON "SalesTask"("organizationId", id);
CREATE UNIQUE INDEX IF NOT EXISTS "Opportunity_organizationId_id_key" ON "Opportunity"("organizationId", id);
CREATE UNIQUE INDEX IF NOT EXISTS "ProductService_organizationId_id_key" ON "ProductService"("organizationId", id);
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionTemplate_organizationId_id_key" ON "ProductionTemplate"("organizationId", id);
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_organizationId_id_key" ON "Invoice"("organizationId", id);
CREATE UNIQUE INDEX IF NOT EXISTS "SharedBusinessRecord_organizationId_id_key" ON "SharedBusinessRecord"("organizationId", id);

ALTER TABLE "Branch"
  ADD CONSTRAINT "Branch_organizationId_leadCustomerId_fkey"
  FOREIGN KEY ("organizationId", "leadCustomerId") REFERENCES "LeadCustomer"("organizationId", id)
  ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "SalesTextNote"
  ADD CONSTRAINT "SalesTextNote_organizationId_taskId_fkey"
  FOREIGN KEY ("organizationId", "taskId") REFERENCES "SalesTask"("organizationId", id)
  ON UPDATE CASCADE ON DELETE SET NULL ("taskId");
ALTER TABLE "Proposal"
  ADD CONSTRAINT "Proposal_organizationId_opportunityId_fkey"
  FOREIGN KEY ("organizationId", "opportunityId") REFERENCES "Opportunity"("organizationId", id)
  ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "ProposalLineItem"
  ADD CONSTRAINT "ProposalLineItem_organizationId_productServiceId_fkey"
  FOREIGN KEY ("organizationId", "productServiceId") REFERENCES "ProductService"("organizationId", id)
  ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "ProductionTemplateStage"
  ADD CONSTRAINT "ProductionTemplateStage_organizationId_templateId_fkey"
  FOREIGN KEY ("organizationId", "templateId") REFERENCES "ProductionTemplate"("organizationId", id)
  ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "PaymentAllocation"
  ADD CONSTRAINT "PaymentAllocation_organizationId_invoiceId_fkey"
  FOREIGN KEY ("organizationId", "invoiceId") REFERENCES "Invoice"("organizationId", id)
  ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "SharedBusinessRecordVersion"
  ADD CONSTRAINT "SharedBusinessRecordVersion_organizationId_recordId_fkey"
  FOREIGN KEY ("organizationId", "recordId") REFERENCES "SharedBusinessRecord"("organizationId", id)
  ON UPDATE CASCADE ON DELETE CASCADE;

COMMIT;
