import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProposalForm } from "./proposal-form";

const products = [
  {
    id: "product_ele",
    name: "eLearning module",
    code: "ELRN",
    category: "eLearning",
    description: "Storyboard, voiceover, and course build",
    defaultGstRateBps: 1800,
    defaultProductionTemplateKey: "elearning",
    active: true,
    sortOrder: 10,
    createdAt: new Date("2026-06-15T10:00:00.000Z"),
    updatedAt: new Date("2026-06-15T10:00:00.000Z")
  }
];

describe("ProposalForm", () => {
  it("renders proposal header fields and a product-backed line item row", () => {
    render(<ProposalForm action={async () => ({ ok: false })} opportunityId="opp_1" products={products} submitLabel="Create proposal" />);

    expect(screen.getByLabelText("Proposal title")).toHaveAttribute("name", "title");
    expect(screen.getByLabelText("Version label")).toHaveAttribute("name", "versionLabel");
    expect(screen.getByLabelText("Valid until")).toHaveAttribute("name", "validUntil");
    expect(screen.getByLabelText("Commercial summary")).toHaveAttribute("name", "commercialSummary");
    expect(screen.getByLabelText("Assumptions")).toHaveAttribute("name", "assumptions");
    expect(screen.getByLabelText("Inclusions")).toHaveAttribute("name", "inclusions");
    expect(screen.getByLabelText("Exclusions")).toHaveAttribute("name", "exclusions");
    expect(screen.getByLabelText("Payment terms")).toHaveAttribute("name", "paymentTerms");
    expect(screen.getByLabelText("Delivery timeline")).toHaveAttribute("name", "deliveryTimeline");
    expect(screen.getByLabelText("Internal notes")).toHaveAttribute("name", "internalNotes");
    expect(screen.getByDisplayValue("opp_1")).toHaveAttribute("name", "opportunityId");

    expect(screen.getByRole("heading", { name: "Line items" })).toBeVisible();
    expect(screen.getByLabelText("Product or service")).toHaveAttribute("name", "productServiceId");
    expect(screen.getByRole("option", { name: "eLearning module - eLearning - GST 18%" })).toHaveValue("product_ele");
    expect(screen.getByLabelText("Line description")).toHaveAttribute("name", "lineDescription");
    expect(screen.getByLabelText("Quantity")).toHaveAttribute("name", "quantity");
    expect(screen.getByLabelText("Unit price paise")).toHaveAttribute("name", "unitPricePaisa");
    expect(screen.getByLabelText("GST basis points")).toHaveAttribute("name", "gstRateBps");
    expect(screen.getByLabelText("GST override reason")).toHaveAttribute("name", "gstOverrideReason");
    expect(screen.getByRole("button", { name: "Create proposal" })).toBeEnabled();
  });
});
