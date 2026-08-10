import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { validateDisposableDatabaseUrls } from "@/server/organizations/disposable-database";
import { LEAD_IMPORT_HEADERS, previewLeadImportCsv } from "./lead-import";

const ownerValue = process.env.TEST_DATABASE_URL;
const tenantValue = process.env.TEST_TENANT_DATABASE_URL;
const controlValue = process.env.TEST_CONTROL_DATABASE_URL;
const integration = describe.runIf(Boolean(ownerValue && tenantValue && controlValue));

integration("default lead import preview boundary", () => {
  if (!ownerValue || !tenantValue || !controlValue) return;
  const safe = validateDisposableDatabaseUrls(ownerValue, tenantValue, controlValue);
  const owner = new PrismaClient({ datasourceUrl: safe.ownerUrl });
  const ids = { organization: "lead_import_default_org", user: "lead_import_default_user", membership: "lead_import_default_membership" };

  beforeAll(async () => {
    process.env.CONTROL_PLANE_DATABASE_URL = safe.controlUrl;
    await owner.organization.upsert({ where: { id: ids.organization }, update: { status: "ACTIVE" }, create: {
      id: ids.organization, key: "lead-import-default", legalName: "Lead Import", displayName: "Lead Import",
      deploymentRegion: "local", status: "ACTIVE"
    } });
    await owner.user.upsert({ where: { id: ids.user }, update: { active: true }, create: {
      id: ids.user, name: "Import Owner", email: "import-owner@example.test", passwordHash: "test", role: "SALES", active: true
    } });
    await owner.organizationMembership.upsert({ where: { id: ids.membership }, update: { status: "ACTIVE" }, create: {
      id: ids.membership, organizationId: ids.organization, userId: ids.user, role: "SALES", status: "ACTIVE"
    } });
  });

  afterAll(async () => {
    await owner.organizationMembership.deleteMany({ where: { id: ids.membership } });
    await owner.user.deleteMany({ where: { id: ids.user } });
    await owner.organization.deleteMany({ where: { id: ids.organization } });
    await owner.$disconnect();
  });

  it("resolves an owner with the real two-argument public preview", async () => {
    const values = Object.fromEntries(LEAD_IMPORT_HEADERS.map((header) => [header, ""]));
    values.leadName = "Default Boundary Lead";
    values.ownerEmail = "IMPORT-OWNER@EXAMPLE.TEST";
    const csv = `${LEAD_IMPORT_HEADERS.join(",")}\n${LEAD_IMPORT_HEADERS.map((header) => values[header]).join(",")}`;
    await expect(previewLeadImportCsv(
      { id: ids.user, organizationId: ids.organization, role: "ADMIN" }, csv
    )).resolves.toMatchObject({ validRows: 1, rows: [{ lead: { ownerId: ids.user } }] });
  });
});
