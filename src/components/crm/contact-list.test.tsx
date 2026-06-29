import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContactList } from "./contact-list";

describe("ContactList", () => {
  it("shows contact rows with lead, owner, and pipeline context", () => {
    render(
      <ContactList
        filters={{}}
        owners={[{ id: "user_sales", name: "Sales User", email: "sales@example.com", role: "SALES" }]}
        records={[
          {
            id: "contact_1",
            name: "Anita Rao",
            designation: "Head of Learning Operations",
            email: "anita.rao@example.com",
            phone: "+91 98765 43210",
            isPrimary: true,
            updatedAt: new Date("2026-06-20T10:00:00.000Z"),
            branch: { id: "branch_1", name: "Bengaluru Delivery Office", city: "Bengaluru", region: "Karnataka" },
            leadCustomer: {
              id: "lead_1",
              name: "Acme Learning Pvt Ltd",
              state: "LEAD",
              owner: { id: "user_sales", name: "Sales User", email: "sales@example.com", role: "SALES" },
              _count: { contacts: 2, opportunities: 1 }
            }
          }
        ]}
      />
    );

    expect(screen.getByRole("heading", { name: "Contacts" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Acme Learning Pvt Ltd" })).toHaveAttribute("href", "/leads/lead_1");
    expect(screen.getByRole("link", { name: "Anita Rao" })).toHaveAttribute("href", "/contacts/contact_1");
    expect(screen.getByText("Head of Learning Operations")).toBeVisible();
    expect(screen.getByText("Sales User")).toBeVisible();
    expect(screen.getByText("2 contacts")).toBeVisible();
    expect(screen.getByText("1 opportunity")).toBeVisible();
    expect(within(screen.getByRole("row", { name: /Anita Rao/ })).getByText("Primary")).toBeVisible();
  });

  it("shows an empty state when no contacts match", () => {
    render(
      <ContactList
        filters={{ q: "missing" }}
        owners={[{ id: "user_sales", name: "Sales User", email: "sales@example.com", role: "SALES" }]}
        records={[]}
      />
    );

    const emptyHeading = screen.getByRole("heading", { name: "No matching contacts" });
    const emptyState = emptyHeading.parentElement;

    if (!emptyState) {
      throw new Error("Expected empty state wrapper to exist");
    }

    expect(emptyHeading).toBeVisible();
    expect(within(emptyState).getByRole("link", { name: "Add lead/customer" })).toHaveAttribute("href", "/leads/new");
  });
});
