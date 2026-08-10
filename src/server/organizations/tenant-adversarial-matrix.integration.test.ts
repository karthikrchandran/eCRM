import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTenantDatabaseMatrixAdapters, type TenantDomainProbe } from "./tenant-adversarial-database";
import { executeTenantIsolationMatrix, tenantIsolationCategories, tenantIsolationDomains } from "./tenant-adversarial-matrix";
import { withOrganization } from "./with-organization";
import { ingestWorkflowEvent } from "@/server/workflow-events/service";
import { getLeadCustomerDetail, listLeadCustomers } from "@/server/crm/queries";
import { getOrderFinanceSummary } from "@/server/finance/queries";
import { getOpportunityDetail, listOpportunities } from "@/server/opportunities/queries";
import { getOrderDetail, listOrders } from "@/server/orders/queries";
import { listActiveProductServices } from "@/server/products/queries";
import { getProductionWorkItemDetail, listProductionTemplateConfig } from "@/server/production/queries";
import { getProposalDetail } from "@/server/proposals/queries";
import { getReportsOverview } from "@/server/reports/queries";
import { loadMyDay } from "@/server/sales-day/queries";
import { getSharedRecord, listSharedRecords } from "@/server/shared-records/queries";
import { listWorkflowEventsForEntity } from "@/server/workflow-events/service";

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

const publicModelBindings = {
  SharedBusinessRecord: "shared", SharedBusinessRecordVersion: "shared",
  SharedRecordExportSnapshot: "shared", SharedRecordExportSnapshotItem: "shared",
  WorkflowEvent: "workflow",
  LeadCustomer: "crm", Branch: "crm", Contact: "crm", Activity: "crm", LeadOwnershipHistory: "crm",
  SalesTask: "sales", SalesTextNote: "sales", SalesVoiceNote: "sales", SalesVoiceNoteAction: "sales",
  SalesDayReview: "sales", SalesDayReviewItem: "sales",
  PipelineStage: "opportunities", Opportunity: "opportunities", OpportunityOwnerSplit: "opportunities", SalesTarget: "opportunities",
  ProductService: "products", Proposal: "proposals", ProposalLineItem: "proposals", ProposalPdfAttachment: "proposals",
  Order: "orders", OrderLineItem: "orders", OrderOwnerSplitSnapshot: "orders",
  ProductionTemplate: "production", ProductionTemplateStage: "production", ProductionWorkItem: "production",
  ProductionStageInstance: "production", ProductionNote: "production",
  Invoice: "finance", Payment: "finance", PaymentAllocation: "finance", CostComponent: "finance",
  Incentive: "finance", IncentiveSplit: "finance"
} as const;

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
      await control.$transaction(async (transaction) => {
        await transaction.$executeRaw`SELECT set_config('app.organization_id', ${organizationId}, true)`;
        await transaction.leadCustomer.create({ data: { id: id("lead", tenantName), organizationId, name: marker, ownerId, createdById: ownerId, updatedById: ownerId } });
        await transaction.branch.create({ data: { id: id("branch", tenantName), organizationId, leadCustomerId: id("lead", tenantName), name: marker } });
        await transaction.salesTask.create({ data: { id: id("task", tenantName), organizationId, ownerId, title: marker, type: "FOLLOW_UP" } });
        await transaction.salesTextNote.create({ data: { id: id("text", tenantName), organizationId, ownerId, taskId: id("task", tenantName), body: marker } });
        await transaction.pipelineStage.create({ data: { id: id("stage", tenantName), organizationId, name: `Matrix Stage ${tenantName}`, sortOrder: 1 } });
        await transaction.opportunity.create({ data: { id: id("opportunity", tenantName), organizationId, leadCustomerId: id("lead", tenantName), stageId: id("stage", tenantName), ownerId, title: marker, createdById: ownerId, updatedById: ownerId } });
        await transaction.productService.create({ data: { id: id("product", tenantName), organizationId, name: marker, code: "MATRIX-CODE", category: "Matrix", createdById: ownerId, updatedById: ownerId } });
        await transaction.proposal.create({ data: { id: id("proposal", tenantName), organizationId, opportunityId: id("opportunity", tenantName), title: marker, sequenceNumber: 1, createdById: ownerId, updatedById: ownerId } });
        await transaction.proposalLineItem.create({ data: { id: id("proposal_line", tenantName), organizationId, proposalId: id("proposal", tenantName), productServiceId: id("product", tenantName), productNameSnapshot: marker, productCategorySnapshot: "Matrix", quantity: 1, unitPricePaisa: 100, gstRateBps: 0, lineSubtotalPaisa: 100, lineGstPaisa: 0, lineTotalPaisa: 100 } });
        await transaction.order.create({ data: { id: id("order", tenantName), organizationId, orderNumber: "MATRIX-ORDER", proposalId: id("proposal", tenantName), opportunityId: id("opportunity", tenantName), leadCustomerId: id("lead", tenantName), ownerId, subtotalPaisa: 100, gstPaisa: 0, totalPaisa: 100, createdById: ownerId, updatedById: ownerId } });
        await transaction.invoice.create({ data: { id: id("invoice", tenantName), organizationId, orderId: id("order", tenantName), invoiceNumber: marker, invoiceDate: new Date("2026-01-01T00:00:00Z"), subtotalPaisa: 100, gstPaisa: 0, totalPaisa: 100, createdById: ownerId, updatedById: ownerId } });
        await transaction.payment.create({ data: { id: id("payment", tenantName), organizationId, orderId: id("order", tenantName), paymentDate: new Date("2026-01-02T00:00:00Z"), amountPaisa: 10, mode: "BANK_TRANSFER", createdById: ownerId } });
        await transaction.paymentAllocation.create({ data: { id: id("allocation", tenantName), organizationId, paymentId: id("payment", tenantName), invoiceId: id("invoice", tenantName), amountPaisa: 10 } });
        await transaction.productionTemplate.create({ data: { id: id("template", tenantName), organizationId, key: "MATRIX-TEMPLATE", name: marker } });
        await transaction.productionTemplateStage.create({ data: { id: id("template_stage", tenantName), organizationId, templateId: id("template", tenantName), key: "matrix-stage", name: marker } });
        await transaction.sharedBusinessRecord.create({ data: { id: id("shared", tenantName), organizationId, entityType: "CUSTOMER", displayName: marker, status: "ACTIVE", sourceApp: "matrix", externalKey: "matrix-shared", searchText: marker, data: { tenantName } } });
        await transaction.sharedBusinessRecordVersion.create({ data: { id: id("shared_version", tenantName), organizationId, recordId: id("shared", tenantName), versionNumber: 1, entityType: "CUSTOMER", sourceApp: "matrix", changeType: "CREATED", changedFields: [], snapshot: { tenantName } } });
        await transaction.workflowEvent.create({ data: { id: id("workflow", tenantName), organizationId, sourceApp: "matrix", sourceEventId: "matrix-event", sourceEventType: "matrix.test", entityType: "customer", summary: marker, payload: { tenantName } } });
      });
    }
  });

  afterAll(async () => {
    await cleanFixtures();
    await tenant.$disconnect();
    await control.$disconnect();
  });

  it("executes every domain/category cell through the tenant login and transaction-local organization context", async () => {
    const adapters = createTenantDatabaseMatrixAdapters({ control, marker, organizationA: orgA, organizationB: orgB, probes, tenant });
    adapters.workflow["foreign-attachment"] = async () => {
      await expect(withOrganization(orgA, (transaction) => ingestWorkflowEvent(orgA, {
        sourceApp: "matrix",
        sourceEventId: "matrix-foreign-attempt",
        sourceEventType: "matrix.test",
        entityType: "EXTERNAL",
        relatedRecordType: "LEAD",
        relatedRecordId: id("lead", "B"),
        summary: "Cross-tenant workflow attachment"
      }, transaction as never), tenant)).rejects.toThrow("Related record was not found.");
    };
    const executions = await executeTenantIsolationMatrix(adapters);
    expect(executions).toHaveLength(90);
    expect(new Set(executions.map(({ domain }) => domain))).toEqual(new Set(tenantIsolationDomains));
  });

  it("binds all 38 models to executed real public repository operations over A/B fixtures", async () => {
    const user = { id: userA, organizationId: orgA, role: "ADMIN" as const, name: "Matrix A", email: "matrix-a@example.test" };
    const executedModels: string[] = [];
    const executedCells: string[] = [];

    await withOrganization(orgA, async (transaction) => {
      const operations = {
        async crm() {
          const listed = await listLeadCustomers(user, {}, transaction as never, []);
          expect(listed.records.map((row) => row.id)).toContain(id("lead", "A"));
          expect(await getLeadCustomerDetail(user, id("lead", "B"), transaction as never)).toBeNull();
          return listed;
        },
        async sales() {
          return loadMyDay(user, new Date("2026-08-09T12:00:00.000Z"), transaction as never);
        },
        async opportunities() {
          const listed = await listOpportunities(user, {}, transaction as never);
          expect(await getOpportunityDetail(user, id("opportunity", "B"), transaction as never)).toBeNull();
          return listed;
        },
        async products() {
          return listActiveProductServices(user, transaction as never);
        },
        async proposals() {
          expect(await getProposalDetail(user, id("proposal", "B"), transaction as never)).toBeNull();
          return getProposalDetail(user, id("proposal", "A"), transaction as never);
        },
        async orders() {
          const listed = await listOrders(user, {}, transaction as never);
          expect(await getOrderDetail(user, id("order", "B"), transaction as never)).toBeNull();
          return listed;
        },
        async production() {
          expect(await getProductionWorkItemDetail(user, "relation_ProductionWorkItem_B", transaction as never)).toBeNull();
          return listProductionTemplateConfig(user, transaction as never);
        },
        async finance() {
          expect(await getOrderFinanceSummary(user, id("order", "B"), transaction as never)).toBeNull();
          return getOrderFinanceSummary(user, id("order", "A"), transaction as never);
        },
        async shared() {
          const listed = await listSharedRecords(orgA, { q: marker }, transaction as never);
          expect(await getSharedRecord(orgA, id("shared", "B"), transaction as never)).toBeNull();
          return listed;
        },
        async workflow() {
          return listWorkflowEventsForEntity(orgA, id("lead", "B"), transaction as never);
        },
        async reports() {
          return getReportsOverview(user, transaction as never, {}, new Date("2026-08-09T12:00:00.000Z"), []);
        }
      };

      await operations.reports();
      for (const [model, operation] of Object.entries(publicModelBindings)) {
        for (const category of tenantIsolationCategories) {
          const result = await operations[operation]();
          expect(JSON.stringify(result), `${model}:${category} public operation leaked tenant B`).not.toContain("_B");
          executedCells.push(`${model}:${category}`);
        }
        executedModels.push(model);
      }
    }, tenant);

    expect(executedModels).toHaveLength(38);
    expect(new Set(executedModels)).toEqual(new Set(Object.keys(publicModelBindings)));
    expect(executedCells).toHaveLength(38 * tenantIsolationCategories.length);
    expect(new Set(executedCells).size).toBe(executedCells.length);
  });
});
