import { describe, expect, it, vi } from "vitest";
import { createOpportunity, moveOpportunityStage, upsertSalesTarget } from "./mutations";

const actor = { id: "user_sales", role: "SALES" as const };

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
        user: { findFirst: vi.fn().mockResolvedValue({ id: "user_sales" }) },
        leadCustomer: { findUnique: vi.fn().mockResolvedValue({ id: "lead_1" }) },
        branch: { findFirst: vi.fn().mockResolvedValue({ id: "branch_1" }) },
        pipelineStage: { findFirst: vi.fn().mockResolvedValue({ id: "stage_qualified" }) },
        opportunity: { create: opportunityCreate },
        opportunityOwnerSplit: { createMany: splitCreateMany, deleteMany: vi.fn() },
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            opportunity: { create: opportunityCreate },
            opportunityOwnerSplit: { createMany: splitCreateMany, deleteMany: vi.fn() }
          })
      }
    );

    expect(opportunityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
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
        { opportunityId: "opp_1", userId: "user_sales", percent: 70 },
        { opportunityId: "opp_1", userId: "user_admin", percent: 30 }
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
          user: { findFirst: vi.fn().mockResolvedValue({ id: "user_sales" }) },
          leadCustomer: { findUnique: vi.fn().mockResolvedValue({ id: "lead_1" }) },
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
        user: { findFirst: vi.fn().mockResolvedValue({ id: "user_sales" }) },
        leadCustomer: { findUnique: vi.fn().mockResolvedValue({ id: "lead_1" }) },
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
      opportunity: { update }
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
        user: { findFirst: vi.fn().mockResolvedValue({ id: "user_sales" }) },
        salesTarget: { upsert }
      }
    );

    expect(upsert).toHaveBeenCalledWith({
      where: {
        ownerId_financialYear_quarter: {
          ownerId: "user_sales",
          financialYear: 2026,
          quarter: 1
        }
      },
      update: { targetValueInr: "500000.00" },
      create: {
        ownerId: "user_sales",
        financialYear: 2026,
        quarter: 1,
        targetValueInr: "500000.00",
        createdById: "user_sales"
      }
    });
  });
});
