BEGIN;

CREATE OR REPLACE FUNCTION public.tenant_user_in_current_organization(target_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    NULLIF(current_setting('app.organization_id', true), '') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public."OrganizationMembership" membership
      WHERE membership."userId" = target_user_id
        AND membership."organizationId" = NULLIF(current_setting('app.organization_id', true), '')
        AND membership.status = 'ACTIVE'
    );
$$;

REVOKE ALL ON FUNCTION public.tenant_user_in_current_organization(TEXT) FROM PUBLIC;

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User_tenant_directory" ON "User";
CREATE POLICY "User_tenant_directory" ON "User"
  FOR SELECT
  USING (public.tenant_user_in_current_organization(id));

COMMIT;
