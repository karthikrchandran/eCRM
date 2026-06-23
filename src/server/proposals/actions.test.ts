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

  it("parses manually entered USD tax from line item rows", () => {
    const formData = new FormData();
    formData.append("productServiceId", "product_1");
    formData.append("lineDescription", " Custom module ");
    formData.append("quantity", "2");
    formData.append("unitPricePaisa", "100000");
    formData.append("gstRateBps", "0");
    formData.append("manualTaxPaisa", "8875");
    formData.append("gstOverrideReason", "Manual USD tax");

    expect(parseProposalLinesFormForTest(formData)).toEqual([
      {
        productServiceId: "product_1",
        description: "Custom module",
        quantity: 2,
        unitPricePaisa: 100000,
        gstRateBps: 0,
        manualTaxPaisa: 8875,
        gstOverrideReason: "Manual USD tax"
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

  it("parses proposal document link forms", () => {
    const formData = new FormData();
    formData.set("originalFileName", " Acme proposal ");
    formData.set("documentUrl", "https://example.com/proposals/acme.pdf");
    formData.set("storageProvider", "sharepoint");
    formData.set("canvaDesignUrl", "https://www.canva.com/design/abc");

    expect(parseProposalPdfMetadataFormForTest(formData)).toEqual({
      ok: true,
      data: {
        originalFileName: "Acme proposal",
        storedFileName: "Acme proposal",
        storageProvider: "sharepoint",
        storageKey: "https://example.com/proposals/acme.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 1,
        canvaDesignUrl: "https://www.canva.com/design/abc"
      }
    });
  });

  it("defaults proposal document link storage provider to external", () => {
    const formData = new FormData();
    formData.set("originalFileName", "Acme proposal");
    formData.set("documentUrl", "https://example.com/proposals/acme.pdf");

    expect(parseProposalPdfMetadataFormForTest(formData)).toEqual({
      ok: true,
      data: {
        originalFileName: "Acme proposal",
        storedFileName: "Acme proposal",
        storageProvider: "external",
        storageKey: "https://example.com/proposals/acme.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 1
      }
    });
  });

  it("rejects invalid proposal document URLs", () => {
    const formData = new FormData();
    formData.set("originalFileName", "Acme proposal");
    formData.set("documentUrl", "not-a-url");

    expect(parseProposalPdfMetadataFormForTest(formData)).toEqual({
      ok: false,
      fieldErrors: {
        documentUrl: ["Enter a valid proposal document URL."]
      }
    });
  });

  it("returns field errors for unsafe proposal document and Canva URL schemes", () => {
    const formData = new FormData();
    formData.set("originalFileName", "Acme proposal");
    formData.set("documentUrl", "javascript:alert(1)");
    formData.set("canvaDesignUrl", "file:///tmp/design.pdf");

    expect(parseProposalPdfMetadataFormForTest(formData)).toEqual({
      ok: false,
      fieldErrors: {
        documentUrl: ["Enter a valid proposal document URL."],
        canvaDesignUrl: ["Enter a valid Canva URL."]
      }
    });
  });

  it("rejects missing proposal document links", () => {
    const formData = new FormData();
    formData.set("originalFileName", "Acme proposal");

    expect(parseProposalPdfMetadataFormForTest(formData)).toEqual({
      ok: false,
      fieldErrors: {
        documentUrl: ["Enter a valid proposal document URL."]
      }
    });
  });
});
