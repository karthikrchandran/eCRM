import { describe, expect, it, vi } from "vitest";
import { createProposal } from "./mutations";

const actor = { id: "user_sales", role: "SALES" as const };

const proposalInput = {
  opportunityId: "opp_1",
  title: "Acme LMS proposal",
  versionLabel: "V1",
  commercialSummary: "Commercial summary",
  assumptions: "Assumptions",
  inclusions: "Inclusions",
  exclusions: "Exclusions",
  paymentTerms: "50 percent advance",
  deliveryTimeline: "6 weeks",
  internalNotes: "Internal note"
};

const proposalLines = [
  {
    productServiceId: "product_1",
    description: "Custom eLearning module",
    quantity: 2,
    unitPricePaisa: 100_000,
    gstRateBps: 1800
  }
];

describe("proposal mutations", () => {
  it("creates a proposal for an OPEN opportunity with sequence number and line snapshots", async () => {
    const proposalCreate = vi.fn().mockResolvedValue({ id: "proposal_1" });

    await createProposal(actor, proposalInput, proposalLines, {
      opportunity: {
        findUnique: vi.fn().mockResolvedValue({
          id: "opp_1",
          stage: { kind: "OPEN", name: "Qualified" }
        })
      },
      proposal: {
        count: vi.fn().mockResolvedValue(1),
        create: proposalCreate
      },
      productService: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "product_1",
            name: "eLearning",
            category: "eLearning",
            defaultGstRateBps: 1800,
            active: true
          }
        ])
      }
    });

    expect(proposalCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        opportunityId: "opp_1",
        sequenceNumber: 2,
        subtotalPaisa: 200_000,
        gstPaisa: 36_000,
        totalPaisa: 236_000,
        createdById: "user_sales",
        updatedById: "user_sales",
        lineItems: {
          create: [
            expect.objectContaining({
              productServiceId: "product_1",
              productNameSnapshot: "eLearning",
              productCategorySnapshot: "eLearning",
              lineSubtotalPaisa: 200_000,
              lineGstPaisa: 36_000,
              lineTotalPaisa: 236_000
            })
          ]
        }
      })
    });
  });

  it("rejects new proposals for non-open opportunities", async () => {
    await expect(
      createProposal(actor, proposalInput, proposalLines, {
        opportunity: {
          findUnique: vi.fn().mockResolvedValue({
            id: "opp_1",
            stage: { kind: "LOST", name: "Lost" }
          })
        },
        proposal: { count: vi.fn(), create: vi.fn() },
        productService: { findMany: vi.fn() }
      })
    ).rejects.toThrow("Create proposals only for open opportunities.");
  });
});
