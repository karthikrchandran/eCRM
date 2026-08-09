import type { OrganizationRole } from "@prisma/client";
import { canViewCompanyRecords } from "@/server/auth/permissions";

export type CrmUser = {
  id: string;
  organizationId: string;
  role: OrganizationRole;
};

export function assertCanViewCrmRecords(user: CrmUser) {
  if (!canViewCompanyRecords(user.role)) {
    throw new Error("You do not have access to CRM records.");
  }
}

export function assertCanWriteCrmRecords(user: CrmUser) {
  if (user.role !== "ADMIN" && user.role !== "SALES") {
    throw new Error("You do not have permission to change CRM records.");
  }
}
