import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState, MetricStrip, PageHeader, RoleBadge, StatusBadge } from "./sales-primitives";

describe("sales UI primitives", () => {
  it("renders admin and sales role badges with distinct labels", () => {
    render(
      <div>
        <RoleBadge role="ADMIN" />
        <RoleBadge role="SALES" />
      </div>
    );

    expect(screen.getByText("Admin")).toBeVisible();
    expect(screen.getByText("Sales")).toBeVisible();
  });

  it("renders a page header with primary actions", () => {
    render(
      <PageHeader
        actions={<button className="crm-button crm-button-primary" type="button">Add one lead</button>}
        eyebrow="Sales"
        title="Leads"
        description="Manage company-wide lead intake."
      />
    );

    expect(screen.getByText("Sales")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Leads" })).toBeVisible();
    expect(screen.getByText("Manage company-wide lead intake.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Add one lead" })).toHaveClass("crm-button-primary");
  });

  it("renders metric strip label, value, and detail", () => {
    render(<MetricStrip metrics={[{ label: "Open leads", value: "12", detail: "3 need follow-up" }]} />);

    expect(screen.getByText("Open leads")).toBeVisible();
    expect(screen.getByText("12")).toBeVisible();
    expect(screen.getByText("3 need follow-up")).toBeVisible();
  });

  it("renders status badges and empty states", () => {
    render(
      <div>
        <StatusBadge tone="success">Active</StatusBadge>
        <EmptyState title="No matching leads" description="Change filters or add a lead." />
      </div>
    );

    expect(screen.getByText("Active")).toBeVisible();
    expect(screen.getByRole("heading", { name: "No matching leads" })).toBeVisible();
    expect(screen.getByText("Change filters or add a lead.")).toBeVisible();
  });
});
