import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { assertCanViewFinance } from "./permissions";
import type { FinanceUser } from "./types";

export const orderFinanceSummaryInclude = {
  costComponents: {
    orderBy: [{ createdAt: "desc" }],
    include: {
      approvedBy: { select: { id: true, name: true, email: true, role: true } },
      createdBy: { select: { id: true, name: true, email: true, role: true } },
      orderLineItem: { select: { id: true, productNameSnapshot: true } },
      rejectedBy: { select: { id: true, name: true, email: true, role: true } },
      voidedBy: { select: { id: true, name: true, email: true, role: true } }
    }
  },
  incentive: {
    include: {
      approvedBy: { select: { id: true, name: true, email: true, role: true } },
      overrideBy: { select: { id: true, name: true, email: true, role: true } },
      paidBy: { select: { id: true, name: true, email: true, role: true } },
      rejectedBy: { select: { id: true, name: true, email: true, role: true } },
      splits: {
        include: {
          user: { select: { id: true, name: true, email: true, role: true } }
        },
        orderBy: { userId: "asc" }
      }
    }
  },
  invoices: {
    orderBy: [{ invoiceDate: "desc" }],
    include: {
      allocations: { include: { payment: true } },
      createdBy: { select: { id: true, name: true, email: true, role: true } },
      updatedBy: { select: { id: true, name: true, email: true, role: true } },
      voidedBy: { select: { id: true, name: true, email: true, role: true } }
    }
  },
  payments: {
    orderBy: [{ paymentDate: "desc" }],
    include: {
      allocations: { include: { invoice: true } },
      createdBy: { select: { id: true, name: true, email: true, role: true } }
    }
  }
} satisfies Prisma.OrderInclude;

export type OrderFinanceSummary = Prisma.OrderGetPayload<{ include: typeof orderFinanceSummaryInclude }>;

type FinanceQueryDb = {
  order: {
    findUnique: (args: Prisma.OrderFindUniqueArgs) => Promise<OrderFinanceSummary | null>;
  };
};

export async function getOrderFinanceSummary(
  user: FinanceUser,
  orderId: string,
  database: FinanceQueryDb = db as unknown as FinanceQueryDb
) {
  assertCanViewFinance(user);

  return database.order.findUnique({
    where: { id: orderId },
    include: orderFinanceSummaryInclude
  });
}
