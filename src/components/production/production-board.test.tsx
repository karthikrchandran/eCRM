import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProductionWorkItemRecord } from "@/server/production/queries";
import { ProductionBoard } from "./production-board";

const workItem = {
  id: "work_item_1",
  title: "ORD-0001 - Custom eLearning module",
  status: "IN_PROGRESS",
  productNameSnapshot: "Custom eLearning module",
  productCategorySnapshot: "eLearning",
  dueAt: new Date("2026-08-15T00:00:00.000Z"),
  orderLineItem: {
    order: {
      orderNumber: "ORD-0001",
      leadCustomer: { name: "Acme Learning", state: "KA" },
      branch: { name: "Bengaluru", city: "Bengaluru", region: "South" },
      owner: { id: "user_sales", name: "Priya Menon", email: "sales@example.com", role: "SALES" }
    }
  },
  productionTemplate: { id: "template_1", key: "elearning", name: "eLearning" },
  assignedTo: null,
  stageInstances: [
    {
      id: "stage_1",
      name: "Script",
      description: "Write the script",
      required: true,
      sortOrder: 10,
      status: "IN_PROGRESS",
      assignedTo: null,
      dueAt: null,
      completedAt: null,
      completedBy: null,
      skippedReason: null
    },
    {
      id: "stage_2",
      name: "Review",
      description: null,
      required: true,
      sortOrder: 20,
      status: "NOT_STARTED",
      assignedTo: null,
      dueAt: null,
      completedAt: null,
      completedBy: null,
      skippedReason: null
    }
  ],
  notes: []
} as unknown as ProductionWorkItemRecord;

describe("ProductionBoard", () => {
  it("renders production work as an inline-editing grid instead of kanban columns", () => {
    render(
      <ProductionBoard
        canManageConfig={true}
        owners={[{ id: "user_sales", name: "Priya Menon", email: "sales@example.com" }]}
        stageAction={vi.fn()}
        workItems={[workItem]}
      />
    );

    expect(screen.getByRole("columnheader", { name: "Product / service" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Inline stage edits" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Production config" })).toHaveAttribute("href", "/admin/production-config");
    expect(screen.getByRole("link", { name: "ORD-0001 - Custom eLearning module" })).toHaveAttribute("href", "/production/work_item_1");
    expect(screen.getAllByLabelText("Change status")[0]).toHaveDisplayValue("In progress");
  });

  it("hides the config entry point for non-admin users", () => {
    render(<ProductionBoard canManageConfig={false} owners={[]} stageAction={vi.fn()} workItems={[workItem]} />);

    expect(screen.queryByRole("link", { name: "Production config" })).not.toBeInTheDocument();
  });
});
