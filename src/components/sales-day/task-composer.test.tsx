import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskComposer } from "./task-composer";

vi.mock("@/server/sales-day/actions", () => ({
  createSalesTaskAction: vi.fn()
}));

const lookups = {
  leadCustomers: [{ id: "lead_1", label: "Acme Learning" }],
  opportunities: [],
  proposals: [],
  orders: []
};

describe("TaskComposer", () => {
  it("keeps the add-task form in a modal until requested", () => {
    render(<TaskComposer lookups={lookups} />);

    expect(screen.getByRole("button", { name: "Add new task" })).toBeVisible();
    expect(screen.queryByLabelText("Task title")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add new task" }));

    expect(screen.getByRole("dialog", { name: "Add new task" })).toBeVisible();
    expect(screen.getByLabelText("Task title")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Close task dialog" }));
    expect(screen.queryByRole("dialog", { name: "Add new task" })).not.toBeInTheDocument();
  });
});
