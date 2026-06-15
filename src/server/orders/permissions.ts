import { canViewCompanyRecords } from "@/server/auth/permissions";
import type { OrderUser } from "./types";

export function assertCanViewOrders(user: OrderUser) {
  if (!canViewCompanyRecords(user.role)) {
    throw new Error("You do not have permission to view orders.");
  }
}

export function assertCanWriteOrders(user: OrderUser) {
  if (!canViewCompanyRecords(user.role)) {
    throw new Error("You do not have permission to manage orders.");
  }
}
