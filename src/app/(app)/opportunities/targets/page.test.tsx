import { describe, expect, it, vi } from "vitest";
import OpportunityTargetsPage from "./page";

vi.mock("@/components/opportunities/target-form", () => ({
  TargetForm: () => <div>target form</div>
}));

vi.mock("@/server/auth/current-user", () => ({
  requireUser: vi.fn()
}));

vi.mock("@/server/opportunities/actions", () => ({
  upsertSalesTargetAction: vi.fn()
}));

vi.mock("@/server/opportunities/queries", () => ({
  listOpportunityFormOptions: vi.fn().mockResolvedValue({ owners: [] }),
  listSalesTargets: vi.fn().mockResolvedValue([])
}));

describe("OpportunityTargetsPage", () => {
  it("loads target options for the authenticated organization user", async () => {
    const user = {
      id: "user_admin",
      name: "Admin",
      email: "admin@example.com",
      role: "ADMIN" as const,
      active: true,
      organizationId: "org_test",
      membershipId: "membership_test",
      sessionVersion: 1
    };
    const { requireUser } = await import("@/server/auth/current-user");
    const { listOpportunityFormOptions, listSalesTargets } = await import("@/server/opportunities/queries");

    vi.mocked(requireUser).mockResolvedValue(user);

    await OpportunityTargetsPage();

    expect(listOpportunityFormOptions).toHaveBeenCalledWith(user);
    expect(listSalesTargets).toHaveBeenCalledWith(user);
  });
});
