import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpportunityBoard } from "./opportunity-board";
import { OpportunityList } from "./opportunity-list";

const owner = { id: "user_sales", name: "Sales User", email: "sales@example.com", role: "SALES" as const };
const stage = { id: "stage_qualified", name: "Qualified", sortOrder: 20, kind: "OPEN" as const, active: true };
const opportunity = {
  id: "opp_1",
  leadCustomerId: "lead_1",
  branchId: "branch_1",
  stageId: stage.id,
  ownerId: owner.id,
  title: "Acme LMS rollout",
  productInterest: "Custom LMS",
  estimatedValueInr: { toString: () => "125000.50" },
  probability: 60,
  lastReachAt: new Date("2026-06-14T10:00:00.000Z"),
  nextFollowUpAt: new Date("2026-07-20T10:00:00.000Z"),
  notes: "Needs proposal",
  createdById: "user_admin",
  updatedById: "user_admin",
  createdAt: new Date("2026-06-15T10:00:00.000Z"),
  updatedAt: new Date("2026-06-15T11:00:00.000Z"),
  leadCustomer: { id: "lead_1", name: "Acme Learning Pvt Ltd", state: "LEAD" as const },
  branch: { id: "branch_1", name: "Bengaluru Branch", city: "Bengaluru", region: "Karnataka" },
  stage,
  owner,
  splits: [{ opportunityId: "opp_1", userId: owner.id, percent: 100, user: owner }]
};

describe("OpportunityList", () => {
  it("shows filters, view links, and dense opportunity rows", () => {
    render(
      <OpportunityList
        filters={{ q: "acme", ownerId: owner.id, stageId: stage.id, followUp: "upcoming", view: "list" }}
        owners={[owner]}
        records={[opportunity]}
        stages={[stage]}
      />
    );

    expect(screen.getByRole("heading", { name: "Opportunities" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Board" })).toHaveAttribute("href", expect.stringContaining("view=board"));
    expect(screen.getByRole("link", { name: "New opportunity" })).toHaveAttribute("href", "/opportunities/new");
    expect(screen.getByRole("link", { name: "Reset" })).toHaveAttribute("href", "/opportunities");
    expect(screen.getByText("Open pipeline")).toBeVisible();
    expect(screen.getByText("Weighted pipeline")).toBeVisible();
    expect(screen.getByText("Follow-ups scheduled")).toBeVisible();
    expect(screen.getByRole("link", { name: "Acme LMS rollout" })).toHaveAttribute("href", "/opportunities/opp_1");
    expect(screen.getByRole("link", { name: "Customer 360" })).toHaveAttribute("href", "/customer-360/lead_1");
    expect(screen.getByText("Acme Learning Pvt Ltd")).toBeVisible();
    expect(screen.getByText("Bengaluru Branch")).toBeVisible();
    expect(screen.getAllByText("Qualified")).toHaveLength(2);
    expect(screen.getAllByText("INR 1,25,000.50")).toHaveLength(2);
    expect(screen.getByText("60%")).toBeVisible();
    expect(screen.getByText("Custom LMS")).toBeVisible();
    expect(screen.getByText("Follow-up due")).toBeVisible();
  });
});

describe("OpportunityBoard", () => {
  it("renders active stages in sort order with grouped opportunities", () => {
    render(
      <OpportunityBoard
        recordsByStage={{ [stage.id]: [opportunity], stage_empty: [] }}
        stages={[
          { id: "stage_empty", name: "Lead", sortOrder: 10, kind: "OPEN", active: true },
          stage
        ]}
      />
    );

    expect(screen.getByRole("heading", { name: "Lead" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Qualified" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Acme LMS rollout" })).toHaveAttribute("href", "/opportunities/opp_1");
    expect(screen.getByText("No opportunities in this stage.")).toBeVisible();
  });
});
