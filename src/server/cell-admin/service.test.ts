import { describe, expect, it } from "vitest";

import {
  CellAdministrationService,
  createInMemoryCellAdministrationRepository
} from "./service";

const admin = { id: "admin_1", role: "ADMIN" as const };
const sales = { id: "sales_1", role: "SALES" as const };
const audit = { correlationId: "corr_1", reason: "Routine administration" };

describe("cell-local administration", () => {
  it("uses neutral branding and existing INR business default before local configuration exists", async () => {
    const service = new CellAdministrationService(createInMemoryCellAdministrationRepository());

    await expect(service.getConfiguration(admin)).resolves.toEqual(expect.objectContaining({
      displayName: "eCRM",
      logoUrl: null,
      primaryColor: "#1e3a5f",
      locale: "en-US",
      timezone: "UTC",
      defaultCurrency: "INR",
      enabledModules: []
    }));
  });

  it("lets Admin update branding, settings, and included modules while preserving immutable entitlements", async () => {
    const repository = createInMemoryCellAdministrationRepository({
      configuration: {
        id: "default",
        displayName: "eCRM",
        logoUrl: null,
        primaryColor: "#1e3a5f",
        locale: "en-US",
        timezone: "UTC",
        defaultCurrency: "INR",
        enabledModules: ["crm"],
        allowedModules: ["crm", "finance"],
        planCode: "ENTERPRISE",
        createdAt: new Date("2026-08-11T12:00:00Z"),
        updatedAt: new Date("2026-08-11T12:00:00Z")
      }
    });
    const service = new CellAdministrationService(repository);

    const configuration = await service.updateConfiguration(admin, {
      displayName: "Acme CRM",
      logoUrl: "https://acme.example/logo.svg",
      primaryColor: "#123456",
      locale: "en-US",
      timezone: "America/New_York",
      defaultCurrency: "USD",
      enabledModules: ["crm", "finance"]
    }, audit);

    expect(configuration).toMatchObject({ planCode: "ENTERPRISE", allowedModules: ["crm", "finance"], enabledModules: ["crm", "finance"] });
    expect(await repository.getBusinessCurrency()).toBe("USD");
    expect(await repository.auditEvents()).toContainEqual(expect.objectContaining({ actorId: admin.id, action: "cell-configuration.update", result: "SUCCEEDED" }));
  });

  it("rejects excluded modules and Sales updates, recording failed audit", async () => {
    const repository = createInMemoryCellAdministrationRepository({ allowedModules: ["crm"] });
    const service = new CellAdministrationService(repository);

    await expect(service.updateConfiguration(admin, { enabledModules: ["crm", "finance"] }, audit)).rejects.toThrow(
      "Module finance is not included in this plan"
    );
    await expect(service.updateConfiguration(sales, { displayName: "Sales override" }, audit)).rejects.toThrow(
      "Only Admin can manage customer-cell administration"
    );
    expect(await repository.auditEvents()).toEqual(expect.arrayContaining([
      expect.objectContaining({ result: "FAILED", error: "PLAN_MODULE_EXCLUDED" }),
      expect.objectContaining({ result: "FAILED", error: "ADMIN_REQUIRED" })
    ]));
  });

  it("lets Admin create local Sales/Admin users with hashed passwords", async () => {
    const repository = createInMemoryCellAdministrationRepository({ users: [{ id: "admin_1", name: "Admin", email: "admin@example.com", role: "ADMIN", active: true }] });
    const service = new CellAdministrationService(repository, async () => "hashed-password");

    const user = await service.createUser(admin, {
      name: "Sales User",
      email: "sales@example.com",
      password: "SecurePassphrase123!",
      role: "SALES"
    }, audit);

    expect(user).toMatchObject({ email: "sales@example.com", role: "SALES", active: true });
    expect(repository.passwordHashFor(user.id)).toBe("hashed-password");
  });

  it("rejects Sales user management and protects the final active Admin", async () => {
    const repository = createInMemoryCellAdministrationRepository({
      users: [{ id: "admin_1", name: "Only Admin", email: "admin@example.com", role: "ADMIN", active: true }]
    });
    const service = new CellAdministrationService(repository);

    await expect(service.createUser(sales, {
      name: "No Access",
      email: "no@example.com",
      password: "SecurePassphrase123!",
      role: "SALES"
    }, audit)).rejects.toThrow("Only Admin can manage customer-cell administration");
    await expect(service.updateUser(admin, "admin_1", { active: false }, audit)).rejects.toThrow(
      "The final active Admin cannot be deactivated or changed to Sales"
    );
    expect((await repository.listUsers()).find((user) => user.id === "admin_1")?.active).toBe(true);
  });
});
