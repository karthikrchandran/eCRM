import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertTenantMember } from "./tenant-member-guard";
import { tenantOpaqueOwnedRelationships, tenantOwnedRelationships, tenantUserRelationships } from "./tenant-relationships";
import { withOrganization } from "./with-organization";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const testTenantDatabaseUrl = process.env.TEST_TENANT_DATABASE_URL ?? process.env.TENANT_DATABASE_URL;
const integration = describe.runIf(Boolean(testDatabaseUrl && testTenantDatabaseUrl));
const ownedTables = [
  "SharedBusinessRecord", "SharedBusinessRecordVersion", "SharedRecordExportSnapshot",
  "SharedRecordExportSnapshotItem", "WorkflowEvent", "LeadCustomer", "Branch", "Contact",
  "Activity", "LeadOwnershipHistory", "SalesTask", "SalesTextNote", "SalesVoiceNote",
  "SalesVoiceNoteAction", "SalesDayReview", "SalesDayReviewItem", "PipelineStage", "Opportunity",
  "OpportunityOwnerSplit", "SalesTarget", "ProductService", "Proposal", "ProposalLineItem",
  "ProposalPdfAttachment", "Order", "OrderLineItem", "OrderOwnerSplitSnapshot", "ProductionTemplate",
  "ProductionTemplateStage", "ProductionWorkItem", "ProductionStageInstance", "ProductionNote", "Invoice",
  "Payment", "PaymentAllocation", "CostComponent", "Incentive", "IncentiveSplit"
] as const;
const legacyGlobalBusinessIndexes = [
  "SharedBusinessRecord_entityType_ecrmLegacyId_key",
  "SharedBusinessRecord_entityType_emailVoiceLegacyId_key",
  "SharedBusinessRecord_entityType_externalKey_key",
  "WorkflowEvent_sourceApp_sourceEventId_key",
  "SalesDayReview_ownerId_reviewDate_key",
  "SalesDayReviewItem_reviewId_taskId_key",
  "PipelineStage_name_key",
  "ProductService_code_key",
  "SalesTarget_ownerId_financialYear_quarter_key",
  "Proposal_opportunityId_sequenceNumber_key",
  "Order_orderNumber_key",
  "ProductionTemplate_key_key",
  "ProductionTemplateStage_templateId_key_key",
  "Invoice_invoiceNumber_key"
] as const;

integration("PostgreSQL tenant RLS", () => {
  if (!testDatabaseUrl || !testTenantDatabaseUrl) return;
  const databaseName = new URL(testDatabaseUrl).pathname.slice(1);
  const tenantDatabaseName = new URL(testTenantDatabaseUrl).pathname.slice(1);
  if (!/(test|wp4|disposable)/i.test(databaseName)) {
    throw new Error("TEST_DATABASE_URL must name an explicitly disposable test database.");
  }
  if (tenantDatabaseName !== databaseName) {
    throw new Error("The tenant test URL must target the same disposable database as TEST_DATABASE_URL.");
  }

  const database = new PrismaClient({ datasourceUrl: testDatabaseUrl });
  const tenantUrl = new URL(testTenantDatabaseUrl);
  tenantUrl.searchParams.set("connection_limit", "1");
  const tenantDatabase = new PrismaClient({ datasourceUrl: tenantUrl.toString() });

  beforeAll(async () => {
    await database.leadCustomer.deleteMany({ where: { id: { in: ["rls_lead_A", "rls_lead_B"] } } });
    await database.organizationMembership.deleteMany({ where: { id: { in: ["rls_membership_A", "rls_membership_B"] } } });
    await database.user.deleteMany({ where: { id: { in: ["rls_user_A", "rls_user_B"] } } });
    await database.organization.deleteMany({ where: { id: { in: ["rls_org_A", "rls_org_B"] } } });
    await database.organization.createMany({ data: [
      { id: "rls_org_A", key: "rls-org-a", legalName: "RLS Org A", displayName: "RLS Org A", deploymentRegion: "local", status: "ACTIVE" },
      { id: "rls_org_B", key: "rls-org-b", legalName: "RLS Org B", displayName: "RLS Org B", deploymentRegion: "local", status: "ACTIVE" }
    ] });
    await database.user.createMany({ data: [
      { id: "rls_user_A", name: "RLS User A", email: "rls-a@example.test", passwordHash: "test", role: "SALES" },
      { id: "rls_user_B", name: "RLS User B", email: "rls-b@example.test", passwordHash: "test", role: "SALES" }
    ] });
    await database.organizationMembership.createMany({ data: [
      { id: "rls_membership_A", organizationId: "rls_org_A", userId: "rls_user_A", role: "SALES", status: "ACTIVE" },
      { id: "rls_membership_B", organizationId: "rls_org_B", userId: "rls_user_B", role: "SALES", status: "ACTIVE" }
    ] });
    for (const fixture of [
      { id: "rls_lead_A", organizationId: "rls_org_A", ownerId: "rls_user_A" },
      { id: "rls_lead_B", organizationId: "rls_org_B", ownerId: "rls_user_B" }
    ]) {
      await database.$transaction(async (transaction) => {
        await transaction.$executeRaw`SELECT set_config('app.organization_id', ${fixture.organizationId}, true)`;
        await transaction.leadCustomer.create({ data: {
          ...fixture,
          name: "Same Shape",
          createdById: fixture.ownerId,
          updatedById: fixture.ownerId
        } });
      });
    }
  });

  afterAll(async () => {
    await database.leadCustomer.deleteMany({ where: { id: { in: ["rls_lead_A", "rls_lead_B"] } } });
    await database.organizationMembership.deleteMany({ where: { id: { in: ["rls_membership_A", "rls_membership_B"] } } });
    await database.user.deleteMany({ where: { id: { in: ["rls_user_A", "rls_user_B"] } } });
    await database.organization.deleteMany({ where: { id: { in: ["rls_org_A", "rls_org_B"] } } });
    await tenantDatabase.$disconnect();
    await database.$disconnect();
  });

  it("forces all owned tables and uses a non-bypass application role", async () => {
    const tables = await database.$queryRaw<Array<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>>`
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = ANY(${[...ownedTables]}::text[])
    `;
    expect(tables).toHaveLength(ownedTables.length);
    expect(tables.every((table) => table.relrowsecurity && table.relforcerowsecurity)).toBe(true);

    const policies = await database.$queryRaw<Array<{ tablename: string; policyname: string; qual: string; with_check: string }>>`
      SELECT tablename, policyname, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = ANY(${[...ownedTables]}::text[])
      ORDER BY tablename, policyname
    `;
    expect(policies).toHaveLength(ownedTables.length);
    expect(new Set(policies.map((policy) => policy.tablename))).toEqual(new Set(ownedTables));
    for (const policy of policies) {
      expect(policy.policyname).toBe(`${policy.tablename}_organization_isolation`);
      expect(policy.qual).toContain("current_setting('app.organization_id'::text, true)");
      expect(policy.with_check).toContain("current_setting('app.organization_id'::text, true)");
      expect(policy.qual).toContain("NULLIF");
      expect(policy.with_check).toContain("NULLIF");
    }

    const roles = await database.$queryRaw<Array<{ rolsuper: boolean; rolbypassrls: boolean }>>`
      SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'ecrm_tenant_app'
    `;
    expect(roles).toEqual([{ rolsuper: false, rolbypassrls: false }]);

    const loginMembers = await tenantDatabase.$queryRaw<Array<{
      rolname: string;
      rolcanlogin: boolean;
      rolsuper: boolean;
      rolbypassrls: boolean;
    }>>`
      SELECT member.rolname, member.rolcanlogin, member.rolsuper, member.rolbypassrls
      FROM pg_auth_members membership
      JOIN pg_roles granted_role ON granted_role.oid = membership.roleid
      JOIN pg_roles member ON member.oid = membership.member
      WHERE granted_role.rolname = 'ecrm_tenant_app' AND member.rolname = current_user
    `;
    expect(loginMembers.some((member) =>
      member.rolcanlogin && !member.rolsuper && !member.rolbypassrls
    )).toBe(true);

    const legacyIndexes = await database.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = ANY(${[...legacyGlobalBusinessIndexes]}::text[])
    `;
    expect(legacyIndexes).toEqual([]);
  });

  it("catalog-proves every tenant parent edge and User foreign key guard", async () => {
    const foreignKeys = await database.$queryRaw<Array<{
      child_table: string;
      definition: string;
      parent_table: string;
      validated: boolean;
    }>>`
      SELECT child.relname AS child_table,
             parent.relname AS parent_table,
             pg_get_constraintdef(constraint_row.oid) AS definition,
             constraint_row.convalidated AS validated
      FROM pg_constraint constraint_row
      JOIN pg_class child ON child.oid = constraint_row.conrelid
      JOIN pg_class parent ON parent.oid = constraint_row.confrelid
      JOIN pg_namespace namespace ON namespace.oid = child.relnamespace
      WHERE namespace.nspname = 'public' AND constraint_row.contype = 'f'
    `;

    for (const relation of [...tenantOwnedRelationships, ...tenantOpaqueOwnedRelationships]) {
      const expectedColumns = `FOREIGN KEY ("organizationId", "${relation.childField}")`;
      const expectedParent = `REFERENCES "${relation.parent}"("organizationId", id)`;
      expect(foreignKeys.some((foreignKey) =>
        foreignKey.child_table === relation.child
        && foreignKey.parent_table === relation.parent
        && foreignKey.validated
        && foreignKey.definition.includes(expectedColumns)
        && foreignKey.definition.includes(expectedParent)
      ), `${relation.child}.${relation.childField} must have a validated compound tenant FK`).toBe(true);
    }

    const memberTriggers = await database.$queryRaw<Array<{
      table_name: string;
      trigger_name: string;
    }>>`
      SELECT table_row.relname AS table_name, trigger_row.tgname AS trigger_name
      FROM pg_trigger trigger_row
      JOIN pg_class table_row ON table_row.oid = trigger_row.tgrelid
      JOIN pg_proc function_row ON function_row.oid = trigger_row.tgfoid
      JOIN pg_namespace namespace ON namespace.oid = table_row.relnamespace
      WHERE namespace.nspname = 'public'
        AND NOT trigger_row.tgisinternal
        AND function_row.proname = 'assert_tenant_user_fk'
    `;
    expect(memberTriggers).toHaveLength(tenantUserRelationships.length);
    for (const relation of tenantUserRelationships) {
      const expectedTrigger = `${relation.child}_tenant_member_${relation.childField}_trg`.slice(0, 63);
      expect(memberTriggers).toContainEqual({ table_name: relation.child, trigger_name: expectedTrigger });
    }
  });

  it("denies direct authentication and control-plane table access", async () => {
    await tenantDatabase.$transaction(async (transaction) => {
      for (const [index, table] of ["Organization", "OrganizationMembership"].entries()) {
        const savepoint = `denied_control_plane_${index}`;
        await transaction.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
        await expect(
          transaction.$queryRawUnsafe(`SELECT 1 FROM "${table}" LIMIT 1`)
        ).rejects.toThrow();
        await transaction.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      }
      await transaction.$executeRawUnsafe("SAVEPOINT denied_user_authentication_data");
      await expect(transaction.$queryRawUnsafe('SELECT "passwordHash" FROM "User" LIMIT 1')).rejects.toThrow();
      await transaction.$executeRawUnsafe("ROLLBACK TO SAVEPOINT denied_user_authentication_data");
    });
  });

  it("denies unset/cross-tenant access and resets local context on reused connections", async () => {
    await tenantDatabase.$transaction(async (transaction) => {
      expect(await transaction.leadCustomer.count()).toBe(0);
      await transaction.$executeRawUnsafe("SAVEPOINT denied_unset_write");
      await expect(transaction.leadCustomer.create({ data: {
        id: "rls_unset_write", organizationId: "rls_org_A", name: "Denied", ownerId: "rls_user_A",
        createdById: "rls_user_A", updatedById: "rls_user_A"
      } })).rejects.toThrow();
      await transaction.$executeRawUnsafe("ROLLBACK TO SAVEPOINT denied_unset_write");
    });

    let tenantBackendPid = 0;
    await tenantDatabase.$transaction(async (transaction) => {
      tenantBackendPid = Number((await transaction.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`)[0]?.pid);
      await transaction.$executeRaw`SELECT set_config('app.organization_id', ${"rls_org_A"}, true)`;
      expect(await transaction.leadCustomer.count()).toBe(1);
      expect(await transaction.leadCustomer.findFirst({
        where: { id: "rls_lead_A" },
        select: { id: true, owner: { select: { id: true, name: true, email: true, role: true } } }
      })).toEqual({
        id: "rls_lead_A",
        owner: { id: "rls_user_A", name: "RLS User A", email: "rls-a@example.test", role: "SALES" }
      });
      expect(await transaction.leadCustomer.findFirst({ where: { id: "rls_lead_B" } })).toBeNull();
      expect((await transaction.leadCustomer.updateMany({ where: { id: "rls_lead_B" }, data: { notes: "denied" } })).count).toBe(0);
      expect((await transaction.leadCustomer.deleteMany({ where: { id: "rls_lead_B" } })).count).toBe(0);
      await transaction.$executeRawUnsafe("SAVEPOINT denied_cross_owner");
      await expect(transaction.leadCustomer.create({ data: {
        id: "rls_bad_owner", organizationId: "rls_org_B", name: "Denied", ownerId: "rls_user_A",
        createdById: "rls_user_A", updatedById: "rls_user_A"
      } })).rejects.toThrow();
      await transaction.$executeRawUnsafe("ROLLBACK TO SAVEPOINT denied_cross_owner");
      await transaction.$executeRawUnsafe("SAVEPOINT denied_cross_parent");
      await expect(transaction.branch.create({ data: {
        id: "rls_bad_parent", organizationId: "rls_org_A", leadCustomerId: "rls_lead_B", name: "Denied"
      } })).rejects.toThrow();
      await transaction.$executeRawUnsafe("ROLLBACK TO SAVEPOINT denied_cross_parent");
      const created = await transaction.leadCustomer.create({ data: {
        id: "rls_crud_A", organizationId: "rls_org_A", name: "CRUD", ownerId: "rls_user_A",
        createdById: "rls_user_A", updatedById: "rls_user_A"
      } });
      await transaction.leadCustomer.update({ where: { id: created.id }, data: { notes: "updated" } });
      await transaction.leadCustomer.delete({ where: { id: created.id } });
    });

    await tenantDatabase.$transaction(async (transaction) => {
      const pid = Number((await transaction.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`)[0]?.pid);
      expect(pid).toBe(tenantBackendPid);
      const setting = await transaction.$queryRaw<Array<{ organization_id: string }>>`
        SELECT current_setting('app.organization_id', true) AS organization_id
      `;
      expect(setting[0]?.organization_id ?? "").toBe("");
      expect(await transaction.leadCustomer.count()).toBe(0);
    });

    await expect(tenantDatabase.$transaction(async (transaction) => {
      const pid = Number((await transaction.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`)[0]?.pid);
      expect(pid).toBe(tenantBackendPid);
      await transaction.$executeRaw`SELECT set_config('app.organization_id', ${"rls_org_B"}, true)`;
      expect(await transaction.leadCustomer.count()).toBe(1);
      throw new Error("force rollback");
    })).rejects.toThrow("force rollback");

    await tenantDatabase.$transaction(async (transaction) => {
      const pid = Number((await transaction.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`)[0]?.pid);
      expect(pid).toBe(tenantBackendPid);
      const setting = await transaction.$queryRaw<Array<{ organization_id: string }>>`
        SELECT current_setting('app.organization_id', true) AS organization_id
      `;
      expect(setting[0]?.organization_id ?? "").toBe("");
      expect(await transaction.leadCustomer.count()).toBe(0);
    });
  });

  it("rejects a member revoked after control-plane prevalidation and before the tenant write", async () => {
    const prevalidated = await database.organizationMembership.findFirst({
      where: { organizationId: "rls_org_A", userId: "rls_user_A", status: "ACTIVE" },
      select: { id: true }
    });
    expect(prevalidated).toEqual({ id: "rls_membership_A" });

    await database.organizationMembership.update({
      where: { id: "rls_membership_A" },
      data: { status: "REVOKED" }
    });

    try {
      await expect(withOrganization("rls_org_A", async (transaction) => {
        await assertTenantMember(transaction, "rls_user_A", ["SALES"]);
        await transaction.leadCustomer.create({ data: {
          id: "rls_revoked_write", organizationId: "rls_org_A", name: "Denied after revocation",
          ownerId: "rls_user_A", createdById: "rls_user_A", updatedById: "rls_user_A"
        } });
      }, tenantDatabase)).rejects.toThrow("Organization member was not found.");
      expect(await database.leadCustomer.findUnique({ where: { id: "rls_revoked_write" } })).toBeNull();
    } finally {
      await database.organizationMembership.update({
        where: { id: "rls_membership_A" },
        data: { status: "ACTIVE" }
      });
    }
  });

  it("holds a conflicting membership lock until the tenant transaction ends", async () => {
    let releaseGuard!: () => void;
    const guardedWorkMayFinish = new Promise<void>((resolve) => { releaseGuard = resolve; });
    let guardAcquired!: () => void;
    const guardIsHoldingLocks = new Promise<void>((resolve) => { guardAcquired = resolve; });

    const guardedTransaction = withOrganization("rls_org_A", async (transaction) => {
      await assertTenantMember(transaction, "rls_user_A", ["SALES"]);
      guardAcquired();
      await guardedWorkMayFinish;
    }, tenantDatabase);

    await guardIsHoldingLocks;
    let revocationSettled = false;
    const revocation = database.organizationMembership.update({
      where: { id: "rls_membership_A" },
      data: { status: "REVOKED" }
    }).then(() => { revocationSettled = true; });

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(revocationSettled).toBe(false);

    releaseGuard();
    await guardedTransaction;
    await revocation;
    expect(revocationSettled).toBe(true);

    try {
      await expect(withOrganization("rls_org_A", (transaction) =>
        assertTenantMember(transaction, "rls_user_A", ["SALES"]), tenantDatabase
      )).rejects.toThrow("Organization member was not found.");
    } finally {
      await database.organizationMembership.update({
        where: { id: "rls_membership_A" },
        data: { status: "ACTIVE" }
      });
    }
  });
});
