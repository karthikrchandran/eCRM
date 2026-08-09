"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/server/db";
import {
  SESSION_COOKIE_NAME,
  shouldUseSecureSessionCookie,
  signSession
} from "@/server/auth/session";
import {
  getCurrentOrganizationContext,
  membershipSessionVersion
} from "./context";

const SWITCH_ERROR = "Unable to switch organization.";
const organizationIdSchema = z.string().trim().min(1);

export type SwitchOrganizationState =
  | { success: true }
  | { error: typeof SWITCH_ERROR };

export async function switchOrganizationAction(
  targetOrganizationId: string
): Promise<SwitchOrganizationState> {
  const parsedOrganizationId = organizationIdSchema.safeParse(targetOrganizationId);

  if (!parsedOrganizationId.success) {
    return { error: SWITCH_ERROR };
  }

  const currentContext = await getCurrentOrganizationContext();

  if (!currentContext) {
    return { error: SWITCH_ERROR };
  }

  const membership = await db.organizationMembership.findFirst({
    where: {
      organizationId: parsedOrganizationId.data,
      userId: currentContext.userId,
      status: "ACTIVE",
      organization: { status: "ACTIVE" },
      user: { active: true }
    },
    select: {
      id: true,
      userId: true,
      organizationId: true,
      role: true,
      status: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          active: true
        }
      },
      organization: {
        select: { status: true }
      }
    }
  });

  if (
    !membership ||
    membership.userId !== currentContext.userId ||
    membership.user.id !== currentContext.userId ||
    membership.organizationId !== parsedOrganizationId.data ||
    !membership.user.active ||
    membership.status !== "ACTIVE" ||
    membership.organization.status !== "ACTIVE"
  ) {
    return { error: SWITCH_ERROR };
  }

  const sessionVersion = membershipSessionVersion(membership.updatedAt);

  if (!Number.isSafeInteger(sessionVersion) || sessionVersion <= 0) {
    return { error: SWITCH_ERROR };
  }

  const token = await signSession({
    id: membership.userId,
    name: membership.user.name,
    email: membership.user.email,
    organizationId: membership.organizationId,
    membershipId: membership.id,
    role: membership.role,
    sessionVersion
  });
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureSessionCookie(),
    path: "/",
    maxAge: 60 * 60 * 8
  });
  revalidatePath("/", "layout");

  return { success: true };
}
