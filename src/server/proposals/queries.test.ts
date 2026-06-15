import { describe, expect, it, vi } from "vitest";
import { getProposalDetail, listProposalsForOpportunity } from "./queries";

const sales = { id: "user_sales", role: "SALES" as const };

describe("proposal queries", () => {
  it("lists proposals for an opportunity with line and PDF metadata counts", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "proposal_1", title: "Acme LMS proposal" }]);

    await listProposalsForOpportunity(sales, "opp_1", {
      proposal: { findMany, findUnique: vi.fn() }
    });

    expect(findMany).toHaveBeenCalledWith({
      where: { opportunityId: "opp_1" },
      orderBy: [{ sequenceNumber: "desc" }],
      include: expect.any(Object)
    });
  });

  it("loads proposal detail by id", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "proposal_1", title: "Acme LMS proposal" });

    await getProposalDetail(sales, "proposal_1", {
      proposal: { findMany: vi.fn(), findUnique }
    });

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "proposal_1" },
      include: expect.any(Object)
    });
  });
});
