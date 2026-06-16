import { canViewCompanyRecords } from "@/server/auth/permissions";
import type { ReportsUser } from "./types";

export function assertCanViewReports(user: ReportsUser) {
  if (!canViewCompanyRecords(user.role)) {
    throw new Error("You do not have permission to view reports.");
  }
}
