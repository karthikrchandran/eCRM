import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Customer360Workspace } from "./customer-360-workspace";

const lead = {
  id: "lead_1",
  name: "Northstar Learning Pvt Ltd",
  state: "LEAD" as const,
  industry: "Education",
  source: "Referral",
  notes: "Exploring a phased LMS modernization program.",
  createdAt: new Date("2026-06-15T10:00:00.000Z"),
  updatedAt: new Date("2026-06-20T10:00:00.000Z"),
  ownerId: "user_sales",
  createdById: "user_admin",
  updatedById: "user_admin",
  owner: { id: "user_sales", name: "Priya Menon", email: "sales@example.com", role: "SALES" as const },
  branches: [{ id: "branch_1", leadCustomerId: "lead_1", name: "Bengaluru Delivery Office", city: "Bengaluru", region: "Karnataka", country: "India", addressLine1: null, addressLine2: null, postalCode: null, gstin: null, locationHint: null, salesContext: "Primary learning operations", notes: null, createdAt: new Date("2026-06-15T10:00:00.000Z"), updatedAt: new Date("2026-06-15T10:00:00.000Z") }],
  contacts: [
    {
      id: "contact_1",
      leadCustomerId: "lead_1",
      branchId: "branch_1",
      name: "Anita Rao",
      designation: "Head of Learning Operations",
      email: "anita.rao@northstar.example",
      phone: "+91 98765 43210",
      isPrimary: true,
      notes: null,
      createdAt: new Date("2026-06-15T10:00:00.000Z"),
      updatedAt: new Date("2026-06-15T10:00:00.000Z"),
      branch: { id: "branch_1", name: "Bengaluru Delivery Office", city: "Bengaluru", region: "Karnataka" }
    }
  ],
  activities: [
    {
      id: "activity_1",
      leadCustomerId: "lead_1",
      branchId: "branch_1",
      contactId: "contact_1",
      ownerId: "user_sales",
      createdById: "user_admin",
      completedById: null,
      type: "FOLLOW_UP" as const,
      status: "OPEN" as const,
      subject: "Follow up on onboarding module requirements",
      body: null,
      occurredAt: null,
      dueAt: new Date("2026-06-20T10:00:00.000Z"),
      completedAt: null,
      createdAt: new Date("2026-06-15T10:00:00.000Z"),
      updatedAt: new Date("2026-06-15T10:00:00.000Z"),
      owner: { id: "user_sales", name: "Priya Menon" },
      contact: { id: "contact_1", name: "Anita Rao" },
      branch: { id: "branch_1", name: "Bengaluru Delivery Office" }
    }
  ],
  ownershipHistory: [
    {
      id: "history_1",
      leadCustomerId: "lead_1",
      fromOwnerId: "user_admin",
      toOwnerId: "user_sales",
      changedById: "user_admin",
      reason: "Assigned after referral qualification.",
      createdAt: new Date("2026-06-15T10:00:00.000Z"),
      fromOwner: { id: "user_admin", name: "Kavya Iyer" },
      toOwner: { id: "user_sales", name: "Priya Menon" },
      changedBy: { id: "user_admin", name: "Kavya Iyer" }
    }
  ]
};

const timeline = [
  {
    id: "note_1",
    kind: "text_note" as const,
    title: "Typed note",
    detail: "Customer wants a pilot outcome dashboard.",
    occurredAt: new Date("2026-06-21T09:00:00.000Z"),
    actor: "Priya Menon"
  },
  {
    id: "payment_1",
    kind: "payment" as const,
    title: "Payment received",
    occurredAt: new Date("2026-06-20T10:00:00.000Z"),
    amount: { currency: "INR", minorUnits: 53100000 },
    href: "/orders/order_1"
  },
  {
    id: "production_1",
    kind: "production" as const,
    title: "Production IN_PROGRESS: Build module",
    occurredAt: new Date("2026-06-19T10:00:00.000Z"),
    href: "/production"
  },
  {
    id: "activity_1",
    kind: "follow_up" as const,
    title: "Follow up: Requirements call",
    detail: "FOLLOW_UP | OPEN",
    occurredAt: new Date("2026-06-18T10:00:00.000Z"),
    actor: "Priya Menon",
    href: "/leads/lead_1"
  }
];

describe("Customer360Workspace", () => {
  it("renders the split command view with profile, contacts, open work, and a filterable timeline", () => {
    render(<Customer360Workspace lead={lead} timeline={timeline} />);

    expect(screen.getByRole("heading", { name: "Customer profile" })).toBeVisible();
    expect(screen.getByText("Owned by Priya Menon")).toBeVisible();
    expect(screen.getByText("Anita Rao")).toBeVisible();
    expect(screen.getByText("Follow up on onboarding module requirements")).toBeVisible();
    expect(screen.getByRole("button", { name: "All 4" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Payment received")).toBeVisible();
    expect(screen.getByText("Production IN_PROGRESS: Build module")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Notes 1" }));

    expect(screen.getByRole("button", { name: "Notes 1" })).toHaveAttribute("aria-pressed", "true");
    const stream = screen.getByRole("region", { name: "Customer activity stream" });
    expect(within(stream).getByText("Customer wants a pilot outcome dashboard.")).toBeVisible();
    expect(within(stream).queryByText("Payment received")).not.toBeInTheDocument();
  });
});
