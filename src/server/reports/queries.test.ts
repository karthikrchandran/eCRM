import { describe, expect, test, vi } from "vitest";
import { getReportsOverview } from "./queries";

const admin = { id: "admin", email: "admin@example.com", name: "Admin User", role: "ADMIN" as const };
const sales = { id: "sales", email: "sales@example.com", name: "Sales User", role: "SALES" as const };

function createDatabase() {
  return {
    activity: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "activity_upcoming",
          dueAt: new Date("2026-08-10T10:00:00Z"),
          leadCustomer: { id: "client_acme", name: "Acme Learning" },
          owner: { id: "sales", name: "Sales User" },
          subject: "Follow up on expansion"
        }
      ])
    },
    opportunity: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "opp_open",
          estimatedValueInr: "2500.50",
          stage: { id: "stage_open", kind: "OPEN", name: "Qualified", sortOrder: 1 }
        },
        {
          id: "opp_won",
          estimatedValueInr: "9999.00",
          stage: { id: "stage_won", kind: "WON", name: "Won", sortOrder: 2 }
        }
      ])
    },
    order: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "order_acme_big",
          orderNumber: "ORD-2026-0002",
          status: "BOOKED",
          bookedAt: new Date("2026-08-02T10:00:00Z"),
          subtotalPaisa: 200000,
          totalPaisa: 236000,
          leadCustomer: { id: "client_acme", name: "Acme Learning" },
          owner: { id: "sales", name: "Sales User" },
          lineItems: [
            {
              id: "line_elearning",
              lineSubtotalPaisa: 200000,
              productNameSnapshot: "eLearning"
            }
          ],
          invoices: [{ id: "invoice_acme", totalPaisa: 236000 }],
          payments: [{ id: "payment_acme", amountPaisa: 100000 }]
        },
        {
          id: "order_beta",
          orderNumber: "ORD-2026-0001",
          status: "DELIVERED",
          bookedAt: new Date("2026-08-01T10:00:00Z"),
          subtotalPaisa: 100000,
          totalPaisa: 118000,
          leadCustomer: { id: "client_beta", name: "Beta Skills" },
          owner: { id: "admin", name: "Admin User" },
          lineItems: [
            {
              id: "line_vr",
              lineSubtotalPaisa: 100000,
              productNameSnapshot: "VR Simulation"
            }
          ],
          invoices: [{ id: "invoice_beta", totalPaisa: 118000 }],
          payments: [{ id: "payment_beta", amountPaisa: 118000 }]
        },
        {
          id: "order_cancelled",
          orderNumber: "ORD-2026-0003",
          status: "CANCELLED",
          bookedAt: new Date("2026-08-03T10:00:00Z"),
          subtotalPaisa: 900000,
          totalPaisa: 1062000,
          leadCustomer: { id: "client_acme", name: "Acme Learning" },
          owner: { id: "sales", name: "Sales User" },
          lineItems: [
            {
              id: "line_cancelled",
              lineSubtotalPaisa: 900000,
              productNameSnapshot: "Cancelled Product"
            }
          ],
          invoices: [],
          payments: []
        }
      ])
    },
    payment: {
      findMany: vi.fn().mockResolvedValue([
        { id: "payment_beta", amountPaisa: 118000, paymentDate: new Date("2026-08-04T10:00:00Z") },
        { id: "payment_acme", amountPaisa: 100000, paymentDate: new Date("2026-08-03T10:00:00Z") }
      ])
    },
    productionWorkItem: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "work_pending",
          dueAt: new Date("2026-08-20T10:00:00Z"),
          productNameSnapshot: "eLearning",
          status: "IN_PROGRESS",
          orderLineItem: {
            order: {
              orderNumber: "ORD-2026-0002",
              leadCustomer: { id: "client_acme", name: "Acme Learning" }
            }
          }
        },
        {
          id: "work_done",
          dueAt: null,
          productNameSnapshot: "VR Simulation",
          status: "DONE",
          orderLineItem: {
            order: {
              orderNumber: "ORD-2026-0001",
              leadCustomer: { id: "client_beta", name: "Beta Skills" }
            }
          }
        }
      ])
    }
  };
}

describe("reports overview", () => {
  test("allows Admin and Sales to load company-wide reports", async () => {
    await expect(getReportsOverview(admin, createDatabase())).resolves.toBeTruthy();
    await expect(getReportsOverview(sales, createDatabase())).resolves.toBeTruthy();
  });

  test("rejects roles without company-wide report visibility", async () => {
    await expect(getReportsOverview({ ...sales, role: "VIEWER" as never }, createDatabase())).rejects.toThrow(
      "You do not have permission to view reports."
    );
  });

  test("builds live dashboard and report summaries from landed models", async () => {
    const overview = await getReportsOverview(admin, createDatabase());

    expect(overview.dashboardMetrics).toEqual([
      { detail: "Opportunities in open stages", label: "Open opportunities", value: "1" },
      { detail: "Open estimated value", label: "Pipeline value", value: "INR 2,500.50" },
      { detail: "Excludes GST", label: "Booked value excl. GST", value: "INR 3,000.00" },
      { detail: "Outstanding against order totals", label: "Pending receivables", value: "INR 1,360.00" },
      { detail: "Actual payment records", label: "Collected payments", value: "INR 2,180.00" },
      { detail: "Work not done or skipped", label: "Production pending", value: "1" },
      { detail: "Open future-dated activities", label: "Upcoming follow-ups", value: "1" }
    ]);

    expect(overview.topClients).toEqual([
      { bookedValuePaisa: 200000, clientId: "client_acme", clientName: "Acme Learning", orderCount: 1 },
      { bookedValuePaisa: 100000, clientId: "client_beta", clientName: "Beta Skills", orderCount: 1 }
    ]);
    expect(overview.topProducts).toEqual([
      { bookedValuePaisa: 200000, lineItemCount: 1, orderCount: 1, productName: "eLearning" },
      { bookedValuePaisa: 100000, lineItemCount: 1, orderCount: 1, productName: "VR Simulation" }
    ]);
    expect(overview.topBillings[0]).toEqual({
      bookedValuePaisa: 200000,
      clientName: "Acme Learning",
      orderId: "order_acme_big",
      orderNumber: "ORD-2026-0002",
      ownerName: "Sales User",
      status: "BOOKED"
    });
    expect(overview.topBillings).not.toContainEqual(expect.objectContaining({ orderId: "order_cancelled" }));
    expect(overview.topProducts).not.toContainEqual(expect.objectContaining({ productName: "Cancelled Product" }));
    expect(overview.collections).toEqual({ collectedPaisa: 218000, paymentCount: 2, pendingReceivablePaisa: 136000 });
    expect(overview.pipelineByStage).toEqual([{ count: 1, stageId: "stage_open", stageName: "Qualified", valuePaisa: 250050 }]);
    expect(overview.pendingProduction).toEqual([
      {
        clientName: "Acme Learning",
        dueAt: new Date("2026-08-20T10:00:00Z"),
        orderNumber: "ORD-2026-0002",
        productName: "eLearning",
        status: "IN_PROGRESS",
        workItemId: "work_pending"
      }
    ]);
    expect(overview.upcomingFollowUps).toEqual([
      {
        activityId: "activity_upcoming",
        clientName: "Acme Learning",
        dueAt: new Date("2026-08-10T10:00:00Z"),
        ownerName: "Sales User",
        subject: "Follow up on expansion"
      }
    ]);
  });

  test("does not expose gross margin or incentive metrics", async () => {
    const overview = await getReportsOverview(admin, createDatabase());
    const labels = overview.dashboardMetrics.map((metric) => metric.label.toLowerCase());

    expect(labels.join(" ")).not.toContain("gross margin");
    expect(labels.join(" ")).not.toContain("incentive");
  });
});
