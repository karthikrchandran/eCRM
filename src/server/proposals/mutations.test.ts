import { describe, expect, it, vi } from "vitest";
import { addProposalPdfMetadata, changeProposalStatus, createProposal } from "./mutations";

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

  it("stores proposal PDF metadata without storing binary content", async () => {
    const create = vi.fn().mockResolvedValue({ id: "pdf_1" });

    await addProposalPdfMetadata(
      actor,
      "proposal_1",
      {
        originalFileName: "proposal.pdf",
        storedFileName: "proposal-1.pdf",
        storageProvider: "local",
        storageKey: "proposals/proposal-1.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 250000,
        canvaDesignUrl: "https://www.canva.com/design/abc"
      },
      {
        proposal: { findUnique: vi.fn().mockResolvedValue({ id: "proposal_1", opportunityId: "opp_1" }) },
        proposalPdfAttachment: { create }
      }
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        proposalId: "proposal_1",
        originalFileName: "proposal.pdf",
        storedFileName: "proposal-1.pdf",
        storageProvider: "local",
        storageKey: "proposals/proposal-1.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 250000,
        sha256: undefined,
        canvaDesignUrl: "https://www.canva.com/design/abc",
        uploadedById: "user_sales"
      }
    });
  });

  it("sends a proposal only after line items and PDF metadata exist", async () => {
    const proposalUpdate = vi.fn().mockResolvedValue({ id: "proposal_1", status: "SENT" });
    const opportunityUpdate = vi.fn().mockResolvedValue({ id: "opp_1" });

    await changeProposalStatus(actor, "proposal_1", "SENT", {
      pipelineStage: { findFirst: vi.fn().mockResolvedValue({ id: "stage_proposal_sent" }) },
      proposal: {
        findUnique: vi.fn().mockResolvedValue({
          id: "proposal_1",
          opportunityId: "opp_1",
          status: "DRAFT",
          lineItems: [{ id: "line_1" }],
          pdfAttachments: [{ id: "pdf_1" }]
        }),
        update: proposalUpdate
      },
      opportunity: { update: opportunityUpdate }
    });

    expect(proposalUpdate).toHaveBeenCalledWith({
      where: { id: "proposal_1" },
      data: { status: "SENT", updatedById: "user_sales" }
    });
    expect(opportunityUpdate).toHaveBeenCalledWith({
      where: { id: "opp_1" },
      data: { stageId: "stage_proposal_sent", updatedById: "user_sales" }
    });
  });
});
