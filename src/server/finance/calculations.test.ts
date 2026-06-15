import { describe, expect, test } from "vitest";
import {
  calculateApprovedCostTotal,
  calculateGrossMargin,
  calculateIncentive,
  calculateIncentiveSplits,
  calculateInvoiceStatus,
  calculateInvoiceTotals,
  calculateOrderPaymentSummary,
  calculatePendingReceivable,
  calculateUninvoicedAmount
} from "./calculations";

describe("finance calculations", () => {
  test("calculates GST-inclusive invoice totals from subtotal and GST rate", () => {
    expect(calculateInvoiceTotals(100000, 1800)).toEqual({
      gstPaisa: 18000,
      subtotalPaisa: 100000,
      totalPaisa: 118000
    });
  });

  test("derives invoice payment status from allocated payments", () => {
    expect(calculateInvoiceStatus(118000, 0)).toBe("ISSUED");
    expect(calculateInvoiceStatus(118000, 50000)).toBe("PARTIALLY_PAID");
    expect(calculateInvoiceStatus(118000, 118000)).toBe("PAID");
  });

  test("summarizes cumulative order payment across split invoices and installments", () => {
    expect(
      calculateOrderPaymentSummary(
        100000,
        [{ totalPaisa: 60000 }, { totalPaisa: 40000 }],
        [{ amountPaisa: 25000 }, { amountPaisa: 75000 }]
      )
    ).toEqual({
      collectedPaisa: 100000,
      fullyPaid: true,
      invoiceTotalPaisa: 100000,
      pendingReceivablePaisa: 0,
      uninvoicedPaisa: 0
    });
  });

  test("clamps receivables and uninvoiced amount at zero", () => {
    expect(calculatePendingReceivable(100000, 120000)).toBe(0);
    expect(calculateUninvoicedAmount(100000, 125000)).toBe(0);
  });

  test("uses approved costs only for gross margin", () => {
    const approvedCostTotal = calculateApprovedCostTotal([
      { amountPaisa: 10000, status: "APPROVED" },
      { amountPaisa: 5000, status: "DRAFT" },
      { amountPaisa: 2000, status: "REJECTED" },
      { amountPaisa: 3000, status: "VOID" }
    ]);

    expect(approvedCostTotal).toBe(10000);
    expect(calculateGrossMargin(100000, approvedCostTotal)).toBe(90000);
  });

  test("calculates default 5 percent incentive and zeroes negative margin", () => {
    expect(calculateIncentive(90000)).toBe(4500);
    expect(calculateIncentive(-1000)).toBe(0);
  });

  test("calculates incentive splits and assigns rounding remainder to first stable recipient", () => {
    expect(calculateIncentiveSplits(10000, [{ userId: "owner", percent: 100 }])).toEqual([
      { amountPaisa: 10000, percent: 100, userId: "owner" }
    ]);

    expect(
      calculateIncentiveSplits(101, [
        { userId: "sales_b", percent: 50 },
        { userId: "sales_a", percent: 50 }
      ])
    ).toEqual([
      { amountPaisa: 51, percent: 50, userId: "sales_a" },
      { amountPaisa: 50, percent: 50, userId: "sales_b" }
    ]);
  });
});
