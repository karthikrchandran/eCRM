import { describe, expect, it, vi } from "vitest";
import { getOrderDetail, listOrders, loadAcceptedProposalForBooking } from "./queries";

const sales = { id: "user_sales", role: "SALES" as const };

describe("order booking queries", () => {
  it("lists orders with customer, owner, proposal, and line counts", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "order_1", orderNumber: "ORD-2026-0001" }]);

    await listOrders(sales, {}, {
      order: { findMany, findUnique: vi.fn() },
      proposal: { findFirst: vi.fn() }
    });

    expect(findMany).toHaveBeenCalledWith({
      orderBy: [{ bookedAt: "desc" }],
      where: {},
      include: expect.any(Object)
    });
  });

  it("loads order detail by id", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "order_1", orderNumber: "ORD-2026-0001" });

    await getOrderDetail(sales, "order_1", {
      order: { findMany: vi.fn(), findUnique },
      proposal: { findFirst: vi.fn() }
    });

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "order_1" },
      include: expect.any(Object)
    });
  });

  it("loads an accepted proposal with owner splits and production template keys", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "proposal_accepted",
      status: "ACCEPTED",
      opportunity: {
        id: "opp_1",
        splits: [{ percent: 100, user: { id: "user_sales", name: "Sales User", email: "sales@example.com", role: "SALES" } }]
      },
      lineItems: [
        {
          id: "line_1",
          productService: {
            id: "seed_product_elearning",
            defaultProductionTemplateKey: "elearning"
          }
        }
      ],
      pdfAttachments: [{ id: "pdf_1" }]
    });

    const proposal = await loadAcceptedProposalForBooking(sales, "proposal_accepted", {
      proposal: { findFirst }
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "proposal_accepted", status: "ACCEPTED" },
      include: expect.any(Object)
    });
    expect(proposal?.opportunity.splits).toHaveLength(1);
    expect(proposal?.opportunity.splits[0]?.percent).toBe(100);
    expect(proposal?.lineItems[0]?.productService.defaultProductionTemplateKey).toBe("elearning");
    expect(proposal?.pdfAttachments).toHaveLength(1);
  });

  it("returns null when the proposal is not accepted", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);

    const proposal = await loadAcceptedProposalForBooking(sales, "proposal_draft", {
      proposal: { findFirst }
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "proposal_draft", status: "ACCEPTED" },
      include: expect.any(Object)
    });
    expect(proposal).toBeNull();
  });
});
