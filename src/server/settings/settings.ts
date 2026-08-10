import type { OrganizationRole, Prisma } from "@prisma/client";
import { canManageAdminSettings, canViewCompanyRecords } from "@/server/auth/permissions";
import { getControlPlaneDb } from "@/server/db";

export type SupportedCurrency = "INR" | "USD";

export type SettingsUser = {
  id: string;
  role: OrganizationRole;
};

export type BusinessSettingsView = {
  defaultCurrency: SupportedCurrency;
};

type SettingsDb = {
  businessSettings: {
    findUnique?: (args: Prisma.BusinessSettingsFindUniqueArgs) => Promise<BusinessSettingsView | null>;
    upsert?: (args: Prisma.BusinessSettingsUpsertArgs) => Promise<BusinessSettingsView>;
  };
};

function assertCanViewSettings(user: SettingsUser) {
  if (!canViewCompanyRecords(user.role)) {
    throw new Error("You do not have permission to view business settings.");
  }
}

function assertCanManageSettings(user: SettingsUser) {
  if (!canManageAdminSettings(user.role)) {
    throw new Error("Only Admin can manage business settings.");
  }
}

export async function getBusinessSettings(
  user: SettingsUser,
  database: SettingsDb = getControlPlaneDb() as unknown as SettingsDb
): Promise<BusinessSettingsView> {
  assertCanViewSettings(user);

  const settings = await database.businessSettings.findUnique?.({
    where: { id: "default" },
    select: { defaultCurrency: true }
  });

  return { defaultCurrency: settings?.defaultCurrency ?? "INR" };
}

export async function updateBusinessSettings(
  user: SettingsUser,
  input: BusinessSettingsView,
  database: SettingsDb = getControlPlaneDb() as unknown as SettingsDb
) {
  assertCanManageSettings(user);

  if (!database.businessSettings.upsert) {
    throw new Error("Business settings storage is not available.");
  }

  return database.businessSettings.upsert({
    where: { id: "default" },
    create: { id: "default", defaultCurrency: input.defaultCurrency },
    update: { defaultCurrency: input.defaultCurrency },
    select: { defaultCurrency: true }
  });
}
