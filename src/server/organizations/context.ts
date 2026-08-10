import type {
  MembershipStatus,
  OrganizationRole,
  OrganizationStatus
} from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findOrganizationContextMembership } from "@/server/auth/control-plane-identity";
import {
  SESSION_COOKIE_NAME,
  membershipSessionVersion,
  verifySessionToken,
  type SessionUser
} from "@/server/auth/session";

export { membershipSessionVersion } from "@/server/auth/session";

type OrganizationMembershipRecord = {
  id: string;
  userId: string;
  organizationId: string;
  role: OrganizationRole;
  status: MembershipStatus;
  updatedAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    active: boolean;
  };
  organization: {
    status: OrganizationStatus;
  };
};

export type OrganizationContext = {
  userId: string;
  name: string;
  email: string;
  organizationId: string;
  membershipId: string;
  role: OrganizationRole;
  sessionVersion: number;
};

type OrganizationContextDependencies = {
  findMembershipById?: (membershipId: string) => Promise<OrganizationMembershipRecord | null>;
};

export async function resolveOrganizationContext(
  session: SessionUser,
  dependencies: OrganizationContextDependencies = {}
): Promise<OrganizationContext | null> {
  const lookupMembership = dependencies.findMembershipById ?? findOrganizationContextMembership;
  const membership = await lookupMembership(session.membershipId);

  if (
    !membership ||
    membership.id !== session.membershipId ||
    membership.userId !== session.id ||
    membership.user.id !== session.id ||
    membership.organizationId !== session.organizationId ||
    !membership.user.active ||
    membership.status !== "ACTIVE" ||
    membership.organization.status !== "ACTIVE"
  ) {
    return null;
  }

  const sessionVersion = membershipSessionVersion(membership.updatedAt);

  if (
    !Number.isSafeInteger(sessionVersion) ||
    sessionVersion <= 0 ||
    sessionVersion !== session.sessionVersion
  ) {
    return null;
  }

  return {
    userId: membership.userId,
    name: membership.user.name,
    email: membership.user.email,
    organizationId: membership.organizationId,
    membershipId: membership.id,
    role: membership.role,
    sessionVersion
  };
}

export async function getCurrentOrganizationContext() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await verifySessionToken(token);
  return session ? resolveOrganizationContext(session) : null;
}

export async function requireOrganizationContext() {
  const context = await getCurrentOrganizationContext();

  if (!context) {
    redirect("/login");
  }

  return context;
}
