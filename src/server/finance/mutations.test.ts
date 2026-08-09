import { describe, expect, test, vi } from "vitest";
import {
  approveIncentive,
  changeCostComponentStatus,
  createCostComponent,
  createInvoice,
  markIncentivePaid,
  recordPayment,
  rejectIncentive,
  updateIncentiveSplits,
  updateInvoice
} from "./mutations";

const admin = { id: "admin", organizationId: "org_test", role: "ADMIN" as const };
const sales = { id: "sales", organizationId: "org_test", role: "SALES" as const };

const order = {
  id: "order_1",
  ownerId: "sales",
  status: "BOOKED" as const,
  subtotalPaisa: 100000,
  gstPaisa: 18000,
  totalPaisa: 118000,
  invoices: [],
  payments: [],
  costComponents: [],
  splitSnapshots: [{ percent: 100, userId: "sales" }]
};

describe("finance mutations", () => {
  test("creates an invoice from server-owned totals and blocks cancelled orders", async () => {
    const create = vi.fn().mockResolvedValue({ id: "invoice_1" });

    await createInvoice(
      admin,
      { gstPaisa: 18000, invoiceDate: new Date("2026-08-01"), invoiceNumber: "INV-1", orderId: "order_1", subtotalPaisa: 100000 },
      {
        invoice: { create },
        order: { findUnique: vi.fn().mockResolvedValue(order) }
      }
    );

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        createdById: "admin",
        gstPaisa: 18000,
        orderId: "order_1",
        status: "ISSUED",
        subtotalPaisa: 100000,
        totalPaisa: 118000,
        updatedById: "admin"
      })
    });

    await expect(
      createInvoice(admin, { gstPaisa: 0, invoiceDate: new Date(), invoiceNumber: "INV-2", orderId: "order_1", subtotalPaisa: 1 }, {
        invoice: { create: vi.fn() },
        order: { findUnique: vi.fn().mockResolvedValue({ ...order, status: "CANCELLED" }) }
      })
    ).rejects.toThrow("Cancelled orders cannot accept finance changes.");
  });

  test("records payment, updates invoice status, and creates ready incentive after full payment", async () => {
    const paymentCreate = vi.fn().mockResolvedValue({ id: "payment_1" });
    const invoiceUpdate = vi.fn().mockResolvedValue({ id: "invoice_1" });
    const incentiveUpsert = vi.fn().mockResolvedValue({ id: "incentive_1" });
    const tx = {
      incentive: { upsert: incentiveUpsert },
      invoice: { update: invoiceUpdate },
      order: {
        findUnique: vi.fn().mockResolvedValue({
          ...order,
          invoices: [{ id: "invoice_1", totalPaisa: 118000, allocations: [] }]
        })
      },
      payment: { create: paymentCreate }
    };
    const database = { $transaction: vi.fn(async (callback) => callback(tx)) };

    await recordPayment(
      admin,
      {
        allocations: [{ amountPaisa: 118000, invoiceId: "invoice_1" }],
        amountPaisa: 118000,
        mode: "BANK_TRANSFER",
        orderId: "order_1",
        paymentDate: new Date("2026-08-02")
      },
      database
    );

    expect(paymentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        allocations: { create: [{ amountPaisa: 118000, invoiceId: "invoice_1", organizationId: "org_test" }] },
        amountPaisa: 118000,
        createdById: "admin",
        orderId: "order_1",
        organizationId: "org_test"
      })
    });
    expect(invoiceUpdate).toHaveBeenCalledWith({ where: { id: "invoice_1" }, data: { status: "PAID", updatedById: "admin" } });
    expect(incentiveUpsert).toHaveBeenCalledWith({
      where: { orderId: "order_1" },
      create: expect.objectContaining({
        calculatedAmountPaisa: 5000,
        payableAmountPaisa: 5000,
        status: "READY_FOR_REVIEW",
        splits: { create: [{ amountPaisa: 5000, percent: 100, userId: "sales", organizationId: "org_test" }] }
      }),
      update: expect.objectContaining({
        calculatedAmountPaisa: 5000,
        payableAmountPaisa: 5000,
        status: "READY_FOR_REVIEW"
      })
    });
  });

  test("blocks overpayment unless explicitly acknowledged", async () => {
    const tx = {
      incentive: { upsert: vi.fn() },
      invoice: { update: vi.fn() },
      order: {
        findUnique: vi.fn().mockResolvedValue({
          ...order,
          invoices: [{ id: "invoice_1", totalPaisa: 118000, allocations: [] }],
          payments: [{ amountPaisa: 100000 }]
        })
      },
      payment: { create: vi.fn() }
    };
    const database = { $transaction: vi.fn(async (callback) => callback(tx)) };

    await expect(
      recordPayment(
        admin,
        {
          allocations: [{ amountPaisa: 30000, invoiceId: "invoice_1" }],
          amountPaisa: 30000,
          mode: "BANK_TRANSFER",
          orderId: "order_1",
          paymentDate: new Date("2026-08-02")
        },
        database
      )
    ).rejects.toThrow("Payment total cannot exceed the order total.");
  });

  test("approves costs and recalculates incentive from approved-cost-only margin", async () => {
    const costCreate = vi.fn().mockResolvedValue({ id: "cost_1" });
    const incentiveUpsert = vi.fn().mockResolvedValue({ id: "incentive_1" });
    const tx = {
      costComponent: { create: costCreate },
      incentive: { upsert: incentiveUpsert },
      order: {
        findUnique: vi.fn().mockResolvedValue({
          ...order,
          costComponents: [{ amountPaisa: 20000, status: "APPROVED" }],
          invoices: [{ id: "invoice_1", totalPaisa: 118000, allocations: [{ amountPaisa: 118000 }] }],
          payments: [{ amountPaisa: 118000 }]
        })
      }
    };

    await createCostComponent(
      admin,
      { amountPaisa: 20000, category: "External vendor", description: "Vendor", orderId: "order_1" },
      { $transaction: vi.fn(async (callback) => callback(tx)) }
    );

    expect(costCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ amountPaisa: 20000, createdById: "admin", status: "DRAFT", updatedById: "admin" })
    });
    expect(incentiveUpsert).toHaveBeenCalledWith({
      where: { orderId: "order_1" },
      create: expect.objectContaining({ calculatedAmountPaisa: 4000, grossMarginPaisa: 80000 }),
      update: expect.objectContaining({ calculatedAmountPaisa: 4000, grossMarginPaisa: 80000 })
    });
  });

  test("updates invoices and handles cost approval rejection and void metadata", async () => {
    const invoiceUpdate = vi.fn().mockResolvedValue({ id: "invoice_1" });
    await updateInvoice(
      admin,
      "invoice_1",
      { gstPaisa: 9000, invoiceDate: new Date("2026-08-03"), invoiceNumber: "INV-1A", orderId: "order_1", subtotalPaisa: 50000 },
      { invoice: { create: vi.fn(), findFirst: vi.fn().mockResolvedValue({ id: "invoice_1" }), update: invoiceUpdate }, order: { findUnique: vi.fn().mockResolvedValue(order) } }
    );
    expect(invoiceUpdate).toHaveBeenCalledWith({
      where: { id: "invoice_1" },
      data: expect.objectContaining({ gstPaisa: 9000, invoiceNumber: "INV-1A", totalPaisa: 59000, updatedById: "admin" })
    });

    const costUpdate = vi.fn().mockResolvedValue({ id: "cost_1" });
    const incentiveUpsert = vi.fn().mockResolvedValue({ id: "incentive_1" });
    const tx = {
      costComponent: {
        findUnique: vi.fn().mockResolvedValue({ id: "cost_1", orderId: "order_1" }),
        update: costUpdate
      },
      incentive: { upsert: incentiveUpsert },
      order: { findUnique: vi.fn().mockResolvedValue(order) }
    };

    await changeCostComponentStatus(admin, "cost_1", { status: "REJECTED", reason: "Duplicate" }, { $transaction: vi.fn(async (cb) => cb(tx)) });

    expect(costUpdate).toHaveBeenCalledWith({
      where: { id: "cost_1" },
      data: expect.objectContaining({
        rejectedById: "admin",
        rejectionReason: "Duplicate",
        status: "REJECTED",
        updatedById: "admin"
      })
    });
    expect(incentiveUpsert).toHaveBeenCalled();
  });

  test("rejects an invoice target from another organization before update", async () => {
    const update = vi.fn();
    await expect(updateInvoice(
      admin,
      "invoice_B",
      { gstPaisa: 0, invoiceDate: new Date("2026-08-03"), invoiceNumber: "INV-A", orderId: "order_1", subtotalPaisa: 1 },
      {
        invoice: { create: vi.fn(), findFirst: vi.fn().mockResolvedValue(null), update },
        order: { findFirst: vi.fn().mockResolvedValue(order) }
      } as never
    )).rejects.toThrow("Invoice was not found.");
    expect(update).not.toHaveBeenCalled();
  });

  test("rejects a cost line item outside the order and organization", async () => {
    const create = vi.fn();
    const tx = {
      costComponent: { create },
      incentive: { upsert: vi.fn() },
      order: { findFirst: vi.fn().mockResolvedValue(order) },
      orderLineItem: { findFirst: vi.fn().mockResolvedValue(null) }
    };

    await expect(createCostComponent(admin, {
      amountPaisa: 1, category: "Vendor", description: "Cross tenant", orderId: "order_1", orderLineItemId: "line_B"
    }, { $transaction: vi.fn(async (callback) => callback(tx)) } as never)).rejects.toThrow("Order line item was not found.");
    expect(create).not.toHaveBeenCalled();
  });

  test("rejects Sales writes and incentive approval before ready", async () => {
    await expect(
      createInvoice(sales, { gstPaisa: 0, invoiceDate: new Date(), invoiceNumber: "INV-1", orderId: "order_1", subtotalPaisa: 1 }, {
        invoice: { create: vi.fn() },
        order: { findUnique: vi.fn() }
      })
    ).rejects.toThrow("manage finance");

    await expect(
      approveIncentive(admin, "incentive_1", {}, { incentive: { findUnique: vi.fn().mockResolvedValue({ status: "NOT_READY" }) } })
    ).rejects.toThrow("not ready");
  });

  test("supports explicit incentive splits, rejection, and paid state", async () => {
    const splitDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const splitCreateMany = vi.fn().mockResolvedValue({ count: 2 });
    const incentiveUpdate = vi.fn().mockResolvedValue({ id: "incentive_1" });

    await updateIncentiveSplits(
      admin,
      "incentive_1",
      [
        { percent: 60, userId: "sales_a" },
        { percent: 40, userId: "sales_b" }
      ],
      {
        incentive: { findUnique: vi.fn().mockResolvedValue({ id: "incentive_1", payableAmountPaisa: 10000 }) },
        incentiveSplit: { createMany: splitCreateMany, deleteMany: splitDeleteMany }
      }
    );

    expect(splitDeleteMany).toHaveBeenCalledWith({ where: { incentiveId: "incentive_1", organizationId: "org_test" } });
    expect(splitCreateMany).toHaveBeenCalledWith({
      data: [
        { amountPaisa: 6000, incentiveId: "incentive_1", organizationId: "org_test", percent: 60, userId: "sales_a" },
        { amountPaisa: 4000, incentiveId: "incentive_1", organizationId: "org_test", percent: 40, userId: "sales_b" }
      ]
    });

    await rejectIncentive(admin, "incentive_1", "Margin dispute", { incentive: { findFirst: vi.fn().mockResolvedValue({ id: "incentive_1" }), update: incentiveUpdate } });
    expect(incentiveUpdate).toHaveBeenCalledWith({
      where: { id: "incentive_1" },
      data: expect.objectContaining({ rejectedById: "admin", rejectionReason: "Margin dispute", status: "REJECTED" })
    });

    await markIncentivePaid(admin, "incentive_1", "PAY-1", { incentive: { findFirst: vi.fn().mockResolvedValue({ id: "incentive_1" }), update: incentiveUpdate } });
    expect(incentiveUpdate).toHaveBeenCalledWith({
      where: { id: "incentive_1" },
      data: expect.objectContaining({ paidById: "admin", paymentReference: "PAY-1", status: "PAID" })
    });
  });
});
