import { render, screen } from "@testing-library/react";
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
  });
});
