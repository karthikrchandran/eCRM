import { describe, expect, test } from "vitest";
import {
  costComponentInputSchema,
  costStatusInputSchema,
  incentiveApprovalInputSchema,
  incentiveSplitInputSchema,
  invoiceInputSchema,
  paymentInputSchema
} from "./validators";

describe("finance validators", () => {
  test("validates invoice numbers, dates, and paise amounts", () => {
    const parsed = invoiceInputSchema.safeParse({
      dueDate: "",
      gstPaisa: "18000",
      invoiceDate: "2026-08-01",
      invoiceNumber: " INV-1001 ",
      notes: "",
      orderId: "order_1",
      subtotalPaisa: "100000"
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success ? parsed.data : null).toEqual({
      gstPaisa: 18000,
      invoiceDate: new Date("2026-08-01"),
      invoiceNumber: "INV-1001",
      orderId: "order_1",
      subtotalPaisa: 100000
    });
    expect(invoiceInputSchema.safeParse({ invoiceNumber: "", invoiceDate: "bad", subtotalPaisa: 0, gstPaisa: -1 }).success).toBe(false);
  });

  test("validates payment allocation totals and modes", () => {
    expect(
      paymentInputSchema.safeParse({
        allocations: [
          { amountPaisa: "40000", invoiceId: "invoice_1" },
          { amountPaisa: "60000", invoiceId: "invoice_2" }
        ],
        amountPaisa: "100000",
        mode: "BANK_TRANSFER",
        orderId: "order_1",
        paymentDate: "2026-08-02",
        reference: "UTR-1"
      }).success
    ).toBe(true);

    expect(
      paymentInputSchema.safeParse({
        allocations: [{ amountPaisa: "50000", invoiceId: "invoice_1" }],
        amountPaisa: "100000",
        mode: "WIRE",
        orderId: "order_1",
        paymentDate: "2026-08-02"
      }).success
    ).toBe(false);
  });

  test("requires reasons for rejection and void transitions", () => {
    expect(costStatusInputSchema.safeParse({ status: "APPROVED" }).success).toBe(true);
    expect(costStatusInputSchema.safeParse({ status: "REJECTED", reason: "" }).success).toBe(false);
    expect(costStatusInputSchema.safeParse({ status: "VOID", reason: "Duplicate entry" }).success).toBe(true);
  });

  test("validates cost component fields", () => {
    expect(
      costComponentInputSchema.safeParse({
        amountPaisa: "25000",
        category: "External vendor",
        description: "Voiceover vendor",
        orderId: "order_1",
        orderLineItemId: ""
      }).success
    ).toBe(true);
    expect(costComponentInputSchema.safeParse({ amountPaisa: "-1", category: "", description: "", orderId: "" }).success).toBe(false);
  });

  test("requires incentive splits to total exactly 100 percent", () => {
    expect(
      incentiveSplitInputSchema.safeParse({
        splits: [
          { percent: "60", userId: "user_a" },
          { percent: "40", userId: "user_b" }
        ]
      }).success
    ).toBe(true);
    expect(incentiveSplitInputSchema.safeParse({ splits: [{ percent: "90", userId: "user_a" }] }).success).toBe(false);
  });

  test("requires override reason when overriding incentive amount", () => {
    expect(incentiveApprovalInputSchema.safeParse({ overrideAmountPaisa: "", overrideReason: "" }).success).toBe(true);
    expect(incentiveApprovalInputSchema.safeParse({ overrideAmountPaisa: "5000", overrideReason: "" }).success).toBe(false);
    expect(incentiveApprovalInputSchema.safeParse({ overrideAmountPaisa: "5000", overrideReason: "Strategic account" }).success).toBe(true);
  });
});
