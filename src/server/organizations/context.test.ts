// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import type { MembershipStatus, OrganizationRole, OrganizationStatus } from "@prisma/client";
import { resolveOrganizationContext } from "./context";
import type { SessionUser } from "@/server/auth/session";

const updatedAt = new Date("2026-08-09T12:00:00.000Z");
const session: SessionUser = {
  id: "user_1",
  email: "admin@example.com",
  name: "Admin User",
  organizationId: "org_1",
  membershipId: "membership_1",
  role: "OWNER",
  sessionVersion: updatedAt.getTime()
};

type MembershipRecord = {
  id: string;
  userId: string;
  organizationId: string;
  role: OrganizationRole;
  status: MembershipStatus;
  updatedAt: Date;
  user: { id: string; name: string; email: string; active: boolean };
  organization: { status: OrganizationStatus };
};

const activeMembership: MembershipRecord = {
  id: "membership_1",
  userId: "user_1",
  organizationId: "org_1",
  role: "FINANCE" as const,
  status: "ACTIVE" as const,
  updatedAt,
  user: {
    id: "user_1",
    name: "Admin User",
    email: "admin@example.com",
    active: true
  },
  organization: { status: "ACTIVE" as const }
};

function resolve(record: MembershipRecord | null, claims = session) {
  return resolveOrganizationContext(claims, {
    findMembershipById: vi.fn().mockResolvedValue(record)
  });
}

describe("resolveOrganizationContext", () => {
  it("accepts an active user membership in an active organization and refreshes the role from the database", async () => {
    await expect(resolve(activeMembership)).resolves.toEqual({
      userId: "user_1",
      name: "Admin User",
      email: "admin@example.com",
      organizationId: "org_1",
      membershipId: "membership_1",
      role: "FINANCE",
      sessionVersion: updatedAt.getTime()
    });
  });

  it.each([
    ["membership id", { id: "membership_other" }],
    ["user id", { userId: "user_other" }],
    ["organization id", { organizationId: "org_other" }]
  ])("rejects a tampered %s combination without distinguishing the mismatch", async (_label, changes) => {
    await expect(resolve({ ...activeMembership, ...changes })).resolves.toBeNull();
  });

  it("returns null for an unknown membership", async () => {
    await expect(resolve(null)).resolves.toBeNull();
  });

  it.each(["INVITED", "SUSPENDED", "REVOKED"] as const)(
    "rejects a %s membership",
    async (status) => {
      await expect(resolve({ ...activeMembership, status })).resolves.toBeNull();
    }
  );

  it.each(["PROVISIONING", "SUSPENDED", "OFFBOARDING", "DELETED"] as const)(
    "rejects a %s organization",
    async (status) => {
      await expect(
        resolve({ ...activeMembership, organization: { status } })
      ).resolves.toBeNull();
    }
  );

  it("rejects an inactive user", async () => {
    await expect(
      resolve({ ...activeMembership, user: { ...activeMembership.user, active: false } })
    ).resolves.toBeNull();
  });

  it("rejects a stale session version after authoritative membership state changes", async () => {
    await expect(
      resolve({ ...activeMembership, updatedAt: new Date(updatedAt.getTime() + 1) })
    ).resolves.toBeNull();
  });

  it("uses live safe user fields instead of stale token profile claims", async () => {
    await expect(
      resolve(
        {
          ...activeMembership,
          user: { ...activeMembership.user, name: "Updated Name", email: "updated@example.com" }
        },
        { ...session, name: "Stale Name", email: "stale@example.com", role: "READ_ONLY" }
      )
    ).resolves.toMatchObject({
      name: "Updated Name",
      email: "updated@example.com",
      role: "FINANCE"
    });
  });
});
