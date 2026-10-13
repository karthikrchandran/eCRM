import { describe, expect, it, vi } from "vitest";
import OpportunityStagesPage from "./page";

vi.mock("@/components/opportunities/stage-form", () => ({
  StageForm: () => <div>stage form</div>
}));

vi.mock("@/server/auth/current-user", () => ({
  requireUser: vi.fn()
}));

vi.mock("@/server/opportunities/actions", () => ({
  upsertPipelineStageAction: vi.fn()
}));

vi.mock("@/server/opportunities/queries", () => ({
  listOpportunityFormOptions: vi.fn().mockResolvedValue({ stages: [] })
}));

describe("OpportunityStagesPage", () => {
  it("loads opportunity stages for the authenticated organization user", async () => {
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
    const { listOpportunityFormOptions } = await import("@/server/opportunities/queries");

    vi.mocked(requireUser).mockResolvedValue(user);

    await OpportunityStagesPage();

    expect(listOpportunityFormOptions).toHaveBeenCalledWith(user);
  });
});
