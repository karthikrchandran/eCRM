-- Preserve every proposal revision as an immutable, tenant-scoped record.
CREATE TYPE "ProposalVersionStatus" AS ENUM (
  'DRAFT', 'DRAFT_REVIEW_REQUIRED', 'IN_REVIEW', 'APPROVED', 'SENT',
  'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN', 'SUPERSEDED'
);
CREATE TYPE "ProposalCreationMode" AS ENUM ('MANUAL', 'TEMPLATE', 'GENERATIVE');

ALTER TABLE "Proposal"
  ADD COLUMN "clientAccountId" TEXT,
  ADD COLUMN "currentVersionId" TEXT,
  ADD COLUMN "currentVersionNumber" INTEGER NOT NULL DEFAULT 0;

UPDATE "Proposal" AS proposal
SET "clientAccountId" = opportunity."leadCustomerId"
FROM "Opportunity" AS opportunity
WHERE opportunity."organizationId" = proposal."organizationId"
  AND opportunity.id = proposal."opportunityId";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Proposal" WHERE "clientAccountId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot add proposal versioning: a proposal has no tenant-scoped client account';
  END IF;
END $$;

ALTER TABLE "Proposal" ALTER COLUMN "clientAccountId" SET NOT NULL;

CREATE TABLE "ProposalVersion" (
  id TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "clientAccountId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "supersedesVersionId" TEXT,
  status "ProposalVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "creationMode" "ProposalCreationMode" NOT NULL DEFAULT 'MANUAL',
  title TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  "validUntil" TIMESTAMP(3),
  "commercialSummary" TEXT,
  assumptions TEXT,
  inclusions TEXT,
  exclusions TEXT,
  "paymentTerms" TEXT,
  "deliveryTimeline" TEXT,
  "internalNotes" TEXT,
  "subtotalPaisa" INTEGER NOT NULL DEFAULT 0,
  "taxPaisa" INTEGER NOT NULL DEFAULT 0,
  "totalPaisa" INTEGER NOT NULL DEFAULT 0,
  "templateVersionId" TEXT,
  "questionnaireVersionId" TEXT,
  "modelVersion" TEXT,
  "promptVersion" TEXT,
  "sourceManifest" JSONB NOT NULL DEFAULT '{}',
  "sourceDigest" TEXT NOT NULL,
  "contentDigest" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProposalVersion_pkey" PRIMARY KEY (id)
);

CREATE TABLE "ProposalVersionLine" (
  id TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "productServiceId" TEXT NOT NULL,
  "productNameSnapshot" TEXT,
  "productCategorySnapshot" TEXT,
  description TEXT,
  quantity INTEGER NOT NULL,
  "unitPricePaisa" INTEGER NOT NULL,
  "taxRateBps" INTEGER NOT NULL,
  "taxOverrideReason" TEXT,
  "lineSubtotalPaisa" INTEGER NOT NULL,
  "lineTaxPaisa" INTEGER NOT NULL,
  "lineTotalPaisa" INTEGER NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProposalVersionLine_pkey" PRIMARY KEY (id)
);

CREATE UNIQUE INDEX "ProposalVersion_organizationId_id_key" ON "ProposalVersion"("organizationId", id);
CREATE UNIQUE INDEX "ProposalVersion_organizationId_proposalId_versionNumber_key" ON "ProposalVersion"("organizationId", "proposalId", "versionNumber");
CREATE INDEX "ProposalVersion_organizationId_clientAccountId_createdAt_idx" ON "ProposalVersion"("organizationId", "clientAccountId", "createdAt");
CREATE INDEX "ProposalVersion_status_idx" ON "ProposalVersion"(status);
CREATE UNIQUE INDEX "ProposalVersionLine_organizationId_id_key" ON "ProposalVersionLine"("organizationId", id);
CREATE INDEX "ProposalVersionLine_organizationId_versionId_sortOrder_idx" ON "ProposalVersionLine"("organizationId", "versionId", "sortOrder");
CREATE INDEX "ProposalVersionLine_organizationId_productServiceId_idx" ON "ProposalVersionLine"("organizationId", "productServiceId");

INSERT INTO "ProposalVersion" (
  id, "organizationId", "proposalId", "clientAccountId", "versionNumber", status,
  "creationMode", title, currency, "validUntil", "commercialSummary", assumptions,
  inclusions, exclusions, "paymentTerms", "deliveryTimeline", "internalNotes",
  "subtotalPaisa", "taxPaisa", "totalPaisa", "sourceManifest", "sourceDigest",
  "contentDigest", "createdById", "createdAt"
)
SELECT
  'pv_' || md5(proposal."organizationId" || ':' || proposal.id),
  proposal."organizationId", proposal.id, proposal."clientAccountId", 1,
  proposal.status::text::"ProposalVersionStatus", 'MANUAL', proposal.title,
  proposal.currency, proposal."validUntil", proposal."commercialSummary",
  proposal.assumptions, proposal.inclusions, proposal.exclusions,
  proposal."paymentTerms", proposal."deliveryTimeline", proposal."internalNotes",
  proposal."subtotalPaisa", proposal."gstPaisa", proposal."totalPaisa",
  jsonb_build_object('migration', '20260816160000'),
  md5(proposal."organizationId" || ':' || proposal.id || ':source') || md5(proposal."organizationId" || ':' || proposal.id || ':source'),
  md5(proposal."organizationId" || ':' || proposal.id || ':content') || md5(proposal."organizationId" || ':' || proposal.id || ':content'),
  proposal."createdById", proposal."createdAt"
FROM "Proposal" AS proposal;

INSERT INTO "ProposalVersionLine" (
  id, "organizationId", "versionId", "productServiceId", "productNameSnapshot",
  "productCategorySnapshot", description, quantity, "unitPricePaisa", "taxRateBps",
  "taxOverrideReason", "lineSubtotalPaisa", "lineTaxPaisa", "lineTotalPaisa",
  "sortOrder", "createdAt"
)
SELECT
  'pvl_' || md5(line."organizationId" || ':' || line.id), line."organizationId",
  'pv_' || md5(line."organizationId" || ':' || line."proposalId"),
  line."productServiceId", line."productNameSnapshot", line."productCategorySnapshot",
  line.description, line.quantity, line."unitPricePaisa", line."gstRateBps",
  line."gstOverrideReason", line."lineSubtotalPaisa", line."lineGstPaisa",
  line."lineTotalPaisa", line."sortOrder", line."createdAt"
FROM "ProposalLineItem" AS line;

UPDATE "Proposal"
SET "currentVersionId" = 'pv_' || md5("organizationId" || ':' || id),
    "currentVersionNumber" = 1;

CREATE UNIQUE INDEX "Proposal_organizationId_currentVersionId_key" ON "Proposal"("organizationId", "currentVersionId");
CREATE INDEX "Proposal_clientAccountId_idx" ON "Proposal"("clientAccountId");

ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_tenant_clientAccountId_fkey"
  FOREIGN KEY ("organizationId", "clientAccountId") REFERENCES "LeadCustomer"("organizationId", id) ON DELETE CASCADE;
ALTER TABLE "ProposalVersion" ADD CONSTRAINT "ProposalVersion_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE RESTRICT;
ALTER TABLE "ProposalVersion" ADD CONSTRAINT "ProposalVersion_proposal_fkey"
  FOREIGN KEY ("organizationId", "proposalId") REFERENCES "Proposal"("organizationId", id) ON DELETE CASCADE;
ALTER TABLE "ProposalVersion" ADD CONSTRAINT "ProposalVersion_clientAccount_fkey"
  FOREIGN KEY ("organizationId", "clientAccountId") REFERENCES "LeadCustomer"("organizationId", id) ON DELETE CASCADE;
ALTER TABLE "ProposalVersion" ADD CONSTRAINT "ProposalVersion_supersedes_fkey"
  FOREIGN KEY ("organizationId", "supersedesVersionId") REFERENCES "ProposalVersion"("organizationId", id) ON DELETE RESTRICT;
ALTER TABLE "ProposalVersion" ADD CONSTRAINT "ProposalVersion_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"(id) ON DELETE RESTRICT;
ALTER TABLE "ProposalVersionLine" ADD CONSTRAINT "ProposalVersionLine_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE RESTRICT;
ALTER TABLE "ProposalVersionLine" ADD CONSTRAINT "ProposalVersionLine_version_fkey"
  FOREIGN KEY ("organizationId", "versionId") REFERENCES "ProposalVersion"("organizationId", id) ON DELETE CASCADE;
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_currentVersion_fkey"
  FOREIGN KEY ("organizationId", "currentVersionId") REFERENCES "ProposalVersion"("organizationId", id) ON DELETE RESTRICT;

CREATE FUNCTION "prevent_proposal_version_mutation"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    RAISE EXCEPTION 'proposal version history is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ProposalVersion_immutable"
BEFORE UPDATE OR DELETE ON "ProposalVersion"
FOR EACH ROW EXECUTE FUNCTION "prevent_proposal_version_mutation"();

CREATE TRIGGER "ProposalVersionLine_immutable"
BEFORE UPDATE OR DELETE ON "ProposalVersionLine"
FOR EACH ROW EXECUTE FUNCTION "prevent_proposal_version_mutation"();
