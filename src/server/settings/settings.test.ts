import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { CellAdministrationService, createInMemoryCellAdministrationRepository } from "@/server/cell-admin/service";
import { getBusinessSettings, updateBusinessSettings } from "./settings";

const adminUser = { id: "admin_1", role: "ADMIN" as const };
const salesUser = { id: "sales_1", role: "SALES" as const };

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

  it("lets Admin update the default currency", async () => {
    const upsert = vi.fn().mockResolvedValue({ defaultCurrency: "USD" });

    await updateBusinessSettings(adminUser, { defaultCurrency: "USD" }, {
      cellConfiguration: { findUnique: vi.fn(), upsert },
      businessSettings: { findUnique: vi.fn() }
    });

    expect(upsert).toHaveBeenCalledWith({
      where: { id: "default" },
      create: { id: "default", defaultCurrency: "USD" },
      update: { defaultCurrency: "USD" },
      select: { defaultCurrency: true }
    });
  });

  it("prefers CellConfiguration and uses BusinessSettings only as a missing-row migration fallback", async () => {
    const cellFindUnique = vi.fn().mockResolvedValue({ defaultCurrency: "USD" });
    const legacyFindUnique = vi.fn().mockResolvedValue({ defaultCurrency: "INR" });

    await expect(getBusinessSettings(salesUser, {
      cellConfiguration: { findUnique: cellFindUnique, upsert: vi.fn() },
      businessSettings: { findUnique: legacyFindUnique }
    })).resolves.toEqual({ defaultCurrency: "USD" });

    expect(legacyFindUnique).not.toHaveBeenCalled();
  });

  it("keeps a settings currency update when branding and modules are updated afterward", async () => {
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
    const settingsDatabase = {
      cellConfiguration: {
        findUnique: async () => {
          const configuration = await repository.getConfiguration();
          return configuration ? { defaultCurrency: configuration.defaultCurrency } : null;
        },
        upsert: async (args: Prisma.CellConfigurationUpsertArgs) => {
          const current = (await repository.getConfiguration())!;
          const defaultCurrency = (args.update.defaultCurrency ?? current.defaultCurrency) as "INR" | "USD";
          await repository.updateConfigurationWithAudit(
            { ...current, defaultCurrency },
            {
              id: "audit_currency",
              actorId: adminUser.id,
              action: "business-settings.update",
              targetType: "CellConfiguration",
              targetId: "default",
              correlationId: "corr_currency",
              reason: "Set commercial currency",
              result: "SUCCEEDED",
              occurredAt: new Date()
            }
          );
          return { defaultCurrency };
        }
      },
      businessSettings: { findUnique: vi.fn().mockResolvedValue({ defaultCurrency: "INR" as const }) }
    };

    await updateBusinessSettings(adminUser, { defaultCurrency: "USD" }, settingsDatabase);
    const administration = new CellAdministrationService(repository);
    const updated = await administration.updateConfiguration(adminUser, {
      displayName: "Acme CRM",
      enabledModules: ["crm", "finance"]
    }, { correlationId: "corr_branding", reason: "Apply branding" });

    expect(updated.defaultCurrency).toBe("USD");
    expect(settingsDatabase.businessSettings.findUnique).not.toHaveBeenCalled();
  });

  it("rejects Sales attempts to update business settings", async () => {
    await expect(
      updateBusinessSettings(salesUser, { defaultCurrency: "USD" }, {
        cellConfiguration: { findUnique: vi.fn(), upsert: vi.fn() },
        businessSettings: { findUnique: vi.fn() }
      })
    ).rejects.toThrow("Only Admin can manage business settings.");
  });
});
