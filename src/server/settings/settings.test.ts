import { describe, expect, it, vi } from "vitest";
import { CellAdministrationService, createInMemoryCellAdministrationRepository } from "@/server/cell-admin/service";
import { getBusinessSettings, updateBusinessSettings } from "./settings";

const adminUser = { id: "admin_1", role: "ADMIN" as const };
const salesUser = { id: "sales_1", role: "SALES" as const };
const auditContext = { correlationId: "corr_currency", reason: "Set commercial currency" };

function configuration(defaultCurrency: "INR" | "USD" = "INR") {
  return {
    id: "default" as const,
    displayName: "eCRM",
    logoUrl: null,
    primaryColor: "#1e3a5f",
    locale: "en-US",
    timezone: "UTC",
    defaultCurrency,
    enabledModules: ["crm"],
    allowedModules: ["crm", "finance"],
    planCode: "ENTERPRISE",
    createdAt: new Date("2026-08-11T12:00:00Z"),
    updatedAt: new Date("2026-08-11T12:00:00Z")
  };
}

describe("business settings", () => {
  it("returns INR defaults when settings have not been saved yet", async () => {
    const database = {
      cellConfiguration: {
        findUnique: vi.fn().mockResolvedValue(null)
      },
      businessSettings: {
        findUnique: vi.fn().mockResolvedValue(null)
      }
    };

    await expect(getBusinessSettings(salesUser, database)).resolves.toEqual({
      defaultCurrency: "INR"
    });
  });

  it("routes an Admin currency update through the audited cell-configuration transaction", async () => {
    const repository = createInMemoryCellAdministrationRepository({ configuration: configuration() });
    const administration = new CellAdministrationService(repository);

    await expect(updateBusinessSettings(
      adminUser,
      { defaultCurrency: "USD" },
      auditContext,
      administration
    )).resolves.toEqual({ defaultCurrency: "USD" });

    expect((await repository.getConfiguration())?.defaultCurrency).toBe("USD");
    expect(await repository.auditEvents()).toContainEqual(expect.objectContaining({
      actorId: adminUser.id,
      action: "cell-configuration.update",
      targetType: "CellConfiguration",
      targetId: "default",
      correlationId: auditContext.correlationId,
      reason: auditContext.reason,
      before: expect.objectContaining({ defaultCurrency: "INR" }),
      after: expect.objectContaining({ defaultCurrency: "USD" }),
      result: "SUCCEEDED"
    }));
  });

  it("prefers CellConfiguration and uses BusinessSettings only as a missing-row migration fallback", async () => {
    const cellFindUnique = vi.fn().mockResolvedValue({ defaultCurrency: "USD" });
    const legacyFindUnique = vi.fn().mockResolvedValue({ defaultCurrency: "INR" });

    await expect(getBusinessSettings(salesUser, {
      cellConfiguration: { findUnique: cellFindUnique },
      businessSettings: { findUnique: legacyFindUnique }
    })).resolves.toEqual({ defaultCurrency: "USD" });

    expect(legacyFindUnique).not.toHaveBeenCalled();
  });

  it("keeps a settings currency update when branding and modules are updated afterward", async () => {
    const repository = createInMemoryCellAdministrationRepository({
      configuration: configuration()
    });
    const administration = new CellAdministrationService(repository);

    await updateBusinessSettings(adminUser, { defaultCurrency: "USD" }, auditContext, administration);
    const updated = await administration.updateConfiguration(adminUser, {
      displayName: "Acme CRM",
      enabledModules: ["crm", "finance"]
    }, { correlationId: "corr_branding", reason: "Apply branding" });

    expect(updated.defaultCurrency).toBe("USD");
  });

  it("rejects Sales attempts to update business settings", async () => {
    await expect(
      updateBusinessSettings(
        salesUser,
        { defaultCurrency: "USD" },
        auditContext,
        new CellAdministrationService(createInMemoryCellAdministrationRepository({ configuration: configuration() }))
      )
    ).rejects.toThrow("Only Admin can manage business settings.");
  });
});
