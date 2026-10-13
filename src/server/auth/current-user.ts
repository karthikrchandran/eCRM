import { redirect } from "next/navigation";
import { isConfiguredCellRuntimeActive } from "@/server/runtime/cell-config";
import { requireCellModule, type CellModule } from "@/server/cell-admin/module-access";
import { getCurrentOrganizationContext } from "@/server/organizations/context";

type CurrentUserRole = "ADMIN" | "SALES";

function isCurrentUserRole(role: string): role is CurrentUserRole {
  return role === "ADMIN" || role === "SALES";
}

export async function getCurrentUser() {
  if (!await isConfiguredCellRuntimeActive()) return null;
  const context = await getCurrentOrganizationContext();

  if (!context) {
    return null;
  }

  if (!isCurrentUserRole(context.role)) {
    return null;
  }

  return {
    id: context.userId,
    name: context.name,
    email: context.email,
    role: context.role,
    active: true,
    organizationId: context.organizationId,
    membershipId: context.membershipId,
    sessionVersion: context.sessionVersion
  };
}

export async function requireUser(module?: CellModule) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (module) await requireCellModule(module);

  return user;
}
