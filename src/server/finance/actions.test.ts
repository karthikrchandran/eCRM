import { describe, expect, test } from "vitest";
import {
  parseCostComponentFormForTest,
  parseIncentiveApprovalFormForTest,
  parseInvoiceFormForTest,
  parsePaymentFormForTest
} from "./actions";

describe("finance actions", () => {
  test("parses invoice form data", () => {
    const formData = new FormData();
    formData.set("orderId", "order_1");
    formData.set("invoiceNumber", "INV-1");
    formData.set("invoiceDate", "2026-08-01");
    formData.set("subtotalPaisa", "100000");
    formData.set("gstPaisa", "18000");

    const parsed = parseInvoiceFormForTest(formData);

    expect(parsed.ok).toBe(true);
    expect(parsed.ok ? parsed.data.totalPaisa : null).toBe(118000);
  });

  test("parses payment form allocation JSON", () => {
    const formData = new FormData();
    formData.set("orderId", "order_1");
    formData.set("paymentDate", "2026-08-02");
    formData.set("amountPaisa", "118000");
    formData.set("mode", "BANK_TRANSFER");
    formData.set("allocations", JSON.stringify([{ invoiceId: "invoice_1", amountPaisa: 118000 }]));

    const parsed = parsePaymentFormForTest(formData);

    expect(parsed.ok).toBe(true);
    expect(parsed.ok ? parsed.data.allocations : null).toEqual([{ invoiceId: "invoice_1", amountPaisa: 118000 }]);
  });

  test("parses cost and incentive approval forms", () => {
    const costForm = new FormData();
    costForm.set("orderId", "order_1");
    costForm.set("category", "External vendor");
    costForm.set("description", "Vendor");
    costForm.set("amountPaisa", "20000");

    expect(parseCostComponentFormForTest(costForm).ok).toBe(true);

    const approvalForm = new FormData();
    approvalForm.set("overrideAmountPaisa", "5000");
    approvalForm.set("overrideReason", "Strategic account");

    expect(parseIncentiveApprovalFormForTest(approvalForm).ok).toBe(true);
  });
});
