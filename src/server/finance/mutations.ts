import type { CostComponentStatus, IncentiveStatus, InvoiceStatus, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { withOrganization } from "@/server/organizations/with-organization";
import {
  calculateApprovedCostTotal,
  calculateGrossMargin,
  calculateIncentive,
  calculateIncentiveSplits,
  calculateInvoiceStatus,
  calculateOrderPaymentSummary
} from "./calculations";
import { assertCanManageFinance } from "./permissions";
import type { CostComponentInput, CostStatusInput, FinanceUser, IncentiveApprovalInput, InvoiceInput, PaymentInput } from "./types";

type FinanceOrder = {
  id: string;
  ownerId: string;
  status: string;
  subtotalPaisa: number;
  totalPaisa: number;
  invoices: Array<{ id: string; totalPaisa: number; allocations: Array<{ amountPaisa: number }> }>;
  payments: Array<{ amountPaisa: number }>;
  costComponents: Array<{ amountPaisa: number; status: CostComponentStatus | "DRAFT" | "APPROVED" | "REJECTED" | "VOID" }>;
  splitSnapshots: Array<{ userId: string; percent: number }>;
};

type FinanceOrderRead = {
  order: {
    findFirst?: (args: Prisma.OrderFindFirstArgs) => Promise<FinanceOrder | null>;
    findUnique?: (args: Prisma.OrderFindUniqueArgs) => Promise<FinanceOrder | null>;
  };
};

type InvoiceCreateDb = FinanceOrderRead & {
  invoice: {
    create: (args: Prisma.InvoiceCreateArgs) => Promise<{ id: string }>;
    findFirst?: (args: Prisma.InvoiceFindFirstArgs) => Promise<{ id: string } | null>;
    update?: (args: Prisma.InvoiceUpdateArgs) => Promise<{ id: string }>;
  };
};

type FinanceTransaction = FinanceOrderRead & {
  costComponent: {
    create: (args: Prisma.CostComponentCreateArgs) => Promise<{ id: string }>;
    findFirst?: (args: Prisma.CostComponentFindFirstArgs) => Promise<{ id: string; orderId: string } | null>;
    findUnique?: (args: Prisma.CostComponentFindUniqueArgs) => Promise<{ id: string; orderId: string } | null>;
    update?: (args: Prisma.CostComponentUpdateArgs) => Promise<{ id: string; orderId?: string }>;
  };
  orderLineItem?: {
    findFirst: (args: Prisma.OrderLineItemFindFirstArgs) => Promise<{ id: string } | null>;
  };
  incentive: {
    upsert: (args: Prisma.IncentiveUpsertArgs) => Promise<{ id: string }>;
  };
  invoice: {
    update: (args: Prisma.InvoiceUpdateArgs) => Promise<{ id: string }>;
  };
  payment: {
    create: (args: Prisma.PaymentCreateArgs) => Promise<{ id: string }>;
  };
};

type FinanceTransactionDb = Partial<FinanceTransaction> & {
  $transaction?: <T>(callback: (transaction: FinanceTransaction) => Promise<T>) => Promise<T>;
};

function inFinanceTransaction<T>(database: FinanceTransactionDb, work: (transaction: FinanceTransaction) => Promise<T>) {
  return database.$transaction ? database.$transaction(work) : work(database as FinanceTransaction);
}

type IncentiveApprovalDb = {
  incentive: {
    findFirst?: (args: Prisma.IncentiveFindFirstArgs) => Promise<{ status: IncentiveStatus | string; calculatedAmountPaisa?: number } | null>;
    findUnique?: (args: Prisma.IncentiveFindUniqueArgs) => Promise<{ status: IncentiveStatus | string; calculatedAmountPaisa?: number } | null>;
    update?: (args: Prisma.IncentiveUpdateArgs) => Promise<{ id: string; orderId?: string }>;
  };
};

type IncentiveSplitDb = {
  incentive: {
    findFirst?: (args: Prisma.IncentiveFindFirstArgs) => Promise<{ id: string; payableAmountPaisa: number } | null>;
    findUnique?: (args: Prisma.IncentiveFindUniqueArgs) => Promise<{ id: string; payableAmountPaisa: number } | null>;
  };
  incentiveSplit: {
    createMany: (args: Prisma.IncentiveSplitCreateManyArgs) => Promise<{ count: number }>;
    deleteMany: (args: Prisma.IncentiveSplitDeleteManyArgs) => Promise<{ count: number }>;
  };
};

type IncentiveStatusDb = {
  incentive: {
    findFirst?: (args: Prisma.IncentiveFindFirstArgs) => Promise<{ id: string } | null>;
    update: (args: Prisma.IncentiveUpdateArgs) => Promise<{ id: string; orderId?: string }>;
  };
};

const financeOrderInclude = {
  costComponents: true,
  invoices: { include: { allocations: true } },
  payments: true,
  splitSnapshots: true
} satisfies Prisma.OrderInclude;

async function loadFinanceOrder(database: FinanceOrderRead, organizationId: string, orderId: string) {
  const order = await (database.order.findFirst ?? database.order.findUnique!)({
    where: { id: orderId, organizationId },
    include: financeOrderInclude
  });

  if (!order) {
    throw new Error("Order was not found.");
  }

  if (order.status === "CANCELLED") {
    throw new Error("Cancelled orders cannot accept finance changes.");
  }

  return order;
}

function totalAllocatedToInvoice(invoice: FinanceOrder["invoices"][number], incomingAmountPaisa = 0) {
  return invoice.allocations.reduce((total, allocation) => total + allocation.amountPaisa, 0) + incomingAmountPaisa;
}

async function recalculateIncentiveForOrder(transaction: FinanceTransaction, organizationId: string, order: FinanceOrder) {
  const approvedCostTotalPaisa = calculateApprovedCostTotal(order.costComponents);
  const grossMarginPaisa = calculateGrossMargin(order.subtotalPaisa, approvedCostTotalPaisa);
  const calculatedAmountPaisa = calculateIncentive(grossMarginPaisa);
  const paymentSummary = calculateOrderPaymentSummary(order.totalPaisa, order.invoices, order.payments);
  const status = paymentSummary.fullyPaid ? "READY_FOR_REVIEW" : "NOT_READY";
  const readinessReason = paymentSummary.fullyPaid ? null : "Order is not fully paid.";
  const recipientSplits = order.splitSnapshots.length ? order.splitSnapshots : [{ percent: 100, userId: order.ownerId }];
  const splits = calculateIncentiveSplits(calculatedAmountPaisa, recipientSplits);

  return transaction.incentive.upsert({
    where: { orderId: order.id },
    create: {
      organizationId,
      approvedCostTotalPaisa,
      calculatedAmountPaisa,
      grossMarginPaisa,
      orderId: order.id,
      payableAmountPaisa: calculatedAmountPaisa,
      readinessReason,
      status,
      splits: { create: splits.map((split) => ({ ...split, organizationId })) }
    },
    update: {
      approvedCostTotalPaisa,
      calculatedAmountPaisa,
      grossMarginPaisa,
      payableAmountPaisa: calculatedAmountPaisa,
      readinessReason,
      status,
      splits: {
        deleteMany: {},
        create: splits.map((split) => ({ ...split, organizationId }))
      }
    }
  });
}

export async function createInvoice(user: FinanceUser, input: InvoiceInput, database: InvoiceCreateDb = db as unknown as InvoiceCreateDb): Promise<{ id: string }> {
  if (database === (db as unknown as InvoiceCreateDb)) return withOrganization(user.organizationId, (tx) => createInvoice(user, input, tx as unknown as InvoiceCreateDb));
  assertCanManageFinance(user);

  const order = await loadFinanceOrder(database, user.organizationId, input.orderId);
  const invoiceTotalPaisa = input.subtotalPaisa + input.gstPaisa;
  const existingInvoiceTotalPaisa = order.invoices.reduce((total, invoice) => total + invoice.totalPaisa, 0);

  if (existingInvoiceTotalPaisa + invoiceTotalPaisa > order.totalPaisa) {
    throw new Error("Invoice total cannot exceed the order total.");
  }

  return database.invoice.create({
    data: {
      organizationId: user.organizationId,
      dueDate: input.dueDate,
      gstPaisa: input.gstPaisa,
      invoiceDate: input.invoiceDate,
      invoiceNumber: input.invoiceNumber,
      notes: input.notes,
      orderId: input.orderId,
      status: "ISSUED",
      subtotalPaisa: input.subtotalPaisa,
      totalPaisa: invoiceTotalPaisa,
      createdById: user.id,
      updatedById: user.id
    }
  });
}

export async function updateInvoice(
  user: FinanceUser,
  invoiceId: string,
  input: InvoiceInput,
  database: InvoiceCreateDb = db as unknown as InvoiceCreateDb
): Promise<{ id: string } | undefined> {
  if (database === (db as unknown as InvoiceCreateDb)) return withOrganization(user.organizationId, (tx) => updateInvoice(user, invoiceId, input, tx as unknown as InvoiceCreateDb));
  assertCanManageFinance(user);

  await loadFinanceOrder(database, user.organizationId, input.orderId);
  const invoice = await database.invoice.findFirst?.({
    where: { id: invoiceId, orderId: input.orderId, organizationId: user.organizationId },
    select: { id: true }
  });
  if (!invoice) throw new Error("Invoice was not found.");
  const invoiceTotalPaisa = input.subtotalPaisa + input.gstPaisa;

  return database.invoice.update?.({
    where: { id: invoiceId },
    data: {
      dueDate: input.dueDate,
      gstPaisa: input.gstPaisa,
      invoiceDate: input.invoiceDate,
      invoiceNumber: input.invoiceNumber,
      notes: input.notes,
      subtotalPaisa: input.subtotalPaisa,
      totalPaisa: invoiceTotalPaisa,
      updatedById: user.id
    }
  });
}

export async function recordPayment(user: FinanceUser, input: PaymentInput, database: FinanceTransactionDb = db as unknown as FinanceTransactionDb): Promise<{ id: string }> {
  if (database === (db as unknown as FinanceTransactionDb)) return withOrganization(user.organizationId, (tx) => recordPayment(user, input, tx as unknown as FinanceTransactionDb));
  assertCanManageFinance(user);

  return inFinanceTransaction(database, async (transaction) => {
    const order = await loadFinanceOrder(transaction, user.organizationId, input.orderId);
    const cumulativePaidPaisa = order.payments.reduce((total, payment) => total + payment.amountPaisa, 0) + input.amountPaisa;

    if (cumulativePaidPaisa > order.totalPaisa && !input.overpaymentAcknowledged) {
      throw new Error("Payment total cannot exceed the order total.");
    }

    const orderWithIncomingPayment = { ...order, payments: [...order.payments, { amountPaisa: input.amountPaisa }] };

    const payment = await transaction.payment.create({
      data: {
        organizationId: user.organizationId,
        allocations: { create: input.allocations.map((allocation) => ({ ...allocation, organizationId: user.organizationId })) },
        amountPaisa: input.amountPaisa,
        createdById: user.id,
        mode: input.mode,
        notes: input.notes,
        orderId: input.orderId,
        paymentDate: input.paymentDate,
        reference: input.reference
      }
    });

    for (const allocation of input.allocations) {
      const invoice = order.invoices.find((candidate) => candidate.id === allocation.invoiceId);

      if (!invoice) {
        throw new Error("Payment allocation invoice was not found on this order.");
      }

      await transaction.invoice.update({
        where: { id: allocation.invoiceId },
        data: {
          status: calculateInvoiceStatus(invoice.totalPaisa, totalAllocatedToInvoice(invoice, allocation.amountPaisa)) as InvoiceStatus,
          updatedById: user.id
        }
      });
    }

    await recalculateIncentiveForOrder(transaction, user.organizationId, orderWithIncomingPayment);
    return payment;
  });
}

export async function createCostComponent(
  user: FinanceUser,
  input: CostComponentInput,
  database: FinanceTransactionDb = db as unknown as FinanceTransactionDb
): Promise<{ id: string }> {
  if (database === (db as unknown as FinanceTransactionDb)) return withOrganization(user.organizationId, (tx) => createCostComponent(user, input, tx as unknown as FinanceTransactionDb));
  assertCanManageFinance(user);

  return inFinanceTransaction(database, async (transaction) => {
    const order = await loadFinanceOrder(transaction, user.organizationId, input.orderId);
    if (input.orderLineItemId) {
      const orderLineItem = await transaction.orderLineItem?.findFirst({
        where: { id: input.orderLineItemId, orderId: input.orderId, organizationId: user.organizationId },
        select: { id: true }
      });
      if (!orderLineItem) throw new Error("Order line item was not found.");
    }
    const cost = await transaction.costComponent.create({
      data: {
        organizationId: user.organizationId,
        amountPaisa: input.amountPaisa,
        category: input.category,
        createdById: user.id,
        description: input.description,
        orderId: input.orderId,
        orderLineItemId: input.orderLineItemId,
        status: "DRAFT",
        updatedById: user.id
      }
    });

    await recalculateIncentiveForOrder(transaction, user.organizationId, order);
    return cost;
  });
}

export async function changeCostComponentStatus(
  user: FinanceUser,
  costComponentId: string,
  input: CostStatusInput,
  database: FinanceTransactionDb = db as unknown as FinanceTransactionDb
): Promise<{ id: string; orderId?: string } | undefined> {
  if (database === (db as unknown as FinanceTransactionDb)) return withOrganization(user.organizationId, (tx) => changeCostComponentStatus(user, costComponentId, input, tx as unknown as FinanceTransactionDb));
  assertCanManageFinance(user);

  return inFinanceTransaction(database, async (transaction) => {
    const costComponent = await (transaction.costComponent.findFirst ?? transaction.costComponent.findUnique)?.({
      where: { id: costComponentId, organizationId: user.organizationId }
    });

    if (!costComponent) {
      throw new Error("Cost component was not found.");
    }

    const now = new Date();
    const data =
      input.status === "APPROVED"
        ? { approvedAt: now, approvedById: user.id, status: input.status, updatedById: user.id }
        : input.status === "REJECTED"
          ? { rejectedAt: now, rejectedById: user.id, rejectionReason: input.reason, status: input.status, updatedById: user.id }
          : { status: input.status, updatedById: user.id, voidReason: input.reason, voidedAt: now, voidedById: user.id };

    const updated = await transaction.costComponent.update?.({
      where: { id: costComponentId },
      data
    });

    const order = await loadFinanceOrder(transaction, user.organizationId, costComponent.orderId);
    await recalculateIncentiveForOrder(transaction, user.organizationId, order);
    return updated;
  });
}

export async function approveIncentive(
  user: FinanceUser,
  incentiveId: string,
  input: IncentiveApprovalInput,
  database: IncentiveApprovalDb = db as unknown as IncentiveApprovalDb
): Promise<{ id: string; orderId?: string } | undefined> {
  if (database === (db as unknown as IncentiveApprovalDb)) return withOrganization(user.organizationId, (tx) => approveIncentive(user, incentiveId, input, tx as unknown as IncentiveApprovalDb));
  assertCanManageFinance(user);

  const incentive = await (database.incentive.findFirst ?? database.incentive.findUnique!)({ where: { id: incentiveId, organizationId: user.organizationId } });

  if (!incentive) {
    throw new Error("Incentive was not found.");
  }

  if (incentive.status !== "READY_FOR_REVIEW") {
    throw new Error("Incentive is not ready for approval.");
  }

  const payableAmountPaisa = input.overrideAmountPaisa ?? incentive.calculatedAmountPaisa ?? 0;

  return database.incentive.update?.({
    where: { id: incentiveId },
    data: {
      approvedAt: new Date(),
      approvedById: user.id,
      overrideAmountPaisa: input.overrideAmountPaisa,
      overrideAt: input.overrideAmountPaisa === undefined ? undefined : new Date(),
      overrideById: input.overrideAmountPaisa === undefined ? undefined : user.id,
      overrideReason: input.overrideReason,
      payableAmountPaisa,
      status: "APPROVED"
    }
  });
}

export async function updateIncentiveSplits(
  user: FinanceUser,
  incentiveId: string,
  splits: Array<{ percent: number; userId: string }>,
  database: IncentiveSplitDb = db as unknown as IncentiveSplitDb
): Promise<{ count: number }> {
  if (database === (db as unknown as IncentiveSplitDb)) return withOrganization(user.organizationId, (tx) => updateIncentiveSplits(user, incentiveId, splits, tx as unknown as IncentiveSplitDb));
  assertCanManageFinance(user);

  const incentive = await (database.incentive.findFirst ?? database.incentive.findUnique!)({ where: { id: incentiveId, organizationId: user.organizationId } });

  if (!incentive) {
    throw new Error("Incentive was not found.");
  }

  const splitAmounts = calculateIncentiveSplits(incentive.payableAmountPaisa, splits);

  await database.incentiveSplit.deleteMany({ where: { incentiveId, organizationId: user.organizationId } });
  return database.incentiveSplit.createMany({
    data: splitAmounts.map((split) => ({ ...split, incentiveId, organizationId: user.organizationId }))
  });
}

export async function rejectIncentive(
  user: FinanceUser,
  incentiveId: string,
  reason: string,
  database: IncentiveStatusDb = db as unknown as IncentiveStatusDb
): Promise<{ id: string; orderId?: string }> {
  if (database === (db as unknown as IncentiveStatusDb)) return withOrganization(user.organizationId, (tx) => rejectIncentive(user, incentiveId, reason, tx as unknown as IncentiveStatusDb));
  assertCanManageFinance(user);

  const existing = await database.incentive.findFirst?.({ where: { id: incentiveId, organizationId: user.organizationId }, select: { id: true } }) ?? { id: incentiveId };
  if (!existing) throw new Error("Incentive was not found.");

  return database.incentive.update({
    where: { id: incentiveId },
    data: {
      rejectedAt: new Date(),
      rejectedById: user.id,
      rejectionReason: reason,
      status: "REJECTED"
    }
  });
}

export async function markIncentivePaid(
  user: FinanceUser,
  incentiveId: string,
  paymentReference: string,
  database: IncentiveStatusDb = db as unknown as IncentiveStatusDb
): Promise<{ id: string; orderId?: string }> {
  if (database === (db as unknown as IncentiveStatusDb)) return withOrganization(user.organizationId, (tx) => markIncentivePaid(user, incentiveId, paymentReference, tx as unknown as IncentiveStatusDb));
  assertCanManageFinance(user);

  const existing = await database.incentive.findFirst?.({ where: { id: incentiveId, organizationId: user.organizationId }, select: { id: true } }) ?? { id: incentiveId };
  if (!existing) throw new Error("Incentive was not found.");

  return database.incentive.update({
    where: { id: incentiveId },
    data: {
      paidAt: new Date(),
      paidById: user.id,
      paymentReference,
      status: "PAID"
    }
  });
}
