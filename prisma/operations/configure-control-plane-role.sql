-- Run as the schema owner with identifiers supplied by psql:
--   psql -v control_role=ecrm_control_app -v login_role=ecrm_control_login \
--     -f prisma/operations/configure-control-plane-role.sql
-- The LOGIN principal and its credentials are provisioned externally.
\if :{?control_role}
\else
\echo 'control_role is required'
\quit 1
\endif
\if :{?login_role}
\else
\echo 'login_role is required'
\quit 1
\endif

SELECT format(
  'CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS',
  :'control_role'
) WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'control_role') \gexec
SELECT format(
  'ALTER ROLE %I NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS',
  :'control_role'
) \gexec

SELECT 1 / CASE WHEN EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = :'login_role' AND rolcanlogin AND rolinherit
    AND NOT rolsuper AND NOT rolbypassrls
) THEN 1 ELSE 0 END AS control_login_role_is_safe;

SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'control_role') \gexec
SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'control_role') \gexec
SELECT format(
  'GRANT SELECT ON TABLE "User", "Organization", "OrganizationMembership", "OrganizationSettings", "OrganizationBranding" TO %I',
  :'control_role'
) \gexec
SELECT format('GRANT SELECT, INSERT, UPDATE ON TABLE "BusinessSettings" TO %I', :'control_role') \gexec
SELECT format('GRANT %I TO %I', :'control_role', :'login_role') \gexec

-- Fail if direct, inherited, PUBLIC, or ownership privileges permit business-data access.
SELECT 1 / CASE WHEN EXISTS (
  SELECT 1 FROM (VALUES
    ('SharedBusinessRecord'), ('SharedBusinessRecordVersion'), ('SharedRecordExportSnapshot'),
    ('SharedRecordExportSnapshotItem'), ('WorkflowEvent'), ('LeadCustomer'), ('Branch'), ('Contact'),
    ('Activity'), ('LeadOwnershipHistory'), ('SalesTask'), ('SalesTextNote'), ('SalesVoiceNote'),
    ('SalesVoiceNoteAction'), ('SalesDayReview'), ('SalesDayReviewItem'), ('PipelineStage'),
    ('Opportunity'), ('OpportunityOwnerSplit'), ('SalesTarget'), ('ProductService'), ('Proposal'),
    ('ProposalLineItem'), ('ProposalPdfAttachment'), ('Order'), ('OrderLineItem'),
    ('OrderOwnerSplitSnapshot'), ('ProductionTemplate'), ('ProductionTemplateStage'),
    ('ProductionWorkItem'), ('ProductionStageInstance'), ('ProductionNote'), ('Invoice'), ('Payment'),
    ('PaymentAllocation'), ('CostComponent'), ('Incentive'), ('IncentiveSplit')
  ) AS business(table_name)
  WHERE has_table_privilege(:'login_role', format('public.%I', table_name), 'SELECT,INSERT,UPDATE,DELETE')
) THEN 0 ELSE 1 END AS control_login_cannot_access_business_data;

SELECT 1 / CASE WHEN EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname IN (:'control_role', :'login_role') AND (rolsuper OR rolbypassrls)
) THEN 0 ELSE 1 END AS control_roles_are_non_bypass;
