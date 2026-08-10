import type { OrganizationRole, Prisma } from "@prisma/client";
import { getControlPlaneDb } from "@/server/db";

type MemberOptionDb = {
  organizationMembership: {
    findMany: (args: Prisma.OrganizationMembershipFindManyArgs) => Promise<Array<{
      user: { email: string; id: string; name: string; role: "ADMIN" | "SALES" };
    }>>;
  };
};

export async function listOrganizationUserOptions(
  organizationId: string,
  roles: OrganizationRole[],
  database: MemberOptionDb = getControlPlaneDb() as unknown as MemberOptionDb
) {
  const memberships = await database.organizationMembership.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      role: { in: roles },
      user: { active: true }
    },
    orderBy: { user: { name: "asc" } },
    select: { user: { select: { email: true, id: true, name: true, role: true } } }
  });

  return memberships.map(({ user }) => user);
}

export async function assertOrganizationUserEligible(
  organizationId: string,
  userId: string,
  roles: OrganizationRole[],
  database = getControlPlaneDb()
) {
  const membership = await database.organizationMembership.findFirst({
    where: { organizationId, userId, status: "ACTIVE", role: { in: roles }, user: { active: true } },
    select: { id: true }
  });
  if (!membership) throw new Error("Choose an active organization member.");
}
