import type { UserRole } from "@prisma/client";

export function canViewCompanyRecords(role: UserRole) {
  return role === "ADMIN" || role === "SALES";
}

export function canManageAdminSettings(role: UserRole) {
  return role === "ADMIN";
}

export function canFinalizeCosts(role: UserRole) {
  return role === "ADMIN";
}

export function canApproveIncentives(role: UserRole) {
  return role === "ADMIN";
}
