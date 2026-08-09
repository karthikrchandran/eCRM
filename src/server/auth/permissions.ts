import type { OrganizationRole } from "@prisma/client";

export function canViewCompanyRecords(role: OrganizationRole) {
  return role === "ADMIN" || role === "SALES";
}

export function canManageAdminSettings(role: OrganizationRole) {
  return role === "ADMIN";
}

export function canFinalizeCosts(role: OrganizationRole) {
  return role === "ADMIN";
}

export function canApproveIncentives(role: OrganizationRole) {
  return role === "ADMIN";
}
