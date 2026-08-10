BEGIN;

CREATE OR REPLACE FUNCTION public.tenant_member_is_active(
  target_user_id TEXT,
  allowed_roles_csv TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  tenant_id TEXT := NULLIF(current_setting('app.organization_id', true), '');
BEGIN
  IF tenant_id IS NULL OR NULLIF(target_user_id, '') IS NULL THEN
    RETURN FALSE;
  END IF;

  PERFORM 1
  FROM public."User" account
  JOIN public."OrganizationMembership" membership
    ON membership."userId" = account.id
  JOIN public."Organization" organization
    ON organization.id = membership."organizationId"
  WHERE account.id = target_user_id
    AND account.active
    AND membership."organizationId" = tenant_id
    AND membership.status = 'ACTIVE'
    AND organization.status = 'ACTIVE'
    AND (
      NULLIF(allowed_roles_csv, '') IS NULL
      OR membership.role::TEXT = ANY(string_to_array(allowed_roles_csv, ','))
    )
  FOR KEY SHARE OF account, membership, organization;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.tenant_member_is_active(TEXT, TEXT) FROM PUBLIC;

COMMIT;
