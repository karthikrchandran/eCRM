import { describe, expect, it } from "vitest";
import { parseProposalFormForTest, parseProposalLinesFormForTest, parseProposalPdfMetadataFormForTest } from "./actions";

describe("proposal actions", () => {
  it("parses proposal header and line item rows", () => {
    const formData = new FormData();
    formData.set("opportunityId", "opp_1");
    formData.set("title", " Acme LMS proposal ");
    formData.set("versionLabel", " V1 ");
    formData.append("productServiceId", "product_1");
    formData.append("lineDescription", " Custom module ");
    formData.append("quantity", "2");
    formData.append("unitPricePaisa", "100000");
    formData.append("gstRateBps", "1800");
    formData.append("gstOverrideReason", "");

    expect(parseProposalFormForTest(formData)).toMatchObject({
      ok: true,
      data: {
        opportunityId: "opp_1",
        title: "Acme LMS proposal",
        versionLabel: "V1"
      }
    });
    expect(parseProposalLinesFormForTest(formData)).toEqual([
      {
        productServiceId: "product_1",
        description: "Custom module",
        quantity: 2,
        unitPricePaisa: 100000,
        gstRateBps: 1800,
        gstOverrideReason: undefined
      }
    ]);
  });

  it("returns proposal validation errors", () => {
    const formData = new FormData();
    formData.set("opportunityId", "");
    formData.set("title", "");

    expect(parseProposalFormForTest(formData)).toEqual({
      ok: false,
      fieldErrors: {
        opportunityId: ["Choose an opportunity."],
        title: ["Enter a proposal title."]
      }
    });
  });

  it("parses PDF metadata forms", () => {
    const formData = new FormData();
    formData.set("originalFileName", " proposal.pdf ");
    formData.set("storedFileName", "proposal-1.pdf");
    formData.set("storageProvider", "local");
    formData.set("storageKey", "proposals/proposal-1.pdf");
    formData.set("mimeType", "application/pdf");
    formData.set("fileSizeBytes", "250000");
    formData.set("canvaDesignUrl", "https://www.canva.com/design/abc");

    expect(parseProposalPdfMetadataFormForTest(formData)).toEqual({
      ok: true,
      data: {
        originalFileName: "proposal.pdf",
        storedFileName: "proposal-1.pdf",
        storageProvider: "local",
        storageKey: "proposals/proposal-1.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 250000,
        canvaDesignUrl: "https://www.canva.com/design/abc"
      }
    });
  });
});
