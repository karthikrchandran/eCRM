import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProposalVersionList } from "./proposal-version-list";

const proposals = [
  {
    id: "proposal_2",
    opportunityId: "opp_1",
    sequenceNumber: 2,
    versionLabel: "V2",
    status: "ACCEPTED",
    updatedAt: new Date("2026-06-20T10:00:00.000Z"),
    totalPaisa: 29500000,
    currency: "INR",
    order: null
  },
  {
    id: "proposal_1",
    opportunityId: "opp_1",
    sequenceNumber: 1,
    versionLabel: "V1",
    status: "SENT",
    updatedAt: new Date("2026-06-18T10:00:00.000Z"),
    totalPaisa: 25000000,
    currency: "INR",
    order: { id: "order_1", orderNumber: "ORD-001" }
  }
];

describe("ProposalVersionList", () => {
  it("shows version history with manage-only actions", () => {
    render(<ProposalVersionList opportunityId="opp_1" proposals={proposals} />);

    expect(screen.getByRole("heading", { name: "Proposal versions" })).toBeVisible();
    expect(screen.getByRole("link", { name: /Version 2 - V2/ })).toHaveAttribute(
      "href",
      "/opportunities/opp_1/proposals/proposal_2"
    );
    expect(screen.getByRole("link", { name: "Create new version" })).toHaveAttribute(
      "href",
      "/opportunities/opp_1/proposals/new"
    );
    expect(screen.getByRole("link", { name: "Book order" })).toHaveAttribute(
      "href",
      "/opportunities/opp_1/proposals/proposal_2/book-order"
    );
    expect(screen.getByRole("link", { name: "View order ORD-001" })).toHaveAttribute("href", "/orders/order_1");
  });
});
