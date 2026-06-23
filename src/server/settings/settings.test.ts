import { describe, expect, it, vi } from "vitest";
import { getBusinessSettings, updateBusinessSettings } from "./settings";

const adminUser = { id: "admin_1", role: "ADMIN" as const };
const salesUser = { id: "sales_1", role: "SALES" as const };

describe("business settings", () => {
  it("returns INR defaults when settings have not been saved yet", async () => {
    const database = {
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

    await updateBusinessSettings(adminUser, { defaultCurrency: "USD" }, { businessSettings: { upsert } });

    expect(upsert).toHaveBeenCalledWith({
      where: { id: "default" },
      create: { id: "default", defaultCurrency: "USD" },
      update: { defaultCurrency: "USD" },
      select: { defaultCurrency: true }
    });
  });

  it("rejects Sales attempts to update business settings", async () => {
    await expect(
      updateBusinessSettings(salesUser, { defaultCurrency: "USD" }, { businessSettings: { upsert: vi.fn() } })
    ).rejects.toThrow("Only Admin can manage business settings.");
  });
});
