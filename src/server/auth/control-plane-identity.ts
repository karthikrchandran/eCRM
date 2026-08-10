import type { MembershipStatus, OrganizationRole, OrganizationStatus, UserRole } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { getControlPlaneDb } from "@/server/db";

export type AuthenticationUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
};

type AuthRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  legacy_role: UserRole;
  active: boolean;
};

export async function findAuthenticationUserByEmail(email: string): Promise<AuthenticationUser | null> {
  const rows = await getControlPlaneDb().$queryRaw<AuthRow[]>(Prisma.sql`
    SELECT * FROM public.control_auth_user_by_email(${email.trim().toLowerCase()})
  `);
  const row = rows[0];
  return row ? {
    id: row.id, name: row.name, email: row.email, passwordHash: row.password_hash,
    role: row.legacy_role, active: row.active
  } : null;
}

export async function findActiveLoginMemberships(userId: string) {
  return getControlPlaneDb().organizationMembership.findMany({
    where: { userId, status: "ACTIVE", organization: { status: "ACTIVE" } },
    select: {
      id: true, organizationId: true, role: true, status: true, updatedAt: true,
      organization: { select: { status: true } }
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }]
  }) as Promise<Array<{
    id: string; organizationId: string; role: OrganizationRole; status: MembershipStatus;
    updatedAt: Date; organization: { status: OrganizationStatus };
  }>>;
}

type ContextMembershipRow = {
  membership_id: string;
  user_id: string;
  organization_id: string;
  membership_role: OrganizationRole;
  membership_status: MembershipStatus;
  membership_updated_at: Date;
  user_name: string;
  user_email: string;
  user_active: boolean;
  organization_status: OrganizationStatus;
};

export async function findOrganizationContextMembership(membershipId: string) {
  const rows = await getControlPlaneDb().$queryRaw<ContextMembershipRow[]>(Prisma.sql`
    SELECT * FROM public.control_organization_context_membership(${membershipId})
  `);
  const row = rows[0];
  return row ? {
    id: row.membership_id,
    userId: row.user_id,
    organizationId: row.organization_id,
    role: row.membership_role,
    status: row.membership_status,
    updatedAt: row.membership_updated_at,
    user: { id: row.user_id, name: row.user_name, email: row.user_email, active: row.user_active },
    organization: { status: row.organization_status }
  } : null;
}
