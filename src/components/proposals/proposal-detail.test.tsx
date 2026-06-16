import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProposalDetail } from "./proposal-detail";

const owner = { id: "user_sales", name: "Sales User", email: "sales@example.com", role: "SALES" as const };
const proposal = {
  id: "proposal_1",
  opportunityId: "opp_1",
  title: "Acme LMS proposal",
  sequenceNumber: 2,
  versionLabel: "V2",
  status: "DRAFT" as const,
  currency: "INR",
  validUntil: new Date("2026-07-15T00:00:00.000Z"),
  commercialSummary: "Commercials for the first rollout.",
  assumptions: "Client provides SME availability.",
  inclusions: "Design and development.",
  exclusions: "Translation.",
  paymentTerms: "50 percent advance.",
  deliveryTimeline: "6 weeks.",
  internalNotes: "Keep margin review internal.",
  subtotalPaisa: 25000000,
  gstPaisa: 4500000,
  totalPaisa: 29500000,
  createdById: "user_sales",
  updatedById: "user_sales",
  createdAt: new Date("2026-06-15T10:00:00.000Z"),
  updatedAt: new Date("2026-06-15T11:00:00.000Z"),
  opportunity: {
    id: "opp_1",
    title: "Acme LMS rollout",
    leadCustomer: { id: "lead_1", name: "Acme Learning Pvt Ltd", state: "CUSTOMER" as const },
    branch: { id: "branch_1", name: "Bengaluru Branch", city: "Bengaluru", region: "Karnataka" },
    owner,
    stage: { id: "stage_qualified", name: "Qualified", kind: "OPEN" as const, sortOrder: 20 }
  },
  lineItems: [
    {
      id: "line_1",
      proposalId: "proposal_1",
      productServiceId: "product_ele",
      productNameSnapshot: "eLearning module",
      productCategorySnapshot: "eLearning",
      description: "Five interactive modules",
      quantity: 5,
      unitPricePaisa: 5000000,
      gstRateBps: 1800,
      gstOverrideReason: null,
      lineSubtotalPaisa: 25000000,
      lineGstPaisa: 4500000,
      lineTotalPaisa: 29500000,
      sortOrder: 0,
      productService: { id: "product_ele", name: "Edited catalog name", category: "eLearning", active: true }
    }
  ],
  pdfAttachments: [],
  createdBy: owner,
  updatedBy: owner
};

describe("ProposalDetail", () => {
  it("renders opportunity context, line snapshots, totals, status, and empty PDF state", () => {
    render(<ProposalDetail proposal={proposal} />);

    expect(screen.getByRole("heading", { name: "Acme LMS proposal" })).toBeVisible();
    expect(screen.getByText("DRAFT")).toBeVisible();
    expect(screen.getByText("Acme LMS rollout")).toBeVisible();
    expect(screen.getByText("Acme Learning Pvt Ltd")).toBeVisible();
    expect(screen.getByText("Bengaluru Branch")).toBeVisible();
    expect(screen.getByText("Sales User")).toBeVisible();
    expect(screen.getByText("eLearning module")).toBeVisible();
    expect(screen.getByText("Five interactive modules")).toBeVisible();
    expect(screen.getAllByText("INR 2,50,000.00")).toHaveLength(2);
    expect(screen.getByText("INR 45,000.00")).toBeVisible();
    expect(screen.getAllByText("INR 2,95,000.00")).toHaveLength(3);
    expect(screen.getByText("No proposal document linked yet.")).toBeVisible();
  });

  it("renders external proposal document and optional Canva links", () => {
    render(
      <ProposalDetail
        proposal={{
          ...proposal,
          pdfAttachments: [
            {
              id: "doc_1",
              originalFileName: "Acme proposal final",
              storageProvider: "sharepoint",
              storageKey: "https://example.com/proposals/acme-final.pdf",
              mimeType: "application/pdf",
              fileSizeBytes: 1,
              canvaDesignUrl: "https://www.canva.com/design/acme",
              uploadedAt: new Date("2026-06-16T10:00:00.000Z"),
              uploadedBy: { name: "Kavya Iyer", email: "admin@example.com" }
            }
          ]
        }}
      />
    );

    expect(screen.getByRole("heading", { name: "Proposal documents" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Open document" })).toHaveAttribute(
      "href",
      "https://example.com/proposals/acme-final.pdf"
    );
    expect(screen.getByRole("link", { name: "Open Canva design" })).toHaveAttribute("href", "https://www.canva.com/design/acme");
  });

  it("does not render open links for legacy path-like attachment metadata", () => {
    render(
      <ProposalDetail
        proposal={{
          ...proposal,
          pdfAttachments: [
            {
              id: "doc_1",
              originalFileName: "Legacy proposal metadata",
              storageProvider: "local",
              storageKey: "proposals/acme-final.pdf",
              mimeType: "application/pdf",
              fileSizeBytes: 1,
              canvaDesignUrl: "file:///tmp/acme-canva.pdf",
              uploadedAt: new Date("2026-06-16T10:00:00.000Z"),
              uploadedBy: { name: "Kavya Iyer", email: "admin@example.com" }
            }
          ]
        }}
      />
    );

    expect(screen.getByText("Legacy proposal metadata")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Open document" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open Canva design" })).not.toBeInTheDocument();
  });
});
