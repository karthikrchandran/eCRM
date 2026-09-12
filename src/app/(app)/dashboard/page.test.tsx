import { cleanup, render, screen, within } from "@testing-library/react";
import type { UserRole } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "./page";
import { requireUser } from "@/server/auth/current-user";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("@/server/auth/current-user", () => ({
  requireUser: vi.fn()
}));

vi.mock("@/server/reports/queries", () => ({
  getReportsOverview: vi.fn().mockResolvedValue({
    cockpit: {
      deliveryRisk: { blockedCount: 1, dueSoonCount: 1, overdueCount: 1, totalCount: 3 },
      followUpRisk: { overdueCount: 1, upcomingCount: 1 },
      trend: {
        hasHistory: true,
        months: [
          { bookedPaisa: 0, collectedPaisa: 0, label: "Mar" },
          { bookedPaisa: 100000, collectedPaisa: 50000, label: "Apr" }
        ]
      }
    },
    currency: "INR",
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
    finance: {
      receivablesAging: [{ bucket: "0-30", invoiceCount: 1, outstandingPaisa: 1652000 }]
    },
    sales: { followUpCompliance: { overdue: 1, upcoming: 1 } },
    recentOrders: [{ orderId: "order_1", orderNumber: "ORD-001", clientName: "Acme", bookedValuePaisa: 1400000 }],
    topBillings: [{ orderId: "order_1", orderNumber: "ORD-001", clientName: "Acme", bookedValuePaisa: 1400000 }],
    topClients: [{ clientId: "client_1", clientName: "Acme", orderCount: 1, bookedValuePaisa: 1400000 }]
  })
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DashboardPage", () => {
  const dashboardUsers: Array<{
    bookingHref: string;
    bookingLinkName: string;
    email: string;
    id: string;
    name: string;
    role: UserRole;
  }> = [
    { bookingHref: "/orders", bookingLinkName: "View orders", email: "admin@example.com", id: "admin", name: "Admin User", role: "ADMIN" },
    { bookingHref: "/performance", bookingLinkName: "View performance", email: "sales@example.com", id: "sales", name: "Sales User", role: "SALES" }
  ];

  it.each(dashboardUsers)("gives $role the same operations cockpit and existing drill-through links", async (user) => {
    vi.mocked(requireUser).mockResolvedValueOnce({ ...user, active: true });
    render(await DashboardPage());

    const health = screen.getByRole("region", { name: "Operations health" });
    const commercialAndCash = screen.getByRole("region", { name: "Commercial and cash" });
    const operatingDetail = screen.getByRole("region", { name: "Operating detail" });

    expect(within(health).getByText("Pipeline value")).toBeVisible();
    expect(within(health).getByText("Delivery risk")).toBeVisible();
    expect(within(health).getByRole("link", { name: "View pipeline health" })).toHaveAttribute("href", "/opportunities");
    expect(within(health).getByRole("link", { name: "View booking health" })).toHaveAttribute("href", user.bookingHref);
    expect(within(health).getByRole("link", { name: "View receivables health" })).toHaveAttribute("href", "/finance");
    expect(within(health).getByRole("link", { name: "View collections health" })).toHaveAttribute("href", "/finance");
    expect(within(health).getByRole("link", { name: "View delivery health" })).toHaveAttribute("href", "/production");
    expect(within(health).getByRole("link", { name: "View delivery health" })).toHaveClass("dashboard-cockpit-risk--critical");
    expect(within(health).getByRole("img", { name: "Booked trend" })).toBeVisible();
    expect(within(health).getByRole("img", { name: "Collections trend" })).toBeVisible();
    expect(within(health).getByRole("status", { name: "Six-month booked trend available. Increased by INR 1,000.00 from the prior month." })).toBeVisible();
    expect(within(health).getByRole("status", { name: "Six-month collections trend available. Increased by INR 500.00 from the prior month." })).toBeVisible();
    expect(within(health).getAllByRole("status", { name: "Not enough history yet." })).toHaveLength(3);
    expect(within(commercialAndCash).getByRole("img", { name: "Pipeline by stage" })).toBeVisible();
    expect(within(commercialAndCash).getByRole("img", { name: "Booked vs collected trend" })).toBeVisible();
    expect(within(commercialAndCash).getByRole("figure", { name: "Delivery risk" }).closest(".dashboard-cockpit-risk--critical")).not.toBeNull();
    expect(within(operatingDetail).getByRole("img", { name: "Receivables aging" })).toBeVisible();
    expect(within(operatingDetail).getByRole("heading", { name: "Recent bookings" })).toBeVisible();
    expect(within(operatingDetail).queryByRole("heading", { name: "Top bookings" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View delivery risk" })).toHaveAttribute("href", "/production");
    expect(screen.getByRole("link", { name: "View My Day" })).toHaveAttribute("href", "/my-day");
    expect(screen.getByRole("link", { name: user.bookingLinkName })).toHaveAttribute("href", user.bookingHref);
  });
});
