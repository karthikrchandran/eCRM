import type { CostComponentStatus, InvoiceStatus } from "@prisma/client";

type AmountRecord = {
  amountPaisa: number;
};

type InvoiceAmountRecord = {
  totalPaisa: number;
};

type CostAmountRecord = AmountRecord & {
  status: CostComponentStatus | "DRAFT" | "APPROVED" | "REJECTED" | "VOID";
};

type IncentiveSplitInput = {
  userId: string;
  percent: number;
};

export type IncentiveSplitAmount = IncentiveSplitInput & {
  amountPaisa: number;
};

export function calculateInvoiceTotals(subtotalPaisa: number, gstRateBps: number) {
  const gstPaisa = Math.round((subtotalPaisa * gstRateBps) / 10000);

  return {
    gstPaisa,
    subtotalPaisa,
    totalPaisa: subtotalPaisa + gstPaisa
  };
}

export function calculateInvoiceStatus(
  invoiceTotalPaisa: number,
  allocatedPaymentPaisa: number
): InvoiceStatus | "ISSUED" | "PARTIALLY_PAID" | "PAID" {
  if (allocatedPaymentPaisa >= invoiceTotalPaisa) {
    return "PAID";
  }

  if (allocatedPaymentPaisa > 0) {
    return "PARTIALLY_PAID";
  }

  return "ISSUED";
}

export function calculatePendingReceivable(orderTotalPaisa: number, cumulativePaidPaisa: number) {
  return Math.max(0, orderTotalPaisa - cumulativePaidPaisa);
}

export function calculateUninvoicedAmount(orderTotalPaisa: number, invoiceTotalPaisa: number) {
  return Math.max(0, orderTotalPaisa - invoiceTotalPaisa);
}

export function calculateOrderPaymentSummary(
  orderTotalPaisa: number,
  invoices: InvoiceAmountRecord[],
  payments: AmountRecord[]
): {
  collectedPaisa: number;
  fullyPaid: boolean;
  invoiceTotalPaisa: number;
  pendingReceivablePaisa: number;
  uninvoicedPaisa: number;
} {
  const invoiceTotalPaisa = invoices.reduce((total, invoice) => total + invoice.totalPaisa, 0);
  const collectedPaisa = payments.reduce((total, payment) => total + payment.amountPaisa, 0);

  return {
    collectedPaisa,
    fullyPaid: collectedPaisa >= orderTotalPaisa,
    invoiceTotalPaisa,
    pendingReceivablePaisa: calculatePendingReceivable(orderTotalPaisa, collectedPaisa),
    uninvoicedPaisa: calculateUninvoicedAmount(orderTotalPaisa, invoiceTotalPaisa)
  };
}

export function calculateApprovedCostTotal(costComponents: CostAmountRecord[]) {
  return costComponents
    .filter((cost) => cost.status === "APPROVED")
    .reduce((total, cost) => total + cost.amountPaisa, 0);
}

export function calculateGrossMargin(orderBookedValueExGstPaisa: number, approvedCostTotalPaisa: number) {
  return orderBookedValueExGstPaisa - approvedCostTotalPaisa;
}

export function calculateIncentive(grossMarginPaisa: number, rateBps = 500) {
  if (grossMarginPaisa <= 0) {
    return 0;
  }

  return Math.round((grossMarginPaisa * rateBps) / 10000);
}

export function calculateIncentiveSplits(incentiveAmountPaisa: number, splits: IncentiveSplitInput[]): IncentiveSplitAmount[] {
  const sortedSplits = [...splits].sort((left, right) => left.userId.localeCompare(right.userId));
  const calculated = sortedSplits.map((split) => ({
    ...split,
    amountPaisa: Math.floor((incentiveAmountPaisa * split.percent) / 100)
  }));
  const allocatedPaisa = calculated.reduce((total, split) => total + split.amountPaisa, 0);
  const remainderPaisa = incentiveAmountPaisa - allocatedPaisa;

  if (calculated[0]) {
    calculated[0].amountPaisa += remainderPaisa;
  }

  return calculated;
}
