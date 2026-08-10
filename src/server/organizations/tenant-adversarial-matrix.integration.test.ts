import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTenantDatabaseMatrixAdapters, type TenantDomainProbe } from "./tenant-adversarial-database";
import { executeTenantIsolationMatrix, tenantIsolationDomains } from "./tenant-adversarial-matrix";

const controlUrl = process.env.TEST_DATABASE_URL;
const tenantUrlValue = process.env.TEST_TENANT_DATABASE_URL;
const integration = describe.runIf(Boolean(controlUrl && tenantUrlValue));

const orgA = "matrix_org_A";
const orgB = "matrix_org_B";
const userA = "matrix_user_A";
const userB = "matrix_user_B";
const marker = "Tenant matrix collision";
const id = (entity: string, tenant: "A" | "B") => `matrix_${entity}_${tenant}`;

const probes = {
  crm: { table: "LeadCustomer", labelColumn: "name", rowA: id("lead", "A"), rowB: id("lead", "B"), parentTable: "LeadCustomer", nestedTable: "Branch", nestedForeignKey: "leadCustomerId" },
  "sales-day": { table: "SalesTask", labelColumn: "title", rowA: id("task", "A"), rowB: id("task", "B"), parentTable: "SalesTask", nestedTable: "SalesTextNote", nestedForeignKey: "taskId" },
  "pipeline-opportunities": { table: "Opportunity", labelColumn: "title", rowA: id("opportunity", "A"), rowB: id("opportunity", "B"), parentTable: "Opportunity", nestedTable: "Proposal", nestedForeignKey: "opportunityId" },
  "products-proposals": { table: "ProductService", labelColumn: "name", rowA: id("product", "A"), rowB: id("product", "B"), parentTable: "ProductService", nestedTable: "ProposalLineItem", nestedForeignKey: "productServiceId", createOverrides: { code: "MATRIX-CREATE" } },
  "orders-production": { table: "ProductionTemplate", labelColumn: "name", rowA: id("template", "A"), rowB: id("template", "B"), parentTable: "ProductionTemplate", nestedTable: "ProductionTemplateStage", nestedForeignKey: "templateId", createOverrides: { key: "MATRIX-CREATE" } },
  "finance-incentives": { table: "Invoice", labelColumn: "invoiceNumber", rowA: id("invoice", "A"), rowB: id("invoice", "B"), parentTable: "Invoice", nestedTable: "PaymentAllocation", nestedForeignKey: "invoiceId", createOverrides: { invoiceNumber: "MATRIX-CREATE" } },
  reports: { table: "Opportunity", labelColumn: "title", rowA: id("opportunity", "A"), rowB: id("opportunity", "B"), parentTable: "Opportunity", nestedTable: "Proposal", nestedForeignKey: "opportunityId" },
  "shared-export": { table: "SharedBusinessRecord", labelColumn: "displayName", rowA: id("shared", "A"), rowB: id("shared", "B"), parentTable: "SharedBusinessRecord", nestedTable: "SharedBusinessRecordVersion", nestedForeignKey: "recordId", createOverrides: { externalKey: "matrix-create" } },
  workflow: { table: "WorkflowEvent", labelColumn: "summary", rowA: id("workflow", "A"), rowB: id("workflow", "B"), parentTable: "WorkflowEvent", createOverrides: { sourceEventId: "matrix-create" } }
} satisfies Record<(typeof tenantIsolationDomains)[number], TenantDomainProbe>;

integration("executable organization A/B adversarial matrix", () => {
  if (!controlUrl || !tenantUrlValue) return;
  const controlDatabaseName = new URL(controlUrl).pathname.slice(1);
  const tenantDatabaseName = new URL(tenantUrlValue).pathname.slice(1);
  if (!/(test|wp4|disposable)/i.test(controlDatabaseName) || tenantDatabaseName !== controlDatabaseName) {
    throw new Error("Tenant matrix URLs must target the same explicitly disposable test database.");
  }

  const control = new PrismaClient({ datasourceUrl: controlUrl });
  const tenantUrl = new URL(tenantUrlValue);
  tenantUrl.searchParams.set("connection_limit", "1");
  const tenant = new PrismaClient({ datasourceUrl: tenantUrl.toString() });

  async function cleanFixtures() {
    const organizations = [orgA, orgB];
    for (const table of [
      "PaymentAllocation", "Payment", "Invoice", "Order", "ProposalLineItem", "Branch", "SalesTextNote",
      "SharedBusinessRecordVersion", "Proposal", "Opportunity", "SalesTask", "PipelineStage", "ProductService",
      "ProductionTemplateStage", "ProductionTemplate", "SharedBusinessRecord", "WorkflowEvent", "LeadCustomer"
    ]) {
      await control.$executeRawUnsafe(`DELETE FROM "${table}" WHERE "organizationId" = ANY($1::text[])`, organizations);
    }
    await control.organizationMembership.deleteMany({ where: { organizationId: { in: organizations } } });
    await control.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await control.organization.deleteMany({ where: { id: { in: organizations } } });
  }

  beforeAll(async () => {
    await cleanFixtures();
    await control.organization.createMany({ data: [
      { id: orgA, key: "matrix-org-a", legalName: "Matrix A", displayName: "Matrix A", deploymentRegion: "local", status: "ACTIVE" },
      { id: orgB, key: "matrix-org-b", legalName: "Matrix B", displayName: "Matrix B", deploymentRegion: "local", status: "ACTIVE" }
    ] });
    await control.user.createMany({ data: [
      { id: userA, name: "Matrix A", email: "matrix-a@example.test", passwordHash: "test", role: "ADMIN" },
      { id: userB, name: "Matrix B", email: "matrix-b@example.test", passwordHash: "test", role: "ADMIN" }
    ] });
    await control.organizationMembership.createMany({ data: [
      { id: id("membership", "A"), organizationId: orgA, userId: userA, role: "ADMIN", status: "ACTIVE" },
      { id: id("membership", "B"), organizationId: orgB, userId: userB, role: "ADMIN", status: "ACTIVE" }
    ] });

    for (const tenantName of ["A", "B"] as const) {
      const organizationId = tenantName === "A" ? orgA : orgB;
      const ownerId = tenantName === "A" ? userA : userB;
      await control.leadCustomer.create({ data: { id: id("lead", tenantName), organizationId, name: marker, ownerId, createdById: ownerId, updatedById: ownerId } });
      await control.branch.create({ data: { id: id("branch", tenantName), organizationId, leadCustomerId: id("lead", tenantName), name: marker } });
      await control.salesTask.create({ data: { id: id("task", tenantName), organizationId, ownerId, title: marker, type: "FOLLOW_UP" } });
      await control.salesTextNote.create({ data: { id: id("text", tenantName), organizationId, ownerId, taskId: id("task", tenantName), body: marker } });
      await control.pipelineStage.create({ data: { id: id("stage", tenantName), organizationId, name: `Matrix Stage ${tenantName}`, sortOrder: 1 } });
      await control.opportunity.create({ data: { id: id("opportunity", tenantName), organizationId, leadCustomerId: id("lead", tenantName), stageId: id("stage", tenantName), ownerId, title: marker, createdById: ownerId, updatedById: ownerId } });
      await control.productService.create({ data: { id: id("product", tenantName), organizationId, name: marker, code: "MATRIX-CODE", category: "Matrix", createdById: ownerId, updatedById: ownerId } });
      await control.proposal.create({ data: { id: id("proposal", tenantName), organizationId, opportunityId: id("opportunity", tenantName), title: marker, sequenceNumber: 1, createdById: ownerId, updatedById: ownerId } });
      await control.proposalLineItem.create({ data: { id: id("proposal_line", tenantName), organizationId, proposalId: id("proposal", tenantName), productServiceId: id("product", tenantName), productNameSnapshot: marker, productCategorySnapshot: "Matrix", quantity: 1, unitPricePaisa: 100, gstRateBps: 0, lineSubtotalPaisa: 100, lineGstPaisa: 0, lineTotalPaisa: 100 } });
      await control.order.create({ data: { id: id("order", tenantName), organizationId, orderNumber: "MATRIX-ORDER", proposalId: id("proposal", tenantName), opportunityId: id("opportunity", tenantName), leadCustomerId: id("lead", tenantName), ownerId, subtotalPaisa: 100, gstPaisa: 0, totalPaisa: 100, createdById: ownerId, updatedById: ownerId } });
      await control.invoice.create({ data: { id: id("invoice", tenantName), organizationId, orderId: id("order", tenantName), invoiceNumber: marker, invoiceDate: new Date("2026-01-01T00:00:00Z"), subtotalPaisa: 100, gstPaisa: 0, totalPaisa: 100, createdById: ownerId, updatedById: ownerId } });
      await control.payment.create({ data: { id: id("payment", tenantName), organizationId, orderId: id("order", tenantName), paymentDate: new Date("2026-01-02T00:00:00Z"), amountPaisa: 10, mode: "BANK_TRANSFER", createdById: ownerId } });
      await control.paymentAllocation.create({ data: { id: id("allocation", tenantName), organizationId, paymentId: id("payment", tenantName), invoiceId: id("invoice", tenantName), amountPaisa: 10 } });
      await control.productionTemplate.create({ data: { id: id("template", tenantName), organizationId, key: "MATRIX-TEMPLATE", name: marker } });
      await control.productionTemplateStage.create({ data: { id: id("template_stage", tenantName), organizationId, templateId: id("template", tenantName), key: "matrix-stage", name: marker } });
      await control.sharedBusinessRecord.create({ data: { id: id("shared", tenantName), organizationId, entityType: "CUSTOMER", displayName: marker, status: "ACTIVE", sourceApp: "matrix", externalKey: "matrix-shared", searchText: marker, data: { tenantName } } });
      await control.sharedBusinessRecordVersion.create({ data: { id: id("shared_version", tenantName), organizationId, recordId: id("shared", tenantName), versionNumber: 1, entityType: "CUSTOMER", sourceApp: "matrix", changeType: "CREATED", changedFields: [], snapshot: { tenantName } } });
      await control.workflowEvent.create({ data: { id: id("workflow", tenantName), organizationId, sourceApp: "matrix", sourceEventId: "matrix-event", sourceEventType: "matrix.test", entityType: "customer", summary: marker, payload: { tenantName } } });
    }
  });

  afterAll(async () => {
    await cleanFixtures();
    await tenant.$disconnect();
    await control.$disconnect();
  });

  it("executes every domain/category cell through the tenant login and transaction-local organization context", async () => {
    const adapters = createTenantDatabaseMatrixAdapters({ control, marker, organizationA: orgA, organizationB: orgB, probes, tenant });
    const executions = await executeTenantIsolationMatrix(adapters);
    expect(executions).toHaveLength(90);
    expect(new Set(executions.map(({ domain }) => domain))).toEqual(new Set(tenantIsolationDomains));
  });
});
