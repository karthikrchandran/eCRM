import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrderFinanceSummary } from "./order-finance-summary";

vi.mock("@/server/finance/actions", () => ({
  approveIncentiveAction: vi.fn(),
  changeCostComponentStatusAction: vi.fn(),
  createCostComponentAction: vi.fn(),
  createInvoiceAction: vi.fn(),
  recordPaymentAction: vi.fn()
}));

const order = {
  id: "order_1",
  currency: "USD",
  subtotalPaisa: 100000,
  gstPaisa: 8213,
  totalPaisa: 108213,
  lineItems: [{ id: "line_1", productNameSnapshot: "LMS implementation" }]
};

const finance = {
  invoices: [
    {
      id: "invoice_1",
      invoiceNumber: "INV-1",
      totalPaisa: 108213,
      status: "ISSUED",
      invoiceDate: new Date("2026-08-01T00:00:00.000Z")
    }
  ],
  payments: [
    {
      id: "payment_1",
      amountPaisa: 50000,
      paymentDate: new Date("2026-08-02T00:00:00.000Z"),
      mode: "BANK_TRANSFER",
      reference: "WIRE-1"
    }
  ],
  costComponents: [],
  incentive: null
};

describe("OrderFinanceSummary", () => {
  it("renders a finance command center with normal USD money inputs", () => {
    render(<OrderFinanceSummary canManage finance={finance as never} order={order as never} />);

    expect(screen.getByRole("heading", { name: "Finance command center" })).toBeVisible();
    expect(screen.getByText("Receivable status")).toBeVisible();
    expect(screen.getByText("Payment coverage")).toBeVisible();
    expect(screen.getByLabelText("Manual tax amount (USD)")).toHaveAttribute("name", "taxAmount");
    expect(screen.getByLabelText("Payment amount (USD)")).toHaveAttribute("name", "amount");
    expect(screen.getByLabelText("Cost amount (USD)")).toHaveAttribute("name", "amount");
  });
});
