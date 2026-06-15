import { describe, expect, it, vi } from "vitest";
import { listOpportunities, listPipelineBoard } from "./queries";

const requester = {
  id: "user_sales",
  role: "SALES" as const
};

describe("opportunity queries", () => {
  it("does not restrict Sales visibility to owned opportunities", async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    await listOpportunities(
      requester,
      {},
      {
        opportunity: { findMany },
        pipelineStage: { findMany: vi.fn().mockResolvedValue([]) }
      }
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {}
      })
    );
  });

  it("applies explicit owner, stage, search, and follow-up filters only when requested", async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    await listOpportunities(
      requester,
      {
        ownerId: "user_admin",
        stageId: "stage_qualified",
        q: "acme",
        followUp: "upcoming"
      },
      {
        opportunity: { findMany },
        pipelineStage: { findMany: vi.fn().mockResolvedValue([]) }
      }
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ownerId: "user_admin",
          stageId: "stage_qualified",
          OR: [
            { title: { contains: "acme", mode: "insensitive" } },
            { productInterest: { contains: "acme", mode: "insensitive" } },
            { notes: { contains: "acme", mode: "insensitive" } },
            { leadCustomer: { name: { contains: "acme", mode: "insensitive" } } },
            { branch: { name: { contains: "acme", mode: "insensitive" } } }
          ]
        })
      })
    );
    expect(findMany.mock.calls[0][0].where.nextFollowUpAt.gte).toBeInstanceOf(Date);
  });

  it("returns active stages with board records grouped by stage", async () => {
    const stages = [
      { id: "stage_lead", name: "Lead", sortOrder: 10, kind: "OPEN", active: true },
      { id: "stage_won", name: "Won", sortOrder: 50, kind: "WON", active: true }
    ];
    const opportunities = [
      { id: "opp_1", stageId: "stage_lead", title: "eLearning" },
      { id: "opp_2", stageId: "stage_won", title: "Video" }
    ];

    const board = await listPipelineBoard(
      requester,
      {},
      {
        opportunity: { findMany: vi.fn().mockResolvedValue(opportunities) },
        pipelineStage: { findMany: vi.fn().mockResolvedValue(stages) }
      }
    );

    expect(board.stages).toEqual(stages);
    expect(board.recordsByStage.stage_lead).toEqual([opportunities[0]]);
    expect(board.recordsByStage.stage_won).toEqual([opportunities[1]]);
  });
});
