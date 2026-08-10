import { describe, expect, it, vi } from "vitest";
import { createOpportunity, moveOpportunityStage, upsertSalesTarget } from "./mutations";

const actor = { id: "user_sales", organizationId: "org_test", role: "SALES" as const };

const opportunityInput = {
  leadCustomerId: "lead_1",
  branchId: "branch_1",
  stageId: "stage_qualified",
  ownerId: "user_sales",
  title: "eLearning rollout",
  productInterest: "Custom LMS",
  estimatedValueInr: "125000.00",
  probability: 60,
  notes: "Needs proposal"
};

describe("opportunity mutations", () => {
  it("validates the owner and every split through the tenant transaction guard", async () => {
    const query = vi.fn().mockResolvedValue([{ allowed: true }]);
    const userLookup = vi.fn();
    const opportunityCreate = vi.fn().mockResolvedValue({ id: "opp_guarded" });

    await createOpportunity(actor, opportunityInput, [
      { userId: "user_sales", percent: 70 },
      { userId: "user_admin", percent: 30 }
    ], {
      $queryRaw: query,
      user: { findFirst: userLookup },
      leadCustomer: { findFirst: vi.fn().mockResolvedValue({ id: "lead_1" }) },
      branch: { findFirst: vi.fn().mockResolvedValue({ id: "branch_1" }) },
      pipelineStage: { findFirst: vi.fn().mockResolvedValue({ id: "stage_qualified" }) },
      opportunity: { create: opportunityCreate },
      opportunityOwnerSplit: { createMany: vi.fn(), deleteMany: vi.fn() }
    } as never);

    expect(query).toHaveBeenCalledTimes(3);
    expect(userLookup).not.toHaveBeenCalled();
    expect(opportunityCreate).toHaveBeenCalledOnce();
  });

  it("creates an opportunity with actor metadata and owner splits", async () => {
    const opportunityCreate = vi.fn().mockResolvedValue({ id: "opp_1" });
    const splitCreateMany = vi.fn().mockResolvedValue({ count: 2 });

    await createOpportunity(
      actor,
      opportunityInput,
      [
        { userId: "user_sales", percent: 70 },
        { userId: "user_admin", percent: 30 }
      ],
      {
        $queryRaw: vi.fn().mockResolvedValue([{ allowed: true }]),
        leadCustomer: { findFirst: vi.fn().mockResolvedValue({ id: "lead_1" }) },
        branch: { findFirst: vi.fn().mockResolvedValue({ id: "branch_1" }) },
        pipelineStage: { findFirst: vi.fn().mockResolvedValue({ id: "stage_qualified" }) },
        opportunity: { create: opportunityCreate },
        opportunityOwnerSplit: { createMany: splitCreateMany, deleteMany: vi.fn() },
        $transaction: async (callback: (tx: unknown) => Promise<{ id: string }>) =>
          callback({
            opportunity: { create: opportunityCreate },
            opportunityOwnerSplit: { createMany: splitCreateMany, deleteMany: vi.fn() }
          })
      }
    );

    expect(opportunityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org_test",
        leadCustomerId: "lead_1",
        branchId: "branch_1",
        stageId: "stage_qualified",
        ownerId: "user_sales",
        title: "eLearning rollout",
        createdById: "user_sales",
        updatedById: "user_sales"
      })
    });
    expect(splitCreateMany).toHaveBeenCalledWith({
      data: [
        { organizationId: "org_test", opportunityId: "opp_1", userId: "user_sales", percent: 70 },
        { organizationId: "org_test", opportunityId: "opp_1", userId: "user_admin", percent: 30 }
      ]
    });
  });

  it("rejects split totals that do not equal 100", async () => {
    await expect(
      createOpportunity(
        actor,
        opportunityInput,
        [{ userId: "user_sales", percent: 90 }],
        {
          $queryRaw: vi.fn().mockResolvedValue([{ allowed: true }]),
          leadCustomer: { findFirst: vi.fn().mockResolvedValue({ id: "lead_1" }) },
          branch: { findFirst: vi.fn().mockResolvedValue({ id: "branch_1" }) },
          pipelineStage: { findFirst: vi.fn().mockResolvedValue({ id: "stage_qualified" }) },
          opportunity: { create: vi.fn() },
          opportunityOwnerSplit: { createMany: vi.fn(), deleteMany: vi.fn() },
          $transaction: vi.fn()
        }
      )
    ).rejects.toThrow("Split percentages must total 100.");
  });

  it("rejects a branch outside the selected lead/customer", async () => {
    await expect(
      createOpportunity(actor, opportunityInput, [], {
        $queryRaw: vi.fn().mockResolvedValue([{ allowed: true }]),
        leadCustomer: { findFirst: vi.fn().mockResolvedValue({ id: "lead_1" }) },
        branch: { findFirst: vi.fn().mockResolvedValue(null) },
        pipelineStage: { findFirst: vi.fn().mockResolvedValue({ id: "stage_qualified" }) },
        opportunity: { create: vi.fn() },
        opportunityOwnerSplit: { createMany: vi.fn(), deleteMany: vi.fn() },
        $transaction: vi.fn()
      })
    ).rejects.toThrow("Choose a branch that belongs to this lead or customer.");
  });

  it("moves an opportunity to an active stage", async () => {
    const update = vi.fn().mockResolvedValue({ id: "opp_1", stageId: "stage_won" });

    await moveOpportunityStage(actor, "opp_1", "stage_won", {
      pipelineStage: { findFirst: vi.fn().mockResolvedValue({ id: "stage_won" }) },
      opportunity: { findFirst: vi.fn().mockResolvedValue({ id: "opp_1" }), update }
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: "opp_1" },
      data: { stageId: "stage_won", updatedById: "user_sales" }
    });
  });

  it("upserts quarterly sales targets by owner and period", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "target_1" });

    await upsertSalesTarget(
      actor,
      {
        ownerId: "user_sales",
        financialYear: 2026,
        quarter: 1,
        targetValueInr: "500000.00"
      },
      {
        $queryRaw: vi.fn().mockResolvedValue([{ allowed: true }]),
        salesTarget: { upsert }
      }
    );

    expect(upsert).toHaveBeenCalledWith({
      where: {
        organizationId_ownerId_financialYear_quarter: {
          organizationId: "org_test",
          ownerId: "user_sales",
          financialYear: 2026,
          quarter: 1
        }
      },
      update: { targetValueInr: "500000.00" },
      create: {
        organizationId: "org_test",
        ownerId: "user_sales",
        financialYear: 2026,
        quarter: 1,
        targetValueInr: "500000.00",
        createdById: "user_sales"
      }
    });
  });
});
