import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.runIf(Boolean(testDatabaseUrl));
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

integration("PostgreSQL tenant RLS", () => {
  if (!testDatabaseUrl) return;
  const databaseName = new URL(testDatabaseUrl).pathname.slice(1);
  if (!/(test|wp4|disposable)/i.test(databaseName)) {
    throw new Error("TEST_DATABASE_URL must name an explicitly disposable test database.");
  }

  const database = new PrismaClient({ datasourceUrl: testDatabaseUrl });

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
    await database.leadCustomer.createMany({ data: [
      { id: "rls_lead_A", organizationId: "rls_org_A", name: "Same Shape", ownerId: "rls_user_A", createdById: "rls_user_A", updatedById: "rls_user_A" },
      { id: "rls_lead_B", organizationId: "rls_org_B", name: "Same Shape", ownerId: "rls_user_B", createdById: "rls_user_B", updatedById: "rls_user_B" }
    ] });
  });

  afterAll(async () => {
    await database.leadCustomer.deleteMany({ where: { id: { in: ["rls_lead_A", "rls_lead_B"] } } });
    await database.organizationMembership.deleteMany({ where: { id: { in: ["rls_membership_A", "rls_membership_B"] } } });
    await database.user.deleteMany({ where: { id: { in: ["rls_user_A", "rls_user_B"] } } });
    await database.organization.deleteMany({ where: { id: { in: ["rls_org_A", "rls_org_B"] } } });
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

    const roles = await database.$queryRaw<Array<{ rolsuper: boolean; rolbypassrls: boolean }>>`
      SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'ecrm_tenant_app'
    `;
    expect(roles).toEqual([{ rolsuper: false, rolbypassrls: false }]);
  });

  it("denies unset/cross-tenant access and resets local context on reused connections", async () => {
    await database.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe("SET LOCAL ROLE ecrm_tenant_app");
      expect(await transaction.leadCustomer.count()).toBe(0);
      await transaction.$executeRawUnsafe("SAVEPOINT denied_unset_write");
      await expect(transaction.leadCustomer.create({ data: {
        id: "rls_unset_write", organizationId: "rls_org_A", name: "Denied", ownerId: "rls_user_A",
        createdById: "rls_user_A", updatedById: "rls_user_A"
      } })).rejects.toThrow();
      await transaction.$executeRawUnsafe("ROLLBACK TO SAVEPOINT denied_unset_write");
    });

    await database.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe("SET LOCAL ROLE ecrm_tenant_app");
      await transaction.$executeRaw`SELECT set_config('app.organization_id', ${"rls_org_A"}, true)`;
      expect(await transaction.leadCustomer.count()).toBe(1);
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

    await database.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe("SET LOCAL ROLE ecrm_tenant_app");
      expect(await transaction.leadCustomer.count()).toBe(0);
    });
  });
});
