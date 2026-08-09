import { redirect } from "next/navigation";
import { getCurrentOrganizationContext } from "@/server/organizations/context";

export async function getCurrentUser() {
  const context = await getCurrentOrganizationContext();

  return context
    ? {
        id: context.userId,
        name: context.name,
        email: context.email,
        role: context.role,
        active: true as const,
        organizationId: context.organizationId,
        membershipId: context.membershipId,
        sessionVersion: context.sessionVersion
      }
    : null;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
