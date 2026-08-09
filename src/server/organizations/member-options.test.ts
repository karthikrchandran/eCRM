import { describe, expect, it, vi } from "vitest";
import { listOrganizationUserOptions } from "./member-options";

describe("organization user options", () => {
  it("returns only active users with active eligible memberships in the authoritative organization", async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    await listOrganizationUserOptions("org_A", ["ADMIN", "SALES"], {
      organizationMembership: { findMany }
    } as never);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org_A",
        status: "ACTIVE",
        role: { in: ["ADMIN", "SALES"] },
        user: { active: true }
      },
      orderBy: { user: { name: "asc" } },
      select: { user: { select: { email: true, id: true, name: true, role: true } } }
    });
  });
});
