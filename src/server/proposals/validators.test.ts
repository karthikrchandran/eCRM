import { describe, expect, it } from "vitest";
import {
  assertProposalStatusTransition,
  proposalInputSchema,
  proposalLineInputSchema,
  proposalPdfMetadataInputSchema
} from "./validators";

describe("proposal validators", () => {
  it("normalizes proposal header input", () => {
    expect(
      proposalInputSchema.parse({
        opportunityId: "opp_1",
        title: " Acme LMS proposal ",
        versionLabel: " V1 ",
        commercialSummary: " Commercial summary ",
        validUntil: "2026-07-31"
      })
    ).toMatchObject({
      opportunityId: "opp_1",
      title: "Acme LMS proposal",
      versionLabel: "V1",
      commercialSummary: "Commercial summary",
      validUntil: new Date("2026-07-31")
    });
  });

  it("requires GST override reason when line GST differs from product default", () => {
    const result = proposalLineInputSchema.safeParse({
      productServiceId: "product_1",
      productDefaultGstRateBps: 1800,
      description: " Custom module ",
      quantity: "1",
      unitPricePaisa: "100000",
      gstRateBps: "0",
      gstOverrideReason: " "
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.gstOverrideReason).toContain("Enter a GST override reason.");
    }
  });

  it("validates PDF metadata for exported Canva PDFs", () => {
    expect(
      proposalPdfMetadataInputSchema.parse({
        originalFileName: " proposal.pdf ",
        storedFileName: "proposal-123.pdf",
        storageProvider: "local",
        storageKey: "proposals/proposal-123.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: "250000",
        canvaDesignUrl: " https://www.canva.com/design/abc "
      })
    ).toMatchObject({
      originalFileName: "proposal.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 250000,
      canvaDesignUrl: "https://www.canva.com/design/abc"
    });
  });

  it("requires line items and PDF metadata before SENT", () => {
    expect(() =>
      assertProposalStatusTransition("DRAFT", "SENT", {
        lineItemCount: 0,
        activePdfCount: 1
      })
    ).toThrow("Add at least one proposal line before sending.");

    expect(() =>
      assertProposalStatusTransition("DRAFT", "SENT", {
        lineItemCount: 1,
        activePdfCount: 0
      })
    ).toThrow("Upload proposal PDF metadata before sending.");
  });
});
