import type { Prisma, UserRole } from "@prisma/client";
import { canManageAdminSettings, canViewCompanyRecords } from "@/server/auth/permissions";
import { db } from "@/server/db";

export type SupportedCurrency = "INR" | "USD";

export type SettingsUser = {
  id: string;
  role: UserRole | "ADMIN" | "SALES";
};

export type BusinessSettingsView = {
  defaultCurrency: SupportedCurrency;
};

type SettingsDb = {
  cellConfiguration?: {
    findUnique?: (args: Prisma.CellConfigurationFindUniqueArgs) => Promise<BusinessSettingsView | null>;
    upsert?: (args: Prisma.CellConfigurationUpsertArgs) => Promise<BusinessSettingsView>;
  };
  businessSettings?: {
    findUnique?: (args: Prisma.BusinessSettingsFindUniqueArgs) => Promise<BusinessSettingsView | null>;
  };
};

function assertCanViewSettings(user: SettingsUser) {
  if (!canViewCompanyRecords(user.role as UserRole)) {
    throw new Error("You do not have permission to view business settings.");
  }
}

function assertCanManageSettings(user: SettingsUser) {
  if (!canManageAdminSettings(user.role as UserRole)) {
    throw new Error("Only Admin can manage business settings.");
  }
}

export async function getBusinessSettings(
  user: SettingsUser,
  database: SettingsDb = db as unknown as SettingsDb
): Promise<BusinessSettingsView> {
  assertCanViewSettings(user);

  const configuration = await database.cellConfiguration?.findUnique?.({
    where: { id: "default" },
    select: { defaultCurrency: true }
  });
  if (configuration) return configuration;

  const legacySettings = await database.businessSettings?.findUnique?.({
    where: { id: "default" },
    select: { defaultCurrency: true }
  });

  return { defaultCurrency: legacySettings?.defaultCurrency ?? "INR" };
}

export async function updateBusinessSettings(
  user: SettingsUser,
  input: BusinessSettingsView,
  database: SettingsDb = db as unknown as SettingsDb
) {
  assertCanManageSettings(user);

  if (!database.cellConfiguration?.upsert) {
    throw new Error("Cell configuration storage is not available.");
  }

  return database.cellConfiguration.upsert({
    where: { id: "default" },
    create: { id: "default", defaultCurrency: input.defaultCurrency },
    update: { defaultCurrency: input.defaultCurrency },
    select: { defaultCurrency: true }
  });
}
