import { canManageAdminSettings, canViewCompanyRecords } from "@/server/auth/permissions";
import type { ProductionUser } from "./types";

export function assertCanViewProductionRecords(user: ProductionUser) {
  if (!canViewCompanyRecords(user.role)) {
    throw new Error("You do not have permission to view production records.");
  }
}

export function assertCanWriteProductionRecords(user: ProductionUser) {
  if (!canViewCompanyRecords(user.role)) {
    throw new Error("You do not have permission to manage production records.");
  }
}

export function assertCanManageProductionConfig(user: ProductionUser) {
  if (!canManageAdminSettings(user.role)) {
    throw new Error("You do not have permission to manage production configuration.");
  }
}
