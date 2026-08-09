-- Run with psql as the database owner after setting a safe identifier:
--   psql -v app_role=ecrm_tenant_app -v login_role=ecrm_tenant_login \
--     -f prisma/operations/configure-tenant-app-role.sql
-- The LOGIN principal and its credentials must be provisioned externally. This
-- operation creates only the credential-free NOLOGIN permission role.
\if :{?app_role}
\else
\echo 'app_role is required'
\quit 1
\endif

\if :{?login_role}
\else
\echo 'login_role is required'
\quit 1
\endif

SELECT format(
  'CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS',
  :'app_role'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_role') \gexec

SELECT format(
  'ALTER ROLE %I NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS',
  :'app_role'
) \gexec

-- Fail unless the externally provisioned principal is a safe inheriting LOGIN
-- role. The operation never creates, alters, or assigns its credentials.
SELECT 1 / CASE
  WHEN EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = :'login_role'
      AND rolcanlogin
      AND rolinherit
      AND NOT rolsuper
      AND NOT rolbypassrls
  ) THEN 1
  ELSE 0
END AS tenant_login_role_is_safe;

SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'app_role') \gexec
SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'app_role') \gexec
SELECT format(
  'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    "SharedBusinessRecord", "SharedBusinessRecordVersion", "SharedRecordExportSnapshot",
    "SharedRecordExportSnapshotItem", "WorkflowEvent", "LeadCustomer", "Branch", "Contact",
    "Activity", "LeadOwnershipHistory", "SalesTask", "SalesTextNote", "SalesVoiceNote",
    "SalesVoiceNoteAction", "SalesDayReview", "SalesDayReviewItem", "PipelineStage",
    "Opportunity", "OpportunityOwnerSplit", "SalesTarget", "ProductService", "Proposal",
    "ProposalLineItem", "ProposalPdfAttachment", "Order", "OrderLineItem",
    "OrderOwnerSplitSnapshot", "ProductionTemplate", "ProductionTemplateStage",
    "ProductionWorkItem", "ProductionStageInstance", "ProductionNote", "Invoice", "Payment",
    "PaymentAllocation", "CostComponent", "Incentive", "IncentiveSplit" TO %I',
  :'app_role'
) \gexec
SELECT format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I', :'app_role') \gexec
SELECT format(
  'REVOKE ALL PRIVILEGES ON TABLE "User", "Organization", "OrganizationMembership", "OrganizationSettings", "OrganizationBranding" FROM %I',
  :'app_role'
) \gexec
SELECT format('GRANT SELECT (id, name, email, role, active) ON TABLE "User" TO %I', :'app_role') \gexec
SELECT format('GRANT SELECT ON TABLE "BusinessSettings" TO %I', :'app_role') \gexec
SELECT format('GRANT EXECUTE ON FUNCTION public.tenant_user_in_current_organization(TEXT) TO %I', :'app_role') \gexec
SELECT format(
  'REVOKE ALL PRIVILEGES ON TABLE "User", "Organization", "OrganizationMembership", "OrganizationSettings", "OrganizationBranding" FROM %I',
  :'login_role'
) \gexec
SELECT format('GRANT %I TO %I', :'app_role', :'login_role') \gexec

-- A zero denominator deliberately aborts psql when the named role can bypass
-- tenant policies. Unlike a variable embedded in a DO body, :'app_role' is
-- substituted and quoted by psql before PostgreSQL parses this statement.
SELECT 1 / CASE
  WHEN EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = :'app_role' AND (rolsuper OR rolbypassrls)
  ) THEN 0
  ELSE 1
END AS tenant_role_is_safe;

-- Verify effective privileges after membership is granted. This catches unsafe
-- direct, inherited, PUBLIC, or ownership access on authentication/control data.
SELECT 1 / CASE
  WHEN has_table_privilege(:'login_role', 'public."User"', 'SELECT,INSERT,UPDATE,DELETE')
    OR has_table_privilege(:'login_role', 'public."Organization"', 'SELECT,INSERT,UPDATE,DELETE')
    OR has_table_privilege(:'login_role', 'public."OrganizationMembership"', 'SELECT,INSERT,UPDATE,DELETE')
    OR has_table_privilege(:'login_role', 'public."OrganizationSettings"', 'SELECT,INSERT,UPDATE,DELETE')
    OR has_table_privilege(:'login_role', 'public."OrganizationBranding"', 'SELECT,INSERT,UPDATE,DELETE')
  THEN 0
  ELSE 1
END AS tenant_login_cannot_access_control_plane;

-- Membership/session resolution uses DATABASE_URL before withOrganization opens
-- a tenant business transaction through TENANT_DATABASE_URL.
