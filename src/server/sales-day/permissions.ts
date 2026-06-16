import type { UserRole } from "@prisma/client";
import { canViewCompanyRecords } from "@/server/auth/permissions";

export type SalesDayUser = {
  id: string;
  role: UserRole;
};

export type OwnedSalesDayRecord = {
  ownerId: string;
};

export function assertCanUseSalesWorkspace(user: SalesDayUser) {
  if (!canViewCompanyRecords(user.role)) {
    throw new Error("You do not have access to My Day.");
  }
}

export function assertOwnsSalesTask(user: SalesDayUser, task: OwnedSalesDayRecord) {
  assertCanUseSalesWorkspace(user);
  if (user.role !== "ADMIN" && task.ownerId !== user.id) {
    throw new Error("You can only update your own My Day tasks.");
  }
}

export function assertOwnsSalesVoiceNote(user: SalesDayUser, note: OwnedSalesDayRecord) {
  assertCanUseSalesWorkspace(user);
  if (user.role !== "ADMIN" && note.ownerId !== user.id) {
    throw new Error("You can only update your own voice notes.");
  }
}
