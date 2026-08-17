import { expect, test } from "@playwright/test";
import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { validateDisposableDatabaseUrls } from "../../src/server/organizations/disposable-database";

const safeUrls = validateDisposableDatabaseUrls(
  process.env.TEST_DATABASE_URL,
  process.env.TEST_TENANT_DATABASE_URL,
  process.env.TEST_CONTROL_DATABASE_URL,
  []
);
if (process.env.DATABASE_URL !== safeUrls.ownerUrl
  || process.env.TENANT_DATABASE_URL !== safeUrls.tenantUrl
  || process.env.CONTROL_PLANE_DATABASE_URL !== safeUrls.controlUrl) {
  throw new Error("Tenant isolation browser server URLs must be the validated disposable owner, tenant, and control URLs.");
}

const db = new PrismaClient({ datasourceUrl: safeUrls.ownerUrl });
const ids = {
  orgA: "e2e_tenant_org_A", orgB: "e2e_tenant_org_B",
  userA: "e2e_tenant_user_A", userB: "e2e_tenant_user_B",
  leadB: "e2e_tenant_lead_B", stageB: "e2e_tenant_stage_B", opportunityB: "e2e_tenant_opportunity_B",
  productB: "e2e_tenant_product_B", proposalB: "e2e_tenant_proposal_B", proposalLineB: "e2e_tenant_proposal_line_B",
  orderB: "e2e_tenant_order_B", orderLineB: "e2e_tenant_order_line_B", workB: "e2e_tenant_work_B",
  voiceB: "e2e_tenant_voice_B", sharedB: "e2e_tenant_shared_B"
} as const;

test.beforeAll(async () => {
  const passwordHash = await hash("TenantA@12345", 10);
  await db.organization.createMany({ data: [
    { id: ids.orgA, key: "e2e-tenant-a", legalName: "Tenant A", displayName: "Tenant A", deploymentRegion: "local", status: "ACTIVE" },
    { id: ids.orgB, key: "e2e-tenant-b", legalName: "Tenant B", displayName: "Tenant B", deploymentRegion: "local", status: "ACTIVE" }
  ], skipDuplicates: true });
  await db.user.createMany({ data: [
    { id: ids.userA, name: "Tenant A Admin", email: "tenant-a@example.test", passwordHash, role: "ADMIN" },
    { id: ids.userB, name: "Tenant B Admin", email: "tenant-b@example.test", passwordHash, role: "ADMIN" }
  ], skipDuplicates: true });
  await db.organizationMembership.createMany({ data: [
    { id: "e2e_tenant_membership_A", organizationId: ids.orgA, userId: ids.userA, role: "ADMIN", status: "ACTIVE" },
    { id: "e2e_tenant_membership_B", organizationId: ids.orgB, userId: ids.userB, role: "ADMIN", status: "ACTIVE" }
  ], skipDuplicates: true });
  await db.leadCustomer.upsert({ where: { id: ids.leadB }, update: {}, create: {
    id: ids.leadB, organizationId: ids.orgB, name: "Tenant B Secret Customer", ownerId: ids.userB, createdById: ids.userB, updatedById: ids.userB
  } });
  await db.pipelineStage.upsert({ where: { id: ids.stageB }, update: {}, create: {
    id: ids.stageB, organizationId: ids.orgB, name: "Tenant B Open", sortOrder: 1
  } });
  await db.opportunity.upsert({ where: { id: ids.opportunityB }, update: {}, create: {
    id: ids.opportunityB, organizationId: ids.orgB, leadCustomerId: ids.leadB, stageId: ids.stageB,
    ownerId: ids.userB, title: "Tenant B Secret Opportunity", createdById: ids.userB, updatedById: ids.userB
  } });
  await db.productService.upsert({ where: { id: ids.productB }, update: {}, create: {
    id: ids.productB, organizationId: ids.orgB, name: "Tenant B Product", category: "Service", createdById: ids.userB, updatedById: ids.userB
  } });
  await db.proposal.upsert({ where: { id: ids.proposalB }, update: {}, create: {
    id: ids.proposalB, organizationId: ids.orgB, opportunityId: ids.opportunityB, clientAccountId: ids.leadB, title: "Tenant B Proposal",
    sequenceNumber: 1, status: "ACCEPTED", createdById: ids.userB, updatedById: ids.userB
  } });
  await db.proposalLineItem.upsert({ where: { id: ids.proposalLineB }, update: {}, create: {
    id: ids.proposalLineB, organizationId: ids.orgB, proposalId: ids.proposalB, productServiceId: ids.productB,
    productNameSnapshot: "Tenant B Product", productCategorySnapshot: "Service", quantity: 1, unitPricePaisa: 100,
    gstRateBps: 0, lineSubtotalPaisa: 100, lineGstPaisa: 0, lineTotalPaisa: 100
  } });
  await db.order.upsert({ where: { id: ids.orderB }, update: {}, create: {
    id: ids.orderB, organizationId: ids.orgB, orderNumber: "TENANT-B-ORDER", proposalId: ids.proposalB,
    opportunityId: ids.opportunityB, leadCustomerId: ids.leadB, ownerId: ids.userB, subtotalPaisa: 100,
    gstPaisa: 0, totalPaisa: 100, createdById: ids.userB, updatedById: ids.userB
  } });
  await db.orderLineItem.upsert({ where: { id: ids.orderLineB }, update: {}, create: {
    id: ids.orderLineB, organizationId: ids.orgB, orderId: ids.orderB, proposalLineItemId: ids.proposalLineB,
    productServiceId: ids.productB, productNameSnapshot: "Tenant B Product", productCategorySnapshot: "Service",
    quantity: 1, unitPricePaisa: 100, gstRateBps: 0, lineSubtotalPaisa: 100, lineGstPaisa: 0, lineTotalPaisa: 100
  } });
  await db.productionWorkItem.upsert({ where: { id: ids.workB }, update: {}, create: {
    id: ids.workB, organizationId: ids.orgB, orderLineItemId: ids.orderLineB, title: "Tenant B Production",
    productNameSnapshot: "Tenant B Product", productCategorySnapshot: "Service", createdById: ids.userB, updatedById: ids.userB
  } });
  await db.salesVoiceNote.upsert({ where: { id: ids.voiceB }, update: {}, create: {
    id: ids.voiceB, organizationId: ids.orgB, ownerId: ids.userB, leadCustomerId: ids.leadB,
    audioStorageKey: "tenant-b/private.webm", originalFileName: "private.webm", mimeType: "audio/webm", fileSizeBytes: 1
  } });
  await db.sharedBusinessRecord.upsert({ where: { id: ids.sharedB }, update: {}, create: {
    id: ids.sharedB, organizationId: ids.orgB, entityType: "LEAD", displayName: "Tenant B Shared Secret",
    status: "ACTIVE", sourceApp: "ecrm", searchText: "tenant b shared secret", data: {}
  } });
});

test.afterAll(async () => db.$disconnect());

test("tenant isolation blocks B direct URLs, search, audio, and shared export for signed-in A", async ({ page, request }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("tenant-a@example.test");
  await page.getByLabel("Password").fill("TenantA@12345");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const listResponse = await page.goto("/leads?q=Tenant+B+Secret");
  expect(listResponse?.status()).toBe(200);
  await expect(page.getByText("Tenant B Secret Customer")).toHaveCount(0);

  for (const path of [
    `/leads/${ids.leadB}`, `/leads/${ids.leadB}/edit`, `/opportunities/${ids.opportunityB}`,
    `/orders/${ids.orderB}`, `/production/${ids.workB}`
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
  }

  const audio = await page.request.get(`/my-day/voice-notes/${ids.voiceB}/audio`);
  expect(audio.status()).toBe(404);

  const headers = { authorization: `Bearer ${process.env.SHARED_DATA_API_TOKEN}` };
  const directShared = await request.get(`/api/shared-records/${ids.sharedB}`, { headers });
  expect(directShared.status()).toBe(404);
  const exported = await request.get("/api/shared-records/export?limit=100", { headers });
  expect(exported.status()).toBe(200);
  expect(await exported.text()).not.toContain("Tenant B Shared Secret");
});
