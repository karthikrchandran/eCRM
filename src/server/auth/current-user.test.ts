// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentOrganizationContext: vi.fn()
}));

vi.mock("@/server/organizations/context", () => ({
  getCurrentOrganizationContext: mocks.getCurrentOrganizationContext
}));

import { getCurrentUser } from "./current-user";

describe("getCurrentUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when there is no live verified organization context", async () => {
    mocks.getCurrentOrganizationContext.mockResolvedValueOnce(null);

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("returns a compatible user shape with the verified live membership role", async () => {
    mocks.getCurrentOrganizationContext.mockResolvedValueOnce({
      userId: "user_1",
      name: "Updated Name",
      email: "updated@example.com",
      organizationId: "org_1",
      membershipId: "membership_1",
      role: "FINANCE",
      sessionVersion: 42
    });

    await expect(getCurrentUser()).resolves.toEqual({
      id: "user_1",
      name: "Updated Name",
      email: "updated@example.com",
      role: "FINANCE",
      active: true,
      organizationId: "org_1",
      membershipId: "membership_1",
      sessionVersion: 42
    });
  });
});
