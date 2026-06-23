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
          dueAt: new Date("2026-09-10T10:00:00Z"),
          leadCustomer: { id: "client_acme", name: "Acme Learning" },
          owner: { id: "sales", name: "Sales User" },
          subject: "Follow up on expansion"
        },
        {
          id: "activity_overdue",
          dueAt: new Date("2026-08-05T10:00:00Z"),
          leadCustomer: { id: "client_acme", name: "Acme Learning" },
          owner: { id: "sales", name: "Sales User" },
          subject: "Send revised pricing"
        }
      ])
    },
    businessSettings: {
      findUnique: vi.fn().mockResolvedValue({ defaultCurrency: "USD" })
    },
    costComponent: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "cost_approved",
          amountPaisa: 25000,
          status: "APPROVED",
          category: "Vendor",
          orderId: "order_acme_big",
          order: {
            id: "order_acme_big",
            orderNumber: "ORD-2026-0002",
            currency: "USD",
            leadCustomer: { id: "client_acme", name: "Acme Learning" }
          }
        },
        {
          id: "cost_draft",
          amountPaisa: 5000,
          status: "DRAFT",
          category: "Rework",
          orderId: "order_acme_big",
          order: {
            id: "order_acme_big",
            orderNumber: "ORD-2026-0002",
            currency: "USD",
            leadCustomer: { id: "client_acme", name: "Acme Learning" }
          }
        }
      ])
    },
    incentive: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "incentive_ready",
          payableAmountPaisa: 10000,
          status: "READY_FOR_REVIEW",
          orderId: "order_acme_big",
          order: {
            id: "order_acme_big",
            orderNumber: "ORD-2026-0002",
            currency: "USD",
            leadCustomer: { id: "client_acme", name: "Acme Learning" }
          }
        },
        {
          id: "incentive_paid",
          payableAmountPaisa: 7000,
          status: "PAID",
          orderId: "order_beta",
          order: {
            id: "order_beta",
            orderNumber: "ORD-2026-0001",
            currency: "USD",
            leadCustomer: { id: "client_beta", name: "Beta Skills" }
          }
        }
      ])
    },
    invoice: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "invoice_acme",
          invoiceNumber: "INV-2026-0002",
          invoiceDate: new Date("2026-08-03T10:00:00Z"),
          dueDate: new Date("2026-08-15T10:00:00Z"),
          status: "ISSUED",
          totalPaisa: 236000,
          order: {
            id: "order_acme_big",
            orderNumber: "ORD-2026-0002",
            currency: "USD",
            leadCustomer: { id: "client_acme", name: "Acme Learning" },
            payments: [{ id: "payment_acme", amountPaisa: 100000 }]
          }
        },
        {
          id: "invoice_beta",
          invoiceNumber: "INV-2026-0001",
          invoiceDate: new Date("2026-08-02T10:00:00Z"),
          dueDate: new Date("2026-08-04T10:00:00Z"),
          status: "PAID",
          totalPaisa: 118000,
          order: {
            id: "order_beta",
            orderNumber: "ORD-2026-0001",
            currency: "USD",
            leadCustomer: { id: "client_beta", name: "Beta Skills" },
            payments: [{ id: "payment_beta", amountPaisa: 118000 }]
          }
        }
      ])
    },
    opportunity: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "opp_open",
          createdAt: new Date("2026-08-01T10:00:00Z"),
          leadCustomer: { id: "client_acme", name: "Acme Learning" },
          estimatedValueInr: "2500.50",
          owner: { id: "sales", name: "Sales User" },
          probability: 50,
          proposals: [{ id: "proposal_acme", status: "ACCEPTED" }],
          title: "Acme LMS rollout",
          stage: { id: "stage_open", kind: "OPEN", name: "Qualified", sortOrder: 1 }
        },
        {
          id: "opp_won",
          createdAt: new Date("2026-08-02T10:00:00Z"),
          leadCustomer: { id: "client_beta", name: "Beta Skills" },
          estimatedValueInr: "9999.00",
          owner: { id: "admin", name: "Admin User" },
          probability: 100,
          proposals: [],
          title: "Beta VR refresh",
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
          currency: "USD",
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
          currency: "USD",
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
          currency: "USD",
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
          stageInstances: [
            {
              id: "stage_instance_design",
              dueAt: new Date("2026-08-18T10:00:00Z"),
              name: "Design",
              status: "IN_PROGRESS",
              assignedTo: { id: "sales", name: "Sales User" },
              startedAt: new Date("2026-08-10T10:00:00Z"),
              completedAt: null
            }
          ],
          assignedTo: { id: "sales", name: "Sales User" },
          orderLineItem: {
            order: {
              id: "order_acme_big",
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
          stageInstances: [],
          assignedTo: null,
          orderLineItem: {
            order: {
              id: "order_beta",
              orderNumber: "ORD-2026-0001",
              leadCustomer: { id: "client_beta", name: "Beta Skills" }
            }
          }
        }
      ])
    },
    productService: {
      findMany: vi.fn().mockResolvedValue([
        { id: "product_elearning", name: "eLearning" },
        { id: "product_vr", name: "VR Simulation" }
      ])
    },
    user: {
      findMany: vi.fn().mockResolvedValue([
        { id: "admin", name: "Admin User", email: "admin@example.com" },
        { id: "sales", name: "Sales User", email: "sales@example.com" }
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

    expect(overview.currency).toBe("USD");
    expect(overview.dashboardMetrics).toEqual([
      { detail: "Opportunities in open stages", label: "Open opportunities", value: "1" },
      { detail: "Open estimated value", label: "Pipeline value", value: "USD 2,500.50" },
      { detail: "Excludes GST", label: "Booked value excl. GST", value: "USD 3,000.00" },
      { detail: "Outstanding against order totals", label: "Pending receivables", value: "USD 1,360.00" },
      { detail: "Actual payment records", label: "Collected payments", value: "USD 2,180.00" },
      { detail: "Work not done or skipped", label: "Production pending", value: "1" },
      { detail: "Open future-dated activities", label: "Upcoming follow-ups", value: "2" }
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
      clientId: "client_acme",
      clientName: "Acme Learning",
      orderId: "order_acme_big",
      orderNumber: "ORD-2026-0002",
      ownerId: "sales",
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
        orderId: "order_acme_big",
        orderNumber: "ORD-2026-0002",
        productName: "eLearning",
        status: "IN_PROGRESS",
        workItemId: "work_pending"
      }
    ]);
    expect(overview.upcomingFollowUps).toEqual([
      {
        activityId: "activity_overdue",
        clientName: "Acme Learning",
        dueAt: new Date("2026-08-05T10:00:00Z"),
        ownerName: "Sales User",
        subject: "Send revised pricing"
      },
      {
        activityId: "activity_upcoming",
        clientName: "Acme Learning",
        dueAt: new Date("2026-09-10T10:00:00Z"),
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

  test("applies shared report filters and builds upgraded report families", async () => {
    const database = createDatabase();
    const overview = await getReportsOverview(
      admin,
      database,
      {
        currency: "USD",
        customerId: "client_acme",
        dateFrom: "2026-08-01",
        dateTo: "2026-08-31",
        ownerId: "sales",
        productServiceId: "product_elearning",
        stageId: "stage_open",
        status: "BOOKED"
      },
      new Date("2026-08-30T12:00:00Z")
    );

    expect(database.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          bookedAt: { gte: new Date("2026-08-01T00:00:00.000Z"), lte: new Date("2026-08-31T23:59:59.999Z") },
          currency: "USD",
          leadCustomerId: "client_acme",
          ownerId: "sales",
          status: "BOOKED"
        })
      })
    );
    expect(database.opportunity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          leadCustomerId: "client_acme",
          ownerId: "sales",
          stageId: "stage_open"
        })
      })
    );

    expect(overview.filterOptions.owners).toEqual([
      { id: "admin", name: "Admin User", email: "admin@example.com" },
      { id: "sales", name: "Sales User", email: "sales@example.com" }
    ]);
    expect(overview.sales.weightedPipelinePaisa).toBe(125025);
    expect(overview.sales.winLoss).toEqual({ lost: 0, won: 1 });
    expect(overview.sales.proposalConversion).toEqual({ accepted: 1, total: 1 });
    expect(overview.sales.followUpCompliance).toEqual({ overdue: 1, upcoming: 1 });
    expect(overview.finance.receivablesAging).toEqual([
      { bucket: "0-30", invoiceCount: 1, outstandingPaisa: 136000 }
    ]);
    expect(overview.finance.invoiceStatus).toEqual([
      { count: 1, status: "ISSUED", totalPaisa: 236000 },
      { count: 1, status: "PAID", totalPaisa: 118000 }
    ]);
    expect(overview.finance.grossMargin).toEqual({ approvedCostPaisa: 25000, grossMarginPaisa: 275000, revenuePaisa: 300000 });
    expect(overview.finance.costLeakagePaisa).toBe(5000);
    expect(overview.finance.incentives).toEqual({ approvedPaisa: 0, paidPaisa: 7000, payablePaisa: 10000 });
    expect(overview.production.pendingByStage).toEqual([{ count: 1, stageName: "Design" }]);
    expect(overview.production.overdueCount).toBe(1);
    expect(overview.production.blockedCount).toBe(0);
    expect(overview.production.cycleTimeDays).toBe(20);
    expect(overview.production.workloadByAssignee).toEqual([{ assigneeId: "sales", assigneeName: "Sales User", count: 1 }]);
    expect(overview.customers.repeatCustomers).toEqual([{ clientId: "client_acme", clientName: "Acme Learning", orderCount: 1 }]);
    expect(overview.customers.dormantCustomers).toEqual([]);
    expect(overview.products.revenueAndMargin).toEqual([
      { grossMarginPaisa: 175000, productName: "eLearning", revenuePaisa: 200000 }
    ]);
  });
});
