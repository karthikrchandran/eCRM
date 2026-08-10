import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTenantDatabaseMatrixAdapters, type TenantDomainProbe } from "./tenant-adversarial-database";
import { executeTenantIsolationMatrix, tenantIsolationCategories, tenantIsolationDomains } from "./tenant-adversarial-matrix";
import { withOrganization } from "./with-organization";
import { ingestWorkflowEvent } from "@/server/workflow-events/service";
import {
  tenantPublicOperationMatrix,
  type TenantPublicOperationContext,
  type TenantPublicOperationOutcome,
  type TenantPublicOperationScenario
} from "./tenant-public-operation-matrix";
import { tenantOpaqueOwnedRelationships, tenantOwnedRelationships, tenantUserRelationships } from "./tenant-relationships";

const controlUrl = process.env.TEST_DATABASE_URL;
const tenantUrlValue = process.env.TEST_TENANT_DATABASE_URL;
const integration = describe.runIf(Boolean(controlUrl && tenantUrlValue));

const orgA = "matrix_org_A";
const orgB = "matrix_org_B";
const userA = "matrix_user_A";
const userA2 = "matrix_user_A2";
const userB = "matrix_user_B";
const marker = "Tenant matrix collision";
const id = (entity: string, tenant: "A" | "B") => `matrix_${entity}_${tenant}`;

const excludedTenantModels = new Set(["OrganizationMembership", "OrganizationSettings", "OrganizationBranding"]);
const tenantModels = Prisma.dmmf.datamodel.models.filter((model) =>
  model.fields.some((field) => field.name === "organizationId") && !excludedTenantModels.has(model.name)
);
const tenantModelNames = new Set(tenantModels.map((model) => model.name));
const allOwnedRelationships = [...tenantOwnedRelationships, ...tenantOpaqueOwnedRelationships];
const manuallyCreatedModels = new Set([
  "LeadCustomer", "Branch", "SalesTask", "SalesTextNote", "PipelineStage", "Opportunity", "ProductService",
  "Proposal", "ProposalLineItem", "Order", "Invoice", "Payment", "PaymentAllocation", "ProductionTemplate",
  "ProductionTemplateStage", "SharedBusinessRecord", "SharedBusinessRecordVersion", "WorkflowEvent"
]);

function quoted(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function tenantInsertionOrder() {
  const pending = new Set(tenantModelNames);
  const complete = new Set<string>();
  const result: typeof tenantModels = [];
  while (pending.size > 0) {
    const ready = tenantModels.filter((model) => pending.has(model.name) && allOwnedRelationships
      .filter((relation) => relation.child === model.name && relation.parent !== model.name)
      .every((relation) => complete.has(relation.parent)));
    if (ready.length === 0) throw new Error(`Tenant fixture relationship cycle: ${[...pending].join(", ")}`);
    for (const model of ready) {
      result.push(model);
      pending.delete(model.name);
      complete.add(model.name);
    }
  }
  return result;
}

const tenantModelOrder = tenantInsertionOrder();

function completeFixtureId(modelName: string, suffix: "A" | "B") {
  const existing: Record<string, string> = {
    LeadCustomer: id("lead", suffix), Branch: id("branch", suffix), SalesTask: id("task", suffix),
    SalesTextNote: id("text", suffix), PipelineStage: id("stage", suffix), Opportunity: id("opportunity", suffix),
    ProductService: id("product", suffix), Proposal: id("proposal", suffix), ProposalLineItem: id("proposal_line", suffix),
    Order: id("order", suffix), Invoice: id("invoice", suffix), Payment: id("payment", suffix),
    PaymentAllocation: id("allocation", suffix), ProductionTemplate: id("template", suffix),
    ProductionTemplateStage: id("template_stage", suffix), SharedBusinessRecord: id("shared", suffix),
    SharedBusinessRecordVersion: id("shared_version", suffix), WorkflowEvent: id("workflow", suffix)
  };
  return existing[modelName] ?? id(modelName, suffix);
}

function fixtureScalar(modelName: string, fieldName: string, fieldType: string, suffix: "A" | "B") {
  switch (fieldType) {
    case "String": return `same_${modelName}_${fieldName}`;
    case "Int": return 1;
    case "BigInt": return BigInt(1);
    case "Float":
    case "Decimal": return 1;
    case "Boolean": return true;
    case "DateTime": return new Date("2026-08-09T00:00:00.000Z");
    case "Json": return JSON.stringify({ shape: "same" });
    case "Bytes": return Buffer.from(`same-${suffix}`);
    default: {
      const enumType = Prisma.dmmf.datamodel.enums.find((item) => item.name === fieldType);
      if (enumType?.values[0]) return enumType.values[0].name;
      throw new Error(`No complete fixture value for ${modelName}.${fieldName}: ${fieldType}`);
    }
  }
}

const probes = {
  crm: { table: "LeadCustomer", labelColumn: "name", rowA: id("lead", "A"), rowB: id("lead", "B"), parentTable: "LeadCustomer", nestedTable: "Branch", nestedForeignKey: "leadCustomerId" },
  "sales-day": { table: "SalesTask", labelColumn: "title", rowA: id("task", "A"), rowB: id("task", "B"), parentTable: "SalesTask", nestedTable: "SalesTextNote", nestedForeignKey: "taskId" },
  "pipeline-opportunities": { table: "Opportunity", labelColumn: "title", rowA: id("opportunity", "A"), rowB: id("opportunity", "B"), parentTable: "Opportunity", nestedTable: "Proposal", nestedForeignKey: "opportunityId" },
  "products-proposals": { table: "ProductService", labelColumn: "name", rowA: id("product", "A"), rowB: id("product", "B"), parentTable: "ProductService", nestedTable: "ProposalLineItem", nestedForeignKey: "productServiceId", createOverrides: { code: "MATRIX-CREATE" }, businessIdentifier: { code: "MATRIX-CODE" } },
  "orders-production": { table: "ProductionTemplate", labelColumn: "name", rowA: id("template", "A"), rowB: id("template", "B"), parentTable: "ProductionTemplate", nestedTable: "ProductionTemplateStage", nestedForeignKey: "templateId", createOverrides: { key: "MATRIX-CREATE" }, businessIdentifier: { key: "MATRIX-TEMPLATE" } },
  "finance-incentives": { table: "Invoice", labelColumn: "invoiceNumber", rowA: id("invoice", "A"), rowB: id("invoice", "B"), parentTable: "Invoice", nestedTable: "PaymentAllocation", nestedForeignKey: "invoiceId", createOverrides: { invoiceNumber: "MATRIX-CREATE" }, businessIdentifier: { invoiceNumber: marker } },
  reports: { table: "Opportunity", labelColumn: "title", rowA: id("opportunity", "A"), rowB: id("opportunity", "B"), parentTable: "Opportunity", nestedTable: "Proposal", nestedForeignKey: "opportunityId" },
  "shared-export": { table: "SharedBusinessRecord", labelColumn: "displayName", rowA: id("shared", "A"), rowB: id("shared", "B"), parentTable: "SharedBusinessRecord", nestedTable: "SharedBusinessRecordVersion", nestedForeignKey: "recordId", createOverrides: { externalKey: "matrix-create" }, businessIdentifier: { entityType: "CUSTOMER", externalKey: "matrix-shared" } },
  workflow: { table: "WorkflowEvent", labelColumn: "summary", rowA: id("workflow", "A"), rowB: id("workflow", "B"), parentTable: "WorkflowEvent", createOverrides: { sourceEventId: "matrix-create" }, businessIdentifier: { sourceApp: "matrix", sourceEventId: "matrix-event" } }
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
  const tenant = new PrismaClient({
    datasourceUrl: tenantUrl.toString(),
    transactionOptions: { maxWait: 5_000, timeout: 30_000 }
  });

  async function cleanFixtures() {
    const organizations = [orgA, orgB];
    for (const model of [...tenantModelOrder].reverse()) {
      await control.$executeRawUnsafe(
        `DELETE FROM ${quoted(model.dbName ?? model.name)} WHERE "organizationId" = ANY($1::text[])`,
        organizations
      );
    }
    await control.organizationMembership.deleteMany({ where: { organizationId: { in: organizations } } });
    await control.user.deleteMany({ where: { id: { in: [userA, userA2, userB] } } });
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
      { id: userA2, name: "Matrix A2", email: "matrix-a2@example.test", passwordHash: "test", role: "SALES" },
      { id: userB, name: "Matrix B", email: "matrix-b@example.test", passwordHash: "test", role: "ADMIN" }
    ] });
    await control.organizationMembership.createMany({ data: [
      { id: id("membership", "A"), organizationId: orgA, userId: userA, role: "ADMIN", status: "ACTIVE" },
      { id: "matrix_membership_A2", organizationId: orgA, userId: userA2, role: "SALES", status: "ACTIVE" },
      { id: id("membership", "B"), organizationId: orgB, userId: userB, role: "ADMIN", status: "ACTIVE" },
      { id: "matrix_membership_shared_user_B", organizationId: orgB, userId: userA, role: "ADMIN", status: "ACTIVE" }
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

        for (const model of tenantModelOrder.filter((candidate) => !manuallyCreatedModels.has(candidate.name))) {
          const table = model.dbName ?? model.name;
          const modelId = completeFixtureId(model.name, tenantName);
          const values = new Map<string, { type: string; value: unknown }>();
          for (const field of model.fields.filter((item) => item.kind !== "object")) {
            if (field.name === "organizationId") {
              values.set(field.dbName ?? field.name, { type: field.type, value: organizationId });
              continue;
            }
            if (field.name === "id") {
              values.set(field.dbName ?? field.name, { type: field.type, value: modelId });
              continue;
            }
            const ownedRelation = allOwnedRelationships.find((relation) =>
              relation.child === model.name && relation.childField === field.name
            );
            if (ownedRelation) {
              values.set(field.dbName ?? field.name, {
                type: field.type,
                value: completeFixtureId(ownedRelation.parent, tenantName)
              });
              continue;
            }
            if (tenantUserRelationships.some((relation) => relation.child === model.name && relation.childField === field.name)) {
              values.set(field.dbName ?? field.name, { type: field.type, value: ownerId });
              continue;
            }
            if (!field.isRequired || field.hasDefaultValue) continue;
            values.set(field.dbName ?? field.name, {
              type: field.type,
              value: fixtureScalar(model.name, field.name, field.type, tenantName)
            });
          }
          const columns = [...values.keys()];
          const entries = [...values.values()];
          const placeholders = entries.map((entry, index) => {
            const enumType = Prisma.dmmf.datamodel.enums.find((item) => item.name === entry.type);
            const cast = entry.type === "Json" ? "::jsonb" : enumType ? `::${quoted(enumType.dbName ?? enumType.name)}` : "";
            return `$${index + 1}${cast}`;
          });
          await transaction.$executeRawUnsafe(
            `INSERT INTO ${quoted(table)} (${columns.map(quoted).join(", ")}) VALUES (${placeholders.join(", ")})`,
            ...entries.map((entry) => entry.value)
          );
        }

        for (const relation of allOwnedRelationships) {
          const childHasId = tenantModels.find((model) => model.name === relation.child)?.fields.some((field) => field.name === "id");
          await transaction.$executeRawUnsafe(
            `UPDATE ${quoted(relation.child)} SET ${quoted(relation.childField)} = $1 WHERE ${childHasId ? '"id" = $2 AND ' : ""}"organizationId" = $${childHasId ? 3 : 2}`,
            completeFixtureId(relation.parent, tenantName),
            ...(childHasId ? [completeFixtureId(relation.child, tenantName), organizationId] : [organizationId])
          );
        }
        for (const relation of tenantUserRelationships) {
          const childHasId = tenantModels.find((model) => model.name === relation.child)?.fields.some((field) => field.name === "id");
          await transaction.$executeRawUnsafe(
            `UPDATE ${quoted(relation.child)} SET ${quoted(relation.childField)} = $1 WHERE ${childHasId ? '"id" = $2 AND ' : ""}"organizationId" = $${childHasId ? 3 : 2}`,
            ownerId,
            ...(childHasId ? [completeFixtureId(relation.child, tenantName), organizationId] : [organizationId])
          );
        }

        if (tenantName === "B") {
          const duplicateProposalId = "matrix_duplicate_proposal_B";
          await transaction.sharedBusinessRecord.create({ data: {
            id: "matrix_duplicate_shared_B", organizationId, entityType: "CUSTOMER", displayName: marker,
            status: "ACTIVE", sourceApp: "matrix", externalKey: "MATRIX-PUBLIC-DUP", searchText: marker, data: {}
          } });
          await transaction.workflowEvent.create({ data: {
            id: "matrix_duplicate_workflow_B", organizationId, sourceApp: "matrix", sourceEventId: "MATRIX-PUBLIC-DUP",
            sourceEventType: "matrix.test", entityType: "EXTERNAL", summary: marker, payload: {}
          } });
          await transaction.pipelineStage.create({ data: {
            id: "matrix_duplicate_stage_B", organizationId, name: "MATRIX-PUBLIC-DUP", sortOrder: 90, kind: "OPEN"
          } });
          await transaction.salesTarget.create({ data: {
            organizationId, ownerId: userA, financialYear: 2026, quarter: 4, targetValueInr: 1, createdById: userA
          } });
          await transaction.productService.create({ data: {
            id: "matrix_duplicate_product_B", organizationId, name: marker, code: "MATRIX-PUBLIC-DUP",
            category: "Matrix", createdById: ownerId, updatedById: ownerId
          } });
          await transaction.proposal.create({ data: {
            id: duplicateProposalId, organizationId, opportunityId: id("opportunity", "B"), title: marker,
            sequenceNumber: 2, status: "ACCEPTED", createdById: ownerId, updatedById: ownerId
          } });
          await transaction.order.create({ data: {
            id: "matrix_duplicate_order_B", organizationId, orderNumber: "ORD-2026-0002", proposalId: duplicateProposalId,
            opportunityId: id("opportunity", "B"), leadCustomerId: id("lead", "B"), ownerId,
            subtotalPaisa: 0, gstPaisa: 0, totalPaisa: 0, createdById: ownerId, updatedById: ownerId
          } });
          await transaction.productionTemplate.create({ data: {
            id: "matrix_duplicate_template_B", organizationId, key: "MATRIX-PUBLIC-DUP", name: marker
          } });
          await transaction.productionTemplateStage.create({ data: {
            id: "matrix_duplicate_template_stage_B", organizationId, templateId: id("template", "B"),
            key: "MATRIX-PUBLIC-DUP", name: marker
          } });
          await transaction.invoice.create({ data: {
            id: "matrix_duplicate_invoice_B", organizationId, orderId: id("order", "B"),
            invoiceNumber: "MATRIX-PUBLIC-DUP", invoiceDate: new Date("2026-08-09T00:00:00.000Z"),
            subtotalPaisa: 0, gstPaisa: 0, totalPaisa: 0, createdById: ownerId, updatedById: ownerId
          } });
          const duplicateReview = await transaction.salesDayReview.create({ data: {
            organizationId, ownerId: userA, reviewDate: new Date("2026-08-09T00:00:00.000Z")
          } });
          await transaction.salesDayReviewItem.create({ data: {
            organizationId, reviewId: duplicateReview.id, taskId: id("task", "B"), status: "DONE"
          } });
        }
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

  it("executes every explicit model/category scenario through its real exported operation over complete A/B fixtures", async () => {
    const user = { id: userA, organizationId: orgA, role: "ADMIN" as const, name: "Matrix A", email: "matrix-a@example.test" };
    const now = new Date("2026-08-09T12:00:00.000Z");
    const executedCells: string[] = [];
    const executedExports = new Set<string>();
    const readExports = new Set([
      "listLeadCustomers", "listContacts", "getContactDetail", "getLeadCustomerDetail", "getCustomer360Timeline",
      "listBranchOptions", "getDashboardFollowUpCounts", "loadMyDay", "loadMyDayInsights", "listOpportunities",
      "listPipelineBoard", "getOpportunityDetail", "listSalesTargets", "listActiveProductServices",
      "listProductServicesForAdmin", "getProductServiceForAdmin", "listProposalsForOpportunity", "getProposalDetail",
      "listOrders", "getOrderDetail", "listProductionBoard", "listProductionWorkItems", "getProductionWorkItemDetail",
      "listProductionTemplateConfig", "getOrderFinanceSummary", "getReportsOverview", "listRepPerformanceSummaries",
      "listSharedRecords", "getSharedRecord", "buildSharedRecordExportPage", "listWorkflowEventsForEntity"
    ]);
    const callOperation = (scenario: TenantPublicOperationScenario, ...args: unknown[]) =>
      (scenario.operation as unknown as (...operationArgs: unknown[]) => Promise<unknown>)(...args);

    await withOrganization(orgA, async (transaction) => {
      const exportDatabase = {
        async deleteExpiredExportSnapshots(before: Date) {
          await transaction.sharedRecordExportSnapshot.deleteMany({ where: { organizationId: orgA, expiresAt: { lt: before } } });
        },
        async getExportSnapshot(snapshotId: string) {
          return transaction.sharedRecordExportSnapshot.findFirst({
            where: { id: snapshotId, organizationId: orgA },
            select: { id: true, entityType: true, itemCount: true }
          });
        },
        async getExportSnapshotItems(snapshotId: string, offset: number, limit: number) {
          const rows = await transaction.sharedRecordExportSnapshotItem.findMany({
            where: { organizationId: orgA, snapshotId, position: { gte: offset, lt: offset + limit } },
            orderBy: { position: "asc" }, select: { payload: true }
          });
          return rows.map((row) => row.payload);
        },
        async withSnapshotMaterialization(callback: (database: unknown) => Promise<unknown>) {
          return callback({
            sharedBusinessRecord: { findMany: (args: unknown) => transaction.sharedBusinessRecord.findMany(args as never) },
            createExportSnapshot: async ({ entityType, expiresAt }: { entityType?: string; expiresAt: Date }) =>
              transaction.sharedRecordExportSnapshot.create({
                data: { organizationId: orgA, entityType: entityType as never, expiresAt },
                select: { id: true, entityType: true }
              }),
            appendExportSnapshotItems: async (snapshotId: string, startPosition: number, items: unknown[]) => {
              if (items.length > 0) await transaction.sharedRecordExportSnapshotItem.createMany({
                data: items.map((payload, index) => ({
                  organizationId: orgA, snapshotId, position: startPosition + index, payload: payload as never
                }))
              });
            },
            finalizeExportSnapshot: async (snapshotId: string, itemCount: number) =>
              transaction.sharedRecordExportSnapshot.update({
                where: { id: snapshotId }, data: { itemCount }, select: { id: true, entityType: true, itemCount: true }
              }),
            deleteExpiredExportSnapshots: async (before: Date) =>
              transaction.sharedRecordExportSnapshot.deleteMany({ where: { organizationId: orgA, expiresAt: { lt: before } } })
          });
        }
      };

      let savepointIndex = 0;
      const runScenario = async (scenario: TenantPublicOperationScenario, suffix: "A" | "B") => {
        const savepoint = `public_operation_${savepointIndex++}`;
        await transaction.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
        let result: unknown;
        let rejected = false;
        let rejection: unknown;
        let executorMissing = false;
        const targetUser = suffix === "A" ? userA : userB;
        const leadTarget = completeFixtureId("LeadCustomer", suffix);
        const branchTarget = completeFixtureId("Branch", suffix);
        const contactTarget = completeFixtureId("Contact", suffix);
        const activityTarget = completeFixtureId("Activity", suffix);
        const taskTarget = completeFixtureId("SalesTask", suffix);
        const noteTarget = completeFixtureId("SalesTextNote", suffix);
        const voiceTarget = completeFixtureId("SalesVoiceNote", suffix);
        const actionTarget = completeFixtureId("SalesVoiceNoteAction", suffix);
        const stageTarget = completeFixtureId("PipelineStage", suffix);
        const opportunityTarget = completeFixtureId("Opportunity", suffix);
        const productTarget = completeFixtureId("ProductService", suffix);
        let proposalTarget = completeFixtureId("Proposal", suffix);
        const orderTarget = completeFixtureId("Order", suffix);
        let orderLineTarget = completeFixtureId("OrderLineItem", suffix);
        const templateTarget = completeFixtureId("ProductionTemplate", suffix);
        const workItemTarget = completeFixtureId("ProductionWorkItem", suffix);
        const stageInstanceTarget = completeFixtureId("ProductionStageInstance", suffix);
        const invoiceTarget = completeFixtureId("Invoice", suffix);
        const costTarget = completeFixtureId("CostComponent", suffix);
        const incentiveTarget = completeFixtureId("Incentive", suffix);

        if (suffix === "A" && scenario.exportName === "createOrderFromAcceptedProposal") {
          proposalTarget = `matrix_public_order_proposal_${scenario.model}_${scenario.category}`;
          await transaction.proposal.create({ data: {
            id: proposalTarget,
            organizationId: orgA,
            opportunityId: completeFixtureId("Opportunity", "A"),
            title: `Accepted ${scenario.model}`,
            sequenceNumber: 1000 + savepointIndex,
            status: "ACCEPTED",
            createdById: userA,
            updatedById: userA,
            lineItems: { create: [{
              organizationId: orgA,
              productServiceId: completeFixtureId("ProductService", "A"),
              productNameSnapshot: marker,
              productCategorySnapshot: "Matrix",
              quantity: 1,
              unitPricePaisa: 0,
              gstRateBps: 0,
              lineSubtotalPaisa: 0,
              lineGstPaisa: 0,
              lineTotalPaisa: 0
            }] }
          } });
        }

        if (suffix === "A" && scenario.exportName === "instantiateProductionForOrderLineItem") {
          orderLineTarget = `matrix_public_order_line_${scenario.model}_${scenario.category}`;
          const proposalLineTarget = `matrix_public_proposal_line_${scenario.model}_${scenario.category}`;
          await transaction.proposalLineItem.create({ data: {
            id: proposalLineTarget,
            organizationId: orgA,
            proposalId: completeFixtureId("Proposal", "A"),
            productServiceId: completeFixtureId("ProductService", "A"),
            productNameSnapshot: marker,
            productCategorySnapshot: "Matrix",
            quantity: 1,
            unitPricePaisa: 0,
            gstRateBps: 0,
            lineSubtotalPaisa: 0,
            lineGstPaisa: 0,
            lineTotalPaisa: 0
          } });
          await transaction.orderLineItem.create({ data: {
            id: orderLineTarget,
            organizationId: orgA,
            orderId: completeFixtureId("Order", "A"),
            proposalLineItemId: proposalLineTarget,
            productServiceId: completeFixtureId("ProductService", "A"),
            productNameSnapshot: marker,
            productCategorySnapshot: "Matrix",
            quantity: 1,
            unitPricePaisa: 0,
            gstRateBps: 0,
            lineSubtotalPaisa: 0,
            lineGstPaisa: 0,
            lineTotalPaisa: 0
          } });
        }

        try {
          switch (scenario.exportName) {
            case "listLeadCustomers": result = await callOperation(scenario, user, scenario.category === "search" ? { q: marker } : {}, transaction, []); break;
            case "listContacts": result = await callOperation(scenario, user, scenario.category === "search" ? { q: marker } : {}, transaction, []); break;
            case "getContactDetail": result = await callOperation(scenario, user, contactTarget, transaction); break;
            case "getLeadCustomerDetail": result = await callOperation(scenario, user, leadTarget, transaction); break;
            case "getCustomer360Timeline": result = await callOperation(scenario, user, leadTarget, transaction); break;
            case "listBranchOptions": result = await callOperation(scenario, user, leadTarget, transaction); break;
            case "getDashboardFollowUpCounts": result = await callOperation(scenario, user, transaction); break;
            case "loadMyDay": result = await callOperation(scenario, user, now, transaction); break;
            case "loadMyDayInsights": result = await callOperation(scenario, user, now, transaction); break;
            case "listOpportunities": result = await callOperation(scenario, user, scenario.category === "search" ? { q: marker } : {}, transaction); break;
            case "listPipelineBoard": result = await callOperation(scenario, user, {}, transaction); break;
            case "getOpportunityDetail": result = await callOperation(scenario, user, opportunityTarget, transaction); break;
            case "listSalesTargets": result = await callOperation(scenario, user, transaction); break;
            case "listActiveProductServices":
            case "listProductServicesForAdmin": result = await callOperation(scenario, user, transaction); break;
            case "getProductServiceForAdmin": result = await callOperation(scenario, user, productTarget, transaction); break;
            case "listProposalsForOpportunity": result = await callOperation(scenario, user, opportunityTarget, transaction); break;
            case "getProposalDetail": result = await callOperation(scenario, user, proposalTarget, transaction); break;
            case "listOrders": result = await callOperation(scenario, user, {}, transaction); break;
            case "getOrderDetail": result = await callOperation(scenario, user, orderTarget, transaction); break;
            case "listProductionBoard":
            case "listProductionWorkItems": result = await callOperation(scenario, user, {}, transaction); break;
            case "getProductionWorkItemDetail": result = await callOperation(scenario, user, workItemTarget, transaction); break;
            case "listProductionTemplateConfig": result = await callOperation(scenario, user, transaction); break;
            case "getOrderFinanceSummary": result = await callOperation(scenario, user, orderTarget, transaction); break;
            case "getReportsOverview": result = await callOperation(scenario, user, transaction, {}, now, []); break;
            case "listRepPerformanceSummaries": result = await callOperation(scenario, user, {}, transaction, []); break;
            case "listSharedRecords": result = await callOperation(scenario, orgA, { q: marker }, transaction); break;
            case "getSharedRecord": result = await callOperation(scenario, orgA, completeFixtureId("SharedBusinessRecord", suffix), transaction); break;
            case "buildSharedRecordExportPage": result = await callOperation(scenario, orgA, { limit: 10 }, exportDatabase); break;
            case "listWorkflowEventsForEntity": result = await callOperation(scenario, orgA, leadTarget, transaction); break;

            case "createLeadCustomer": result = await callOperation(scenario, user, { name: `Created ${scenario.model}`, state: "LEAD", ownerId: targetUser }, transaction); break;
            case "updateLeadCustomer": result = await callOperation(scenario, user, leadTarget, { name: `Updated ${scenario.model}`, state: "LEAD", ownerId: userA }, transaction); break;
            case "createBranch": result = await callOperation(scenario, user, { leadCustomerId: leadTarget, name: `Created ${scenario.model}`, country: "US" }, transaction); break;
            case "createContact": result = await callOperation(scenario, user, { leadCustomerId: leadTarget, branchId: branchTarget, name: `Created ${scenario.model}`, isPrimary: false }, transaction); break;
            case "createActivity": result = await callOperation(scenario, user, { leadCustomerId: leadTarget, contactId: contactTarget, ownerId: targetUser, type: "FOLLOW_UP", status: "OPEN", subject: `Created ${scenario.model}` }, transaction); break;
            case "completeActivity": result = await callOperation(scenario, user, activityTarget, transaction); break;
            case "reassignLeadOwner": result = await callOperation(scenario, user, { leadCustomerId: leadTarget, toOwnerId: suffix === "A" ? userA2 : targetUser, reason: marker }, transaction); break;
            case "createSalesTask": result = await callOperation(scenario, user, { title: `Created ${scenario.model}`, type: "CALL", priority: "MEDIUM", leadCustomerId: leadTarget }, transaction); break;
            case "updateSalesTask": result = await callOperation(scenario, user, taskTarget, { title: `Updated ${scenario.model}` }, transaction); break;
            case "completeSalesTask":
            case "cancelSalesTask": result = await callOperation(scenario, user, taskTarget, transaction); break;
            case "createSalesTextNote": result = await callOperation(scenario, user, { body: `Created ${scenario.model}`, taskId: taskTarget }, transaction); break;
            case "updateSalesTextNote": result = await callOperation(scenario, user, noteTarget, { body: `Updated ${scenario.model}` }, transaction); break;
            case "deleteSalesTextNote": result = await callOperation(scenario, user, noteTarget, transaction); break;
            case "createSalesVoiceNote": result = await callOperation(scenario, user, { audioStorageKey: `matrix/${scenario.model}/${scenario.category}/${suffix}`, fileSizeBytes: 1, mimeType: "audio/webm", originalFileName: "matrix.webm", taskId: taskTarget }, transaction); break;
            case "markVoiceNoteTranscribing": result = await callOperation(scenario, user, voiceTarget, transaction); break;
            case "saveVoiceNoteTranscript": result = await callOperation(scenario, user, voiceTarget, { transcript: marker }, transaction); break;
            case "markVoiceNoteFailed": result = await callOperation(scenario, user, voiceTarget, marker, transaction); break;
            case "createSuggestedActionsForVoiceNote": result = await callOperation(scenario, user, voiceTarget, [{ title: marker, type: "FOLLOW_UP" }], transaction); break;
            case "acceptSuggestedAction":
            case "rejectSuggestedAction": result = await callOperation(scenario, user, actionTarget, transaction); break;
            case "saveEndOfDayReview": result = await callOperation(scenario, user, { reviewDate: now, items: [{ taskId: taskTarget, status: "DONE" }] }, transaction); break;
            case "createOpportunity": result = await callOperation(scenario, user, { leadCustomerId: leadTarget, branchId: branchTarget, stageId: stageTarget, ownerId: targetUser, title: `Created ${scenario.model}` }, [], transaction); break;
            case "updateOpportunity": result = await callOperation(scenario, user, opportunityTarget, { leadCustomerId: leadTarget, branchId: branchTarget, stageId: stageTarget, ownerId: targetUser, title: `Updated ${scenario.model}` }, [], transaction); break;
            case "moveOpportunityStage": result = await callOperation(scenario, user, opportunityTarget, stageTarget, transaction); break;
            case "upsertPipelineStage": result = await callOperation(scenario, user, { name: scenario.category === "duplicate-identifier" ? "MATRIX-PUBLIC-DUP" : suffix === "B" && scenario.category === "update" ? "Matrix Stage B" : `Matrix isolated ${scenario.category}`, sortOrder: 99, kind: "OPEN", active: true }, transaction); break;
            case "upsertSalesTarget": result = await callOperation(scenario, user, { ownerId: targetUser, financialYear: 2026, quarter: 4, targetValueInr: "1.00" }, transaction); break;
            case "createProductService": result = await callOperation(scenario, user, { name: marker, code: scenario.category === "duplicate-identifier" ? "MATRIX-PUBLIC-DUP" : `MATRIX-CREATE-${scenario.model}`, category: "Matrix", defaultGstRateBps: 0, active: true, sortOrder: 1 }, transaction); break;
            case "updateProductService": result = await callOperation(scenario, user, productTarget, { name: `Updated ${scenario.model}`, code: "MATRIX-CODE", category: "Matrix", defaultGstRateBps: 0, active: true, sortOrder: 1 }, transaction); break;
            case "setProductServiceActive": result = await callOperation(scenario, user, productTarget, false, transaction); break;
            case "createProposal": result = await callOperation(scenario, user, { opportunityId: opportunityTarget, title: `Created ${scenario.model}` }, [{ productServiceId: productTarget, quantity: 1, unitPricePaisa: 1, gstRateBps: 0, manualTaxPaisa: 0, gstOverrideReason: "Matrix zero tax" }], transaction); break;
            case "addProposalPdfMetadata": result = await callOperation(scenario, user, proposalTarget, { originalFileName: "matrix.pdf", storedFileName: "matrix.pdf", storageProvider: "local", storageKey: `matrix/${scenario.model}/${scenario.category}/${suffix}.pdf`, mimeType: "application/pdf", fileSizeBytes: 1 }, transaction); break;
            case "changeProposalStatus": result = await callOperation(scenario, user, proposalTarget, "DRAFT", transaction); break;
            case "createOrderFromAcceptedProposal": result = await callOperation(scenario, user, { proposalId: proposalTarget }, transaction); break;
            case "updateOrderPoMetadata": result = await callOperation(scenario, user, orderTarget, { poNumber: `Updated ${scenario.model}` }, transaction); break;
            case "changeOrderStatus": result = await callOperation(scenario, user, orderTarget, "IN_PRODUCTION", transaction); break;
            case "instantiateProductionForOrderLineItem": result = await callOperation(scenario, user, orderLineTarget, transaction); break;
            case "updateProductionStageStatus": result = await callOperation(scenario, user, stageInstanceTarget, { status: "IN_PROGRESS", assignedToId: targetUser, noteBody: marker }, transaction); break;
            case "saveProductionTemplate": result = await callOperation(scenario, user, { ...(scenario.category === "create" || scenario.category === "duplicate-identifier" ? {} : { id: templateTarget }), key: scenario.category === "duplicate-identifier" ? "MATRIX-PUBLIC-DUP" : scenario.category === "create" ? `MATRIX-CREATE-${scenario.model}` : "MATRIX-TEMPLATE", name: `Updated ${scenario.model}`, active: true, sortOrder: 1 }, transaction); break;
            case "saveProductionTemplateStage": result = await callOperation(scenario, user, { templateId: templateTarget, key: scenario.category === "duplicate-identifier" ? "MATRIX-PUBLIC-DUP" : scenario.category === "create" ? `MATRIX-CREATE-${scenario.model}` : "matrix", name: `Updated ${scenario.model}`, required: true, sortOrder: 1 }, transaction); break;
            case "createInvoice": result = await callOperation(scenario, user, { orderId: orderTarget, invoiceNumber: scenario.category === "duplicate-identifier" ? "MATRIX-PUBLIC-DUP" : `MATRIX-CREATE-${scenario.model}`, invoiceDate: now, subtotalPaisa: 0, gstPaisa: 0 }, transaction); break;
            case "updateInvoice": result = await callOperation(scenario, user, invoiceTarget, { orderId: orderTarget, invoiceNumber: marker, invoiceDate: now, subtotalPaisa: 1, gstPaisa: 0 }, transaction); break;
            case "recordPayment": result = await callOperation(scenario, user, { orderId: orderTarget, paymentDate: now, amountPaisa: 1, mode: "BANK_TRANSFER", allocations: [{ invoiceId: invoiceTarget, amountPaisa: 1 }] }, transaction); break;
            case "createCostComponent": result = await callOperation(scenario, user, { orderId: orderTarget, orderLineItemId: orderLineTarget, category: "Matrix", description: marker, amountPaisa: 1 }, transaction); break;
            case "changeCostComponentStatus": result = await callOperation(scenario, user, costTarget, { status: "APPROVED" }, transaction); break;
            case "approveIncentive": result = await callOperation(scenario, user, incentiveTarget, {}, transaction); break;
            case "rejectIncentive": result = await callOperation(scenario, user, incentiveTarget, marker, transaction); break;
            case "markIncentivePaid": result = await callOperation(scenario, user, incentiveTarget, marker, transaction); break;
            case "updateIncentiveSplits": result = await callOperation(scenario, user, incentiveTarget, scenario.category === "delete" ? [] : suffix === "A" ? [{ percent: 100, userId: userA }] : [{ percent: 100, userId: userB }], transaction); break;
            case "upsertSharedRecord": result = await callOperation(scenario, orgA, { entityType: "CUSTOMER", displayName: `Public ${scenario.model}`, status: "ACTIVE", sourceApp: "ecrm", externalKey: scenario.category === "duplicate-identifier" ? "MATRIX-PUBLIC-DUP" : scenario.category === "update" ? "matrix-shared" : `public-${scenario.model}-${scenario.category}`, ...(scenario.category === "foreign-attachment" ? { parentId: completeFixtureId("SharedBusinessRecord", "B") } : {}) }, transaction); break;
            case "ingestWorkflowEvent": result = await callOperation(scenario, orgA, { sourceApp: "matrix", sourceEventId: scenario.category === "duplicate-identifier" ? "MATRIX-PUBLIC-DUP" : `public-${scenario.model}-${scenario.category}`, sourceEventType: "sync", entityType: "EXTERNAL", ...(scenario.category === "foreign-attachment" ? { relatedRecordType: "LEAD", relatedRecordId: completeFixtureId("LeadCustomer", "B") } : {}), summary: marker }, transaction); break;
            default:
              executorMissing = true;
              throw new Error(`No real-operation executor for ${scenario.exportName}`);
          }
        } catch (error) {
          rejected = true;
          rejection = error;
        } finally {
          await transaction.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        }

        const rendered = JSON.stringify(result, (_key, value) => typeof value === "bigint" ? value.toString() : value);
        expect(executorMissing, `${scenario.model}:${scenario.category} has no real exported-operation executor`).toBe(false);
        return { rejected, rejection, rendered: rendered ?? "", result };
      };

      const assertNoTenantB = (scenario: TenantPublicOperationScenario, rendered: string) => {
        expect(rendered, `${scenario.model}:${scenario.category}:${scenario.exportName} leaked tenant B`).not.toContain("_B");
      };

      const assertEquivalent = async (scenario: TenantPublicOperationScenario): Promise<TenantPublicOperationOutcome> => {
        const equivalent = scenario.equivalentCategory;
        if (!equivalent) throw new Error(`${scenario.model}:${scenario.category} has no reviewed equivalent.`);
        const suffix = equivalent === "direct-id" || equivalent === "foreign-attachment" ? "B" : "A";
        const execution = await runScenario(scenario, suffix);
        assertNoTenantB(scenario, execution.rendered);
        if (suffix === "A") {
          expect(execution.rejected, `${scenario.model}:${scenario.category} N/A equivalent ${equivalent} failed`).toBe(false);
        } else if (!readExports.has(scenario.exportName)) {
          expect(execution.rejected, `${scenario.model}:${scenario.category} N/A equivalent did not deny B`).toBe(true);
        }
        return "na-equivalent";
      };

      const semanticHandler = (
        category: (typeof tenantIsolationCategories)[number]
      ) => async (scenario: TenantPublicOperationScenario): Promise<TenantPublicOperationOutcome> => {
        if (scenario.category !== category) {
          throw new Error(`Wrong semantic handler: ${scenario.model}:${scenario.category} was sent to ${category}.`);
        }
        if (scenario.disposition === "reviewed-na") return assertEquivalent(scenario);

        if (["list", "search", "aggregate", "nested-include"].includes(category)) {
          const execution = await runScenario(scenario, "A");
          expect(execution.rejected, `${scenario.model}:${category}:${scenario.exportName} failed its A read`).toBe(false);
          assertNoTenantB(scenario, execution.rendered);
          return "success";
        }

        if (category === "direct-id") {
          const execution = await runScenario(scenario, "B");
          assertNoTenantB(scenario, execution.rendered);
          if (readExports.has(scenario.exportName)) {
            expect(execution.rejected, `${scenario.model}:${scenario.exportName} errored instead of returning opaque absence`).toBe(false);
          } else {
            expect(execution.rejected, `${scenario.model}:${scenario.exportName} accepted a B target`).toBe(true);
          }
          return "denied";
        }

        if (category === "create") {
          const execution = await runScenario(scenario, "A");
          expect(execution.rejected, `${scenario.model}:${scenario.exportName} did not successfully create A data: ${String(execution.rejection)}`).toBe(false);
          assertNoTenantB(scenario, execution.rendered);
          return "success";
        }

        if (category === "update" || category === "delete") {
          const own = await runScenario(scenario, "A");
          expect(own.rejected, `${scenario.model}:${scenario.exportName} did not successfully ${category} A data: ${String(own.rejection)}`).toBe(false);
          assertNoTenantB(scenario, own.rendered);
          const protectedB = scenario.exportName === "upsertSharedRecord"
            ? await control.sharedBusinessRecord.findFirst({ where: { id: completeFixtureId("SharedBusinessRecord", "B") }, select: { displayName: true, updatedAt: true } })
            : scenario.exportName === "upsertPipelineStage"
              ? await control.pipelineStage.findFirst({ where: { id: completeFixtureId("PipelineStage", "B") }, select: { sortOrder: true, updatedAt: true } })
              : null;
          const foreign = await runScenario(scenario, "B");
          assertNoTenantB(scenario, foreign.rendered);
          if (scenario.exportName === "upsertSharedRecord" || scenario.exportName === "upsertPipelineStage") {
            expect(foreign.rejected, `${scenario.model}:${scenario.exportName} should safely resolve only inside A`).toBe(false);
            const protectedBAfter = scenario.exportName === "upsertSharedRecord"
              ? await control.sharedBusinessRecord.findFirst({ where: { id: completeFixtureId("SharedBusinessRecord", "B") }, select: { displayName: true, updatedAt: true } })
              : await control.pipelineStage.findFirst({ where: { id: completeFixtureId("PipelineStage", "B") }, select: { sortOrder: true, updatedAt: true } });
            expect(protectedBAfter, `${scenario.model}:${scenario.exportName} changed tenant B through a business key`).toEqual(protectedB);
          } else {
            expect(foreign.rejected, `${scenario.model}:${scenario.exportName} accepted a B ${category} target`).toBe(true);
          }
          return "success";
        }

        if (category === "foreign-attachment") {
          const execution = await runScenario(scenario, "B");
          expect(execution.rejected, `${scenario.model}:${scenario.exportName} accepted a B attachment`).toBe(true);
          return "denied";
        }

        const duplicateSeedExists = await (async () => {
          switch (scenario.model) {
            case "SharedBusinessRecord": return control.sharedBusinessRecord.findFirst({ where: { organizationId: orgB, externalKey: "MATRIX-PUBLIC-DUP" }, select: { id: true } });
            case "WorkflowEvent": return control.workflowEvent.findFirst({ where: { organizationId: orgB, sourceApp: "matrix", sourceEventId: "MATRIX-PUBLIC-DUP" }, select: { id: true } });
            case "SalesDayReview": return control.salesDayReview.findFirst({ where: { organizationId: orgB, ownerId: userA, reviewDate: new Date("2026-08-09T00:00:00.000Z") }, select: { id: true } });
            case "SalesDayReviewItem": return control.salesDayReviewItem.findFirst({ where: { organizationId: orgB, review: { ownerId: userA } }, select: { reviewId: true } });
            case "PipelineStage": return control.pipelineStage.findFirst({ where: { organizationId: orgB, name: "MATRIX-PUBLIC-DUP" }, select: { id: true } });
            case "SalesTarget": return control.salesTarget.findFirst({ where: { organizationId: orgB, ownerId: userA, financialYear: 2026, quarter: 4 }, select: { ownerId: true } });
            case "ProductService": return control.productService.findFirst({ where: { organizationId: orgB, code: "MATRIX-PUBLIC-DUP" }, select: { id: true } });
            case "Proposal": return control.proposal.findFirst({ where: { organizationId: orgB, opportunityId: completeFixtureId("Opportunity", "B"), sequenceNumber: 2 }, select: { id: true } });
            case "Order": return control.order.findFirst({ where: { organizationId: orgB, orderNumber: "ORD-2026-0002" }, select: { id: true } });
            case "ProductionTemplate": return control.productionTemplate.findFirst({ where: { organizationId: orgB, key: "MATRIX-PUBLIC-DUP" }, select: { id: true } });
            case "ProductionTemplateStage": return control.productionTemplateStage.findFirst({ where: { organizationId: orgB, templateId: completeFixtureId("ProductionTemplate", "B"), key: "MATRIX-PUBLIC-DUP" }, select: { id: true } });
            case "Invoice": return control.invoice.findFirst({ where: { organizationId: orgB, invoiceNumber: "MATRIX-PUBLIC-DUP" }, select: { id: true } });
            default: throw new Error(`Missing genuine business-key fixture for ${scenario.model}.`);
          }
        })();
        expect(duplicateSeedExists, `${scenario.model} lacks its tenant-B duplicate business key`).not.toBeNull();
        const execution = await runScenario(scenario, "A");
        expect(execution.rejected, `${scenario.model}:${scenario.exportName} rejected tenant-B's business key in A`).toBe(false);
        assertNoTenantB(scenario, execution.rendered);
        return "duplicate";
      };

      const handlers = Object.fromEntries(tenantIsolationCategories.map((category) => [
        category,
        semanticHandler(category)
      ])) as unknown as TenantPublicOperationContext;

      for (const modelMatrix of Object.values(tenantPublicOperationMatrix)) {
        for (const category of tenantIsolationCategories) {
          const execution = await modelMatrix[category].run(handlers);
          executedCells.push(`${execution.model}:${execution.category}:${execution.outcome}:${execution.exportName}`);
          executedExports.add(execution.exportName);
        }
      }

      const fixtureCounts = await Promise.all(tenantModels.map(async (model) => ({
        model: model.name,
        count: Number((await transaction.$queryRawUnsafe<Array<{ count: bigint }>>(
          `SELECT count(*)::bigint AS count FROM ${quoted(model.dbName ?? model.name)} WHERE "organizationId" IN ($1, $2)`,
          orgA, orgB
        ))[0]?.count ?? 0)
      })));
      expect(fixtureCounts.filter(({ count }) => count !== 1)).toEqual([]);
    }, tenant);

    const completeFixtureCounts = await Promise.all(tenantModels.map(async (model) => ({
      model: model.name,
      count: Number((await control.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT count(*)::bigint AS count FROM ${quoted(model.dbName ?? model.name)} WHERE "organizationId" IN ($1, $2)`,
        orgA, orgB
      ))[0]?.count ?? 0)
    })));
    expect(completeFixtureCounts.filter(({ count }) => count < 2)).toEqual([]);
    expect(executedCells).toHaveLength(380);
    expect(new Set(executedCells).size).toBe(380);
    expect(executedExports.size).toBe(82);
    const outcomeCounts = executedCells.reduce<Record<string, number>>((counts, cell) => {
      const outcome = cell.split(":")[2]!;
      counts[outcome] = (counts[outcome] ?? 0) + 1;
      return counts;
    }, {});
    expect(outcomeCounts).toEqual({ success: 183, denied: 59, duplicate: 12, "na-equivalent": 126 });
  }, 60_000);
});
