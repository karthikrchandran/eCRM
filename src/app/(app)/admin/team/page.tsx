import { notFound } from "next/navigation";
import { TeamMembers } from "@/components/admin/team-members";
import { requireUser } from "@/server/auth/current-user";
import { canManageAdminSettings } from "@/server/auth/permissions";
import { getControlPlaneDb } from "@/server/db";

export default async function TeamPage() {
  const user = await requireUser();
  if (!canManageAdminSettings(user.role)) notFound();

  const memberships = await getControlPlaneDb().organizationMembership.findMany({
    where: { organizationId: user.organizationId },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    select: { id: true, role: true, status: true, user: { select: { id: true, name: true, email: true, active: true } } }
  });

  return <TeamMembers initialMembers={memberships} currentMembershipId={user.membershipId} />;
}
