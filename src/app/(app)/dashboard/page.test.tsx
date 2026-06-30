import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DashboardPage from "./page";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("@/server/auth/current-user", () => ({
  requireUser: vi.fn().mockResolvedValue({ id: "admin", name: "Admin User", email: "admin@example.com", role: "ADMIN" })
}));

    vi.mock("@/server/reports/queries", () => ({
  getReportsOverview: vi.fn().mockResolvedValue({
    dashboardMetrics: [
      { detail: "Open stages", label: "Open opportunities", value: "2" },
      { detail: "Open estimated value", label: "Pipeline value", value: "INR 20,90,000.00" },
      { detail: "Booked orders", label: "Booked value", value: "INR 14,000.00" },
      { detail: "Outstanding against order totals", label: "Pending receivables", value: "INR 16,520.00" },
      { detail: "Actual payment records", label: "Collected payments", value: "INR 0.00" },
      { detail: "Work not done or skipped", label: "Production pending", value: "3" },
      { detail: "Open future-dated activities", label: "Upcoming follow-ups", value: "0" }
    ],
    pendingProduction: [
      { workItemId: "work_1", orderNumber: "ORD-001", clientName: "Acme", productName: "eLearning" }
    ],
    pipelineByStage: [{ count: 2, stageId: "stage_1", stageName: "Qualified", valuePaisa: 2090000 }],
    upcomingFollowUps: [
      { activityId: "activity_1", clientName: "Acme", ownerName: "Sales User", subject: "Call back", dueAt: new Date("2026-06-25T10:00:00Z") }
    ],
    topBillings: [{ orderId: "order_1", orderNumber: "ORD-001", clientName: "Acme", bookedValuePaisa: 1400000 }],
    topClients: [{ clientId: "client_1", clientName: "Acme", orderCount: 1, bookedValuePaisa: 1400000 }]
  })
}));

describe("DashboardPage", () => {
  it("groups summary cards into business sections and removes GST wording from booked value", async () => {
    render(await DashboardPage());

    const sales = screen.getByRole("region", { name: "Sales overview" });
    const pipeline = screen.getByRole("region", { name: "Pipeline overview" });
    const orders = screen.getByRole("region", { name: "Orders overview" });
    const production = screen.getByRole("region", { name: "Production overview" });

    expect(within(sales).getByText("Upcoming follow-ups")).toBeVisible();
    expect(within(pipeline).getByText("Pipeline value")).toBeVisible();
    expect(within(orders).getByText("Booked orders")).toBeVisible();
    expect(within(orders).getByText("Pending receivables")).toBeVisible();
    expect(within(orders).getByText("Collected payments")).toBeVisible();
    expect(within(production).getByText("Production pending")).toBeVisible();
    expect(screen.queryByText("Booked value excl. GST")).not.toBeInTheDocument();
  });
});
