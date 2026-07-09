import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SalesPerformance } from "./sales-performance";

const props = {
  filters: { financialYear: 2026, quarter: 1 },
  incentives: [
    {
      id: "incentive_1",
      calculatedAmountPaisa: 100000,
      approvedAt: null,
      approvedBy: null,
      overrideAmountPaisa: null,
      overrideBy: null,
      overrideAt: null,
      overrideReason: null,
      paidAt: null,
      paidBy: null,
      paymentReference: null,
      readinessReason: "Order is not fully paid.",
      rejectedAt: null,
      rejectedBy: null,
      rejectionReason: null,
      status: "NOT_READY" as const,
      payableAmountPaisa: 0,
      grossMarginPaisa: 200000,
      approvedCostTotalPaisa: 50000,
      rateBps: 500,
      createdAt: new Date("2026-06-20T00:00:00.000Z"),
      updatedAt: new Date("2026-06-20T00:00:00.000Z"),
      order: {
        id: "order_1",
        orderNumber: "ORD-2026-0001",
        bookedAt: new Date("2026-06-18T00:00:00.000Z"),
        currency: "INR",
        leadCustomer: { id: "lead_1", name: "Northstar Learning Pvt Ltd" },
        owner: { id: "user_sales", name: "Priya Menon", email: "sales@example.com", role: "SALES" as const },
        status: "IN_PRODUCTION",
        totalPaisa: 29500000
      },
      splits: []
    }
  ],
  orders: [
    {
      id: "order_1",
      orderNumber: "ORD-2026-0001",
      status: "IN_PRODUCTION" as const,
      bookedAt: new Date("2026-06-18T00:00:00.000Z"),
      currency: "INR",
      subtotalPaisa: 25000000,
      gstPaisa: 4500000,
      totalPaisa: 29500000,
      leadCustomer: { id: "lead_1", name: "Northstar Learning Pvt Ltd" },
      owner: { id: "user_sales", name: "Priya Menon", email: "sales@example.com", role: "SALES" as const },
      opportunity: { id: "opp_1", title: "Northstar LMS modernization" },
      invoices: [{ id: "invoice_1", totalPaisa: 29500000 }],
      payments: [{ id: "payment_1", amountPaisa: 14750000 }],
      costComponents: []
    }
  ]
};

describe("SalesPerformance", () => {
  it("shows bookings and incentives in one rep-focused view", () => {
    render(<SalesPerformance filters={props.filters as never} incentives={props.incentives as never} orders={props.orders as never} />);

    expect(screen.getByRole("heading", { name: "Sales performance" })).toBeVisible();
    expect(screen.getByText("Booked value")).toBeVisible();
    expect(screen.getAllByText("ORD-2026-0001")).toHaveLength(2);
    expect(screen.getByText("Incentives")).toBeVisible();
  });
});
