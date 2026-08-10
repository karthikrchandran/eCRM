import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { validateDisposableDatabaseUrls } from "@/server/organizations/disposable-database";

const ownerValue = process.env.TEST_DATABASE_URL;
const tenantValue = process.env.TEST_TENANT_DATABASE_URL;
const controlValue = process.env.TEST_CONTROL_DATABASE_URL;
const integration = describe.runIf(Boolean(ownerValue && tenantValue && controlValue));

integration("safe control-plane authentication", () => {
  if (!ownerValue || !tenantValue || !controlValue) return;
  const safe = validateDisposableDatabaseUrls(ownerValue, tenantValue, controlValue);
  const owner = new PrismaClient({ datasourceUrl: safe.ownerUrl });
  const control = new PrismaClient({ datasourceUrl: safe.controlUrl });
  const ids = { organization: "control_auth_org", user: "control_auth_user", membership: "control_auth_membership" };

  beforeAll(async () => {
    process.env.CONTROL_PLANE_DATABASE_URL = safe.controlUrl;
    await owner.organization.upsert({ where: { id: ids.organization }, update: { status: "ACTIVE" }, create: {
      id: ids.organization, key: "control-auth-org", legalName: "Control Auth", displayName: "Control Auth",
      deploymentRegion: "local", status: "ACTIVE"
    } });
    await owner.user.upsert({ where: { id: ids.user }, update: { active: true }, create: {
      id: ids.user, name: "Control Login", email: "control-login@example.test",
      passwordHash: await hash("Control@12345", 4), role: "ADMIN", active: true
    } });
    await owner.organizationMembership.upsert({ where: { id: ids.membership }, update: { status: "ACTIVE" }, create: {
      id: ids.membership, organizationId: ids.organization, userId: ids.user, role: "ADMIN", status: "ACTIVE"
    } });
  });

  afterAll(async () => {
    await owner.organizationMembership.deleteMany({ where: { id: ids.membership } });
    await owner.user.deleteMany({ where: { id: ids.user } });
    await owner.organization.deleteMany({ where: { id: ids.organization } });
    await Promise.all([owner.$disconnect(), control.$disconnect()]);
  });

  it("authenticates through the narrow function while arbitrary tables remain unavailable", async () => {
    const { authenticateLogin } = await import("./login");
    const login = await authenticateLogin({ email: "CONTROL-LOGIN@EXAMPLE.TEST", password: "Control@12345" });
    expect(login).toMatchObject({ user: { id: ids.user, organizationId: ids.organization } });
    if (!("user" in login)) throw new Error("Expected successful login");
    const { resolveOrganizationContext } = await import("@/server/organizations/context");
    await expect(resolveOrganizationContext(login.user)).resolves.toMatchObject({
      userId: ids.user, organizationId: ids.organization, membershipId: ids.membership
    });

    await expect(control.$queryRawUnsafe('SELECT "passwordHash" FROM "User"')).rejects.toThrow();
    await expect(control.leadCustomer.count()).rejects.toThrow();
  });
});
