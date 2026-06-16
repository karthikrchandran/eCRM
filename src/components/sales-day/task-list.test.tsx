import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskList } from "./task-list";
import type { MyDayTaskRecord } from "@/server/sales-day/types";

vi.mock("@/server/sales-day/actions", () => ({
  cancelSalesTaskAction: vi.fn(),
  completeSalesTaskAction: vi.fn(),
  reopenSalesTaskAction: vi.fn()
}));

function task(overrides: Partial<MyDayTaskRecord>): MyDayTaskRecord {
  return {
    id: "task_1",
    title: "Call Acme Learning",
    description: "Discuss LMS proposal",
    type: "CALL",
    priority: "HIGH",
    status: "OPEN",
    source: "MANUAL",
    dueAt: new Date("2026-06-17T10:30:00.000Z"),
    completedAt: null,
    leadCustomer: { id: "lead_1", label: "Acme Learning" },
    opportunity: null,
    proposal: null,
    order: null,
    voiceNotes: [],
    ...overrides
  };
}

describe("TaskList", () => {
  it("renders completed tasks in a completed section with de-emphasis styling", () => {
    render(
      <TaskList
        completedTasks={[task({ id: "done", title: "Send proposal", status: "COMPLETED", completedAt: new Date() })]}
        openTasks={[]}
        overdueTasks={[]}
      />
    );

    expect(screen.getByRole("heading", { name: "Completed today" })).toBeVisible();
    const row = screen.getByTestId("sales-task-row-done");
    expect(row).toHaveClass("opacity-60");
    expect(row).toHaveClass("saturate-50");
    expect(row.className).toContain("blur");
    expect(within(row).getByRole("button", { name: "Reopen" })).toBeVisible();
  });

  it("renders open task action controls", () => {
    render(<TaskList completedTasks={[]} openTasks={[task({ id: "open_task" })]} overdueTasks={[]} />);

    const row = screen.getByTestId("sales-task-row-open_task");
    expect(within(row).getByRole("button", { name: "Complete" })).toBeVisible();
    expect(within(row).getByRole("button", { name: "Cancel" })).toBeVisible();
    expect(row).not.toHaveClass("opacity-60");
  });
});
