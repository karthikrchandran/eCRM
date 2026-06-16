import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LeadList } from "./lead-list";

describe("LeadList", () => {
  it("shows company-wide lead rows with owner and next follow-up", () => {
    render(
      <LeadList
        filters={{}}
        owners={[{ id: "user_sales", name: "Sales User", email: "sales@example.com", role: "SALES" }]}
        records={[
          {
            id: "lead_1",
            name: "Acme Learning Pvt Ltd",
            state: "LEAD",
            industry: "Education",
            source: "Referral",
            updatedAt: new Date("2026-06-15T10:00:00.000Z"),
            owner: { id: "user_sales", name: "Sales User", email: "sales@example.com", role: "SALES" },
            branches: [{ id: "branch_1", name: "Bengaluru Branch" }],
            contacts: [{ id: "contact_1", name: "Anita Rao", isPrimary: true }],
            activities: [{ id: "activity_1", subject: "Call procurement", dueAt: new Date("2026-06-16T10:00:00.000Z") }],
            _count: { branches: 1, contacts: 1, activities: 1 }
          }
        ]}
      />
    );

    expect(screen.getByRole("link", { name: "Acme Learning Pvt Ltd" })).toHaveAttribute("href", "/leads/lead_1");
    expect(screen.getByText("Sales User")).toBeVisible();
    expect(screen.getByText("Call procurement")).toBeVisible();
    expect(screen.getByText("1 branch")).toBeVisible();
    expect(screen.getByText("1 contact")).toBeVisible();
    expect(screen.getByRole("link", { name: "Add one lead" })).toHaveAttribute("href", "/leads/new");
    expect(screen.getByRole("link", { name: "Import leads from CSV" })).toHaveAttribute("href", "/leads/import");
    expect(screen.getByText("Lead intake")).toBeVisible();
    expect(screen.getByText("Sales")).toBeVisible();
    expect(within(screen.getByRole("row", { name: /Acme Learning Pvt Ltd/ })).getByText("LEAD")).toBeVisible();
  });

  it("shows a polished empty state when no leads match", () => {
    render(
      <LeadList
        filters={{ q: "missing", ownerId: "user_sales" }}
        owners={[{ id: "user_sales", name: "Priya Menon", email: "sales@example.com", role: "SALES" }]}
        records={[]}
      />
    );

    const emptyHeading = screen.getByRole("heading", { name: "No matching leads" });
    const emptyState = emptyHeading.parentElement;

    if (!emptyState) {
      throw new Error("Expected empty state wrapper to exist");
    }

    expect(emptyHeading).toBeVisible();
    expect(screen.getByText("Change filters or add a lead to keep sales intake moving.")).toBeVisible();
    expect(within(emptyState).getByRole("link", { name: "Add one lead" })).toHaveAttribute("href", "/leads/new");
  });
});
