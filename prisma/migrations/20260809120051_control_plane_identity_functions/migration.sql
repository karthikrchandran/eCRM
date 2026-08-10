BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.control_auth_user_by_email(normalized_email TEXT)
RETURNS TABLE(id TEXT, name TEXT, email TEXT, password_hash TEXT, legacy_role TEXT, active BOOLEAN)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT account.id, account.name, account.email, account."passwordHash", account.role::TEXT, account.active
  FROM public."User" account
  WHERE lower(account.email) = lower(btrim(normalized_email))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.control_active_organization_members(target_organization_id TEXT, allowed_roles TEXT[])
RETURNS TABLE(id TEXT, name TEXT, email TEXT, legacy_role TEXT, membership_role TEXT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT account.id, account.name, account.email, account.role::TEXT, membership.role::TEXT
  FROM public."OrganizationMembership" membership
  JOIN public."Organization" organization ON organization.id = membership."organizationId"
  JOIN public."User" account ON account.id = membership."userId"
  WHERE membership."organizationId" = target_organization_id
    AND membership.status = 'ACTIVE'
    AND organization.status = 'ACTIVE'
    AND account.active
    AND membership.role::TEXT = ANY(allowed_roles)
  ORDER BY account.name, account.id;
$$;

CREATE OR REPLACE FUNCTION public.control_organization_context_membership(target_membership_id TEXT)
RETURNS TABLE(
  membership_id TEXT, user_id TEXT, organization_id TEXT, membership_role TEXT,
  membership_status TEXT, membership_updated_at TIMESTAMP(3), user_name TEXT,
  user_email TEXT, user_active BOOLEAN, organization_status TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT membership.id, membership."userId", membership."organizationId", membership.role::TEXT,
    membership.status::TEXT, membership."updatedAt", account.name, account.email, account.active,
    organization.status::TEXT
  FROM public."OrganizationMembership" membership
  JOIN public."Organization" organization ON organization.id = membership."organizationId"
  JOIN public."User" account ON account.id = membership."userId"
  WHERE membership.id = target_membership_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.control_auth_user_by_email(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.control_active_organization_members(TEXT, TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.control_organization_context_membership(TEXT) FROM PUBLIC;

COMMIT;
