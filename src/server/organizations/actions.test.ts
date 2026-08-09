// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieSet: vi.fn(),
  findFirst: vi.fn(),
  getCurrentOrganizationContext: vi.fn(),
  revalidatePath: vi.fn(),
  signSession: vi.fn(),
  shouldUseSecureSessionCookie: vi.fn(() => true)
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: mocks.cookieSet }))
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/server/db", () => ({
  db: { organizationMembership: { findFirst: mocks.findFirst } }
}));
vi.mock("@/server/auth/session", () => ({
  SESSION_COOKIE_NAME: "ecrm_session",
  signSession: mocks.signSession,
  shouldUseSecureSessionCookie: mocks.shouldUseSecureSessionCookie
}));
vi.mock("./context", () => ({
  getCurrentOrganizationContext: mocks.getCurrentOrganizationContext,
  membershipSessionVersion: (updatedAt: Date) => updatedAt.getTime()
}));

import { switchOrganizationAction } from "./actions";

const currentContext = {
  userId: "user_1",
  name: "Admin User",
  email: "admin@example.com",
  organizationId: "org_current",
  membershipId: "membership_current",
  role: "OWNER" as const,
  sessionVersion: 1
};

const targetMembership = {
  id: "membership_target",
  userId: "user_1",
  organizationId: "org_target",
  role: "FINANCE" as const,
  status: "ACTIVE" as const,
  updatedAt: new Date("2026-08-09T13:00:00.000Z"),
  user: { id: "user_1", name: "Updated Name", email: "updated@example.com", active: true },
  organization: { status: "ACTIVE" as const }
};

describe("switchOrganizationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentOrganizationContext.mockResolvedValue(currentContext);
    mocks.signSession.mockResolvedValue("signed-target-session");
    mocks.shouldUseSecureSessionCookie.mockReturnValue(true);
  });

  it("rejects blank target ids before querying and leaves the prior session untouched", async () => {
    await expect(switchOrganizationAction(" ")).resolves.toEqual({
      error: "Unable to switch organization."
    });

    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated and unauthorized targets without changing the prior session", async () => {
    mocks.getCurrentOrganizationContext.mockResolvedValueOnce(null);
    await expect(switchOrganizationAction("org_target")).resolves.toEqual({
      error: "Unable to switch organization."
    });

    mocks.getCurrentOrganizationContext.mockResolvedValueOnce(currentContext);
    mocks.findFirst.mockResolvedValueOnce(null);
    await expect(switchOrganizationAction("org_target")).resolves.toEqual({
      error: "Unable to switch organization."
    });

    expect(mocks.cookieSet).not.toHaveBeenCalled();
    expect(mocks.signSession).not.toHaveBeenCalled();
  });

  it.each([
    ["SUSPENDED membership", { status: "SUSPENDED" }],
    ["inactive user", { user: { ...targetMembership.user, active: false } }],
    ["SUSPENDED organization", { organization: { status: "SUSPENDED" } }],
    ["cross-user membership", { userId: "user_other" }],
    ["cross-organization membership", { organizationId: "org_other" }]
  ])("defensively rejects %s returned by the data source", async (_label, changes) => {
    mocks.findFirst.mockResolvedValueOnce({ ...targetMembership, ...changes });

    await expect(switchOrganizationAction("org_target")).resolves.toEqual({
      error: "Unable to switch organization."
    });
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("issues a new secure session from database identity, membership, role, and version", async () => {
    mocks.findFirst.mockResolvedValueOnce(targetMembership);

    await expect(switchOrganizationAction("org_target")).resolves.toEqual({ success: true });

    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        organizationId: "org_target",
        userId: "user_1",
        status: "ACTIVE",
        organization: { status: "ACTIVE" },
        user: { active: true }
      }
    }));
    expect(mocks.signSession).toHaveBeenCalledWith({
      id: "user_1",
      name: "Updated Name",
      email: "updated@example.com",
      organizationId: "org_target",
      membershipId: "membership_target",
      role: "FINANCE",
      sessionVersion: targetMembership.updatedAt.getTime()
    });
    expect(mocks.cookieSet).toHaveBeenCalledWith("ecrm_session", "signed-target-session", {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 8
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
});
