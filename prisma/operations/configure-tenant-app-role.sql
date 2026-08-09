-- Run with psql as the database owner after setting a safe identifier:
--   psql -v app_role=ecrm_tenant_app -f prisma/operations/configure-tenant-app-role.sql
-- The role is created out-of-band so Prisma migrations never embed credentials.
\if :{?app_role}
\else
\echo 'app_role is required'
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

SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'app_role') \gexec
SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'app_role') \gexec
SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', :'app_role') \gexec
SELECT format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I', :'app_role') \gexec
SELECT format('REVOKE ALL PRIVILEGES ON TABLE "Organization", "OrganizationMembership" FROM %I', :'app_role') \gexec

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

-- Do not grant Organization or OrganizationMembership here. Membership/session
-- resolution uses the audited owner connection before withOrganization opens a
-- tenant business transaction. Task 5 will replace the shared integration token.
