import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContactDetail } from "./contact-detail";
import type { ContactDetailRecord } from "@/server/crm/queries";

const contact = {
  id: "contact_1",
  leadCustomerId: "lead_1",
  branchId: "branch_1",
  name: "Anita Rao",
  designation: "Head of Learning Operations",
  email: "anita.rao@example.com",
  phone: "+91 98765 43210",
  isPrimary: true,
  notes: "Prefers morning calls.",
  branch: { id: "branch_1", name: "Bengaluru Delivery Office", city: "Bengaluru", region: "Karnataka" },
  leadCustomer: { id: "lead_1", name: "Acme Learning Pvt Ltd" }
} as unknown as ContactDetailRecord;

describe("ContactDetail", () => {
  it("renders the dedicated contact page without contact-level insights", () => {
    render(<ContactDetail contact={contact} />);

    expect(screen.getByRole("heading", { name: "Anita Rao" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Acme Learning Pvt Ltd" })).toHaveAttribute("href", "/leads/lead_1");
    expect(screen.getByRole("link", { name: "Customer 360" })).toHaveAttribute("href", "/customer-360/lead_1");
    expect(screen.getByText(/Head of Learning Operations/)).toBeVisible();
    expect(screen.getByText("Prefers morning calls.")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Contact profile" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Lead context" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Recent contact activity" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Related opportunities" })).toBeNull();
  });
});
