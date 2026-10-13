import type { MembershipStatus, OrganizationRole, OrganizationStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { db } from "@/server/db";
import { isConfiguredCellRuntimeActive } from "@/server/runtime/cell-config";
import { verifyPassword as verifyPasswordHash } from "./password";
import { membershipSessionVersion, type SessionUser } from "./session";
import { findActiveLoginMemberships } from "./control-plane-identity";

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
  passwordHash: string;
  role: UserRole;
  active: boolean;
};

type LoginMembershipRecord = {
  id: string;
  organizationId: string;
  role: OrganizationRole;
  status: MembershipStatus;
  updatedAt: Date;
  organization: { status: OrganizationStatus };
};

type LoginDependencies = {
  findUserByEmail?: (email: string) => Promise<LoginUserRecord | null>;
  findActiveMemberships?: (userId: string) => Promise<LoginMembershipRecord[]>;
  verifyPassword?: (password: string, passwordHash: string) => Promise<boolean>;
  isCellActive?: () => boolean | Promise<boolean>;
};

async function findUserByEmail(email: string) {
  return db.user.findUnique({ where: { email } });
}

export async function authenticateLogin(
  input: LoginInput,
  dependencies: LoginDependencies = {}
): Promise<LoginState | { user: SessionUser }> {
  const parsed = loginSchema.safeParse(input);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your login details." };
  }

  const cellIsActive = dependencies.isCellActive ?? isConfiguredCellRuntimeActive;
  if (!await cellIsActive()) return { error: "Customer cell is not active." };

  const lookupUser = dependencies.findUserByEmail ?? findUserByEmail;
  const lookupMemberships = dependencies.findActiveMemberships ?? findActiveLoginMemberships;
  const verifyPassword = dependencies.verifyPassword ?? verifyPasswordHash;
  const user = await lookupUser(parsed.data.email.toLowerCase());

  if (!user?.active || !user.passwordHash) {
    return { error: SAFE_LOGIN_ERROR };
  }

  const validPassword = await verifyPassword(parsed.data.password, user.passwordHash);

  if (!validPassword) {
    return { error: SAFE_LOGIN_ERROR };
  }

  const [membership] = await lookupMemberships(user.id);

  if (!membership || membership.status !== "ACTIVE" || membership.organization.status !== "ACTIVE") {
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
      sessionVersion: membershipSessionVersion(membership.updatedAt)
    }
  };
}
