BEGIN;

-- Enforce active same-organization membership for every User foreign key on
-- tenant-owned business rows. The trigger runs in the caller's transaction,
-- takes locks that conflict with membership/user/organization revocation, and
-- exposes only a uniform foreign-key style failure to the tenant application.
CREATE OR REPLACE FUNCTION public.assert_tenant_user_fk()
RETURNS TRIGGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  tenant_id TEXT := NULLIF(current_setting('app.organization_id', true), '');
  target_user_id TEXT := NULLIF(to_jsonb(NEW) ->> TG_ARGV[0], '');
  caller_is_control_plane BOOLEAN := FALSE;
BEGIN
  IF target_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF tenant_id IS NULL THEN
    SELECT role_row.rolsuper OR role_row.rolbypassrls OR table_row.relowner = role_row.oid
    INTO caller_is_control_plane
    FROM pg_catalog.pg_roles role_row
    JOIN pg_catalog.pg_class table_row ON table_row.oid = TG_RELID
    WHERE role_row.rolname = session_user;
    IF caller_is_control_plane THEN
      RETURN NEW;
    END IF;
  END IF;

  IF tenant_id IS NULL OR tenant_id <> NEW."organizationId" THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'Tenant member was not found.';
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
  FOR SHARE OF account, membership, organization;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'Tenant member was not found.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_tenant_user_fk() FROM PUBLIC;

DO $$
DECLARE
  relation RECORD;
  trigger_name TEXT;
  invalid_member BOOLEAN;
BEGIN
  FOR relation IN
    SELECT * FROM (VALUES
      ('LeadCustomer','ownerId'),('LeadCustomer','createdById'),('LeadCustomer','updatedById'),
      ('Activity','ownerId'),('Activity','createdById'),('Activity','completedById'),
      ('SalesTask','ownerId'),('SalesTextNote','ownerId'),('SalesVoiceNote','ownerId'),('SalesDayReview','ownerId'),
      ('LeadOwnershipHistory','fromOwnerId'),('LeadOwnershipHistory','toOwnerId'),('LeadOwnershipHistory','changedById'),
      ('Opportunity','ownerId'),('Opportunity','createdById'),('Opportunity','updatedById'),
      ('OpportunityOwnerSplit','userId'),('SalesTarget','ownerId'),('SalesTarget','createdById'),
      ('ProductService','createdById'),('ProductService','updatedById'),
      ('Proposal','createdById'),('Proposal','updatedById'),('ProposalPdfAttachment','uploadedById'),
      ('Order','ownerId'),('Order','createdById'),('Order','updatedById'),('OrderOwnerSplitSnapshot','userId'),
      ('ProductionWorkItem','assignedToId'),('ProductionWorkItem','createdById'),('ProductionWorkItem','updatedById'),
      ('ProductionStageInstance','assignedToId'),('ProductionStageInstance','completedById'),('ProductionNote','createdById'),
      ('Invoice','createdById'),('Invoice','updatedById'),('Invoice','voidedById'),('Payment','createdById'),
      ('CostComponent','createdById'),('CostComponent','updatedById'),('CostComponent','approvedById'),
      ('CostComponent','rejectedById'),('CostComponent','voidedById'),
      ('Incentive','approvedById'),('Incentive','overrideById'),('Incentive','rejectedById'),('Incentive','paidById'),
      ('IncentiveSplit','userId')
    ) AS relationships(child_table, child_field)
  LOOP
    EXECUTE format(
      'SELECT EXISTS (
         SELECT 1
         FROM %I child
         LEFT JOIN public."User" account ON account.id = child.%I
         LEFT JOIN public."OrganizationMembership" membership
           ON membership."userId" = child.%I
          AND membership."organizationId" = child."organizationId"
         LEFT JOIN public."Organization" organization
           ON organization.id = child."organizationId"
         WHERE child.%I IS NOT NULL
           AND (account.id IS NULL OR membership.id IS NULL OR organization.id IS NULL)
       )',
      relation.child_table,
      relation.child_field,
      relation.child_field,
      relation.child_field
    ) INTO invalid_member;

    IF invalid_member THEN
      RAISE EXCEPTION 'Tenant member mismatch: %.%', relation.child_table, relation.child_field;
    END IF;

    trigger_name := left(relation.child_table || '_tenant_member_' || relation.child_field || '_trg', 63);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', trigger_name, relation.child_table);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF "organizationId", %I ON %I FOR EACH ROW EXECUTE FUNCTION public.assert_tenant_user_fk(%L)',
      trigger_name,
      relation.child_field,
      relation.child_table,
      relation.child_field
    );
  END LOOP;
END;
$$;

COMMIT;
