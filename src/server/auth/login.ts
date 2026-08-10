import type { MembershipStatus, OrganizationRole, OrganizationStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { findActiveLoginMemberships, findAuthenticationUserByEmail } from "./control-plane-identity";
import { verifyPassword as verifyPasswordHash } from "./password";
import { membershipSessionVersion, type SessionUser } from "./session";

const SAFE_LOGIN_ERROR = "Invalid email or password.";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password.")
});

export type LoginState = {
  error?: string;
};

type LoginInput = {
  email: unknown;
  password: unknown;
};

type LoginUserRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash: string | null;
  role: UserRole;
  active: boolean;
  memberships: Array<{
    id: string;
    organizationId: string;
    role: OrganizationRole;
    status: MembershipStatus;
    updatedAt: Date;
    organization: {
      status: OrganizationStatus;
    };
  }>;
};

type LoginDependencies = {
  findUserByEmail?: (email: string) => Promise<LoginUserRecord | null>;
  verifyPassword?: (password: string, passwordHash: string) => Promise<boolean>;
};

async function findUserByEmail(email: string) {
  const user = await findAuthenticationUserByEmail(email);
  if (!user) return null;
  return { ...user, memberships: await findActiveLoginMemberships(user.id) };
}

function selectLoginMembership(user: LoginUserRecord) {
  return user.memberships
    .filter(
      (membership) =>
        membership.status === "ACTIVE" && membership.organization.status === "ACTIVE"
    )
    .sort((left, right) => {
      const newestFirst = right.updatedAt.getTime() - left.updatedAt.getTime();
      return newestFirst || left.id.localeCompare(right.id);
    })[0];
}

export async function authenticateLogin(
  input: LoginInput,
  dependencies: LoginDependencies = {}
): Promise<LoginState | { user: SessionUser }> {
  const parsed = loginSchema.safeParse(input);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your login details." };
  }

  const lookupUser = dependencies.findUserByEmail ?? findUserByEmail;
  const verifyPassword = dependencies.verifyPassword ?? verifyPasswordHash;
  const user = await lookupUser(parsed.data.email.toLowerCase());

  if (!user?.active || !user.passwordHash) {
    return { error: SAFE_LOGIN_ERROR };
  }

  const validPassword = await verifyPassword(parsed.data.password, user.passwordHash);

  if (!validPassword) {
    return { error: SAFE_LOGIN_ERROR };
  }

  const membership = selectLoginMembership(user);

  if (!membership) {
    return { error: SAFE_LOGIN_ERROR };
  }

  const sessionVersion = membershipSessionVersion(membership.updatedAt);

  if (!Number.isSafeInteger(sessionVersion) || sessionVersion <= 0) {
    return { error: SAFE_LOGIN_ERROR };
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      organizationId: membership.organizationId,
      membershipId: membership.id,
      role: membership.role,
      sessionVersion
    }
  };
}
