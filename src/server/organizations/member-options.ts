import { Prisma, type OrganizationRole } from "@prisma/client";
import { getControlPlaneDb } from "@/server/db";

type MemberOptionDb = {
  $queryRaw<T>(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]): Promise<T>;
};

type MemberRow = { id: string; name: string; email: string; legacy_role: "ADMIN" | "SALES"; membership_role: OrganizationRole };

async function loadActiveMembers(organizationId: string, roles: OrganizationRole[], database: MemberOptionDb) {
  const allowedRoles = Prisma.join(roles.map((role) => Prisma.sql`${role}`));
  return database.$queryRaw<MemberRow[]>(Prisma.sql`
    SELECT * FROM public.control_active_organization_members(${organizationId}, ARRAY[${allowedRoles}]::TEXT[])
  `);
}

export async function listOrganizationUserOptions(
  organizationId: string,
  roles: OrganizationRole[],
  database: MemberOptionDb = getControlPlaneDb() as unknown as MemberOptionDb
) {
  const members = await loadActiveMembers(organizationId, roles, database);
  return members.map((member) => ({ id: member.id, name: member.name, email: member.email, role: member.legacy_role }));
}

export async function findOrganizationMemberByEmail(
  organizationId: string,
  email: string,
  roles: OrganizationRole[],
  database: MemberOptionDb = getControlPlaneDb()
) {
  const normalizedEmail = email.trim().toLowerCase();
  return (await loadActiveMembers(organizationId, roles, database))
    .find((member) => member.email.trim().toLowerCase() === normalizedEmail) ?? null;
}

export async function assertOrganizationUserEligible(
  organizationId: string,
  userId: string,
  roles: OrganizationRole[],
  database = getControlPlaneDb()
) {
  const membership = (await loadActiveMembers(organizationId, roles, database)).find((member) => member.id === userId);
  if (!membership) throw new Error("Choose an active organization member.");
}
