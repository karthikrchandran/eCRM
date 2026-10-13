import { describe, expect, it, vi } from "vitest";
import ProductionPage from "./page";

vi.mock("@/components/production/production-board", () => ({
  ProductionBoard: () => <div>production board</div>
}));

vi.mock("@/server/auth/current-user", () => ({
  requireUser: vi.fn()
}));

vi.mock("@/server/production/actions", () => ({
  updateProductionStageStatusAction: vi.fn()
}));

vi.mock("@/server/production/queries", () => ({
  listProductionFormOptions: vi.fn().mockResolvedValue({ owners: [] }),
  listProductionWorkItems: vi.fn().mockResolvedValue([])
}));

describe("ProductionPage", () => {
  it("loads production form options for the authenticated organization user", async () => {
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
    const { listProductionFormOptions, listProductionWorkItems } = await import("@/server/production/queries");

    vi.mocked(requireUser).mockResolvedValue(user);

    await ProductionPage();

    expect(listProductionWorkItems).toHaveBeenCalledWith(user);
    expect(listProductionFormOptions).toHaveBeenCalledWith(user);
  });
});
