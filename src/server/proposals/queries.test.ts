import { describe, expect, it, vi } from "vitest";
import { getProposalDetail, listProposalsForOpportunity } from "./queries";

const sales = { id: "user_sales", organizationId: "org_test", role: "SALES" as const };

describe("proposal queries", () => {
  it("lists proposals for an opportunity with line and PDF metadata counts", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "proposal_1", title: "Acme LMS proposal" }]);

    await listProposalsForOpportunity(sales, "opp_1", {
      proposal: { findMany, findFirst: vi.fn() }
    });

    expect(findMany).toHaveBeenCalledWith({
      where: { opportunityId: "opp_1", organizationId: "org_test" },
      orderBy: [{ sequenceNumber: "desc" }],
      include: expect.any(Object)
    });
  });

  it("loads proposal detail by id", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "proposal_1", title: "Acme LMS proposal" });

    await getProposalDetail(sales, "proposal_1", {
      proposal: { findMany: vi.fn(), findFirst }
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "proposal_1", organizationId: "org_test" },
      include: expect.any(Object)
    });
  });
});
