import { canViewCompanyRecords } from "@/server/auth/permissions";
import type { FinanceUser } from "./types";

export function assertCanViewFinance(user: FinanceUser) {
  if (!canViewCompanyRecords(user.role)) {
    throw new Error("You do not have permission to view finance.");
  }
}

export function assertCanManageFinance(user: FinanceUser) {
  if (user.role !== "ADMIN") {
    throw new Error("You do not have permission to manage finance.");
  }
}
