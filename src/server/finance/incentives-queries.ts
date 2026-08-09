import type { IncentiveStatus, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { assertCanViewFinance } from "./permissions";
import type { FinanceUser } from "./types";

const financeOwnerSelect = {
  id: true,
  name: true,
  email: true,
  role: true
} satisfies Prisma.UserSelect;

const incentiveListInclude = {
  approvedBy: { select: financeOwnerSelect },
  order: {
    select: {
      bookedAt: true,
      currency: true,
      id: true,
      leadCustomer: { select: { id: true, name: true } },
      orderNumber: true,
      owner: { select: financeOwnerSelect },
      status: true,
      totalPaisa: true
    }
  },
  overrideBy: { select: financeOwnerSelect },
  paidBy: { select: financeOwnerSelect },
  rejectedBy: { select: financeOwnerSelect },
  splits: {
    include: {
      user: { select: financeOwnerSelect }
    },
    orderBy: { userId: "asc" }
  }
} satisfies Prisma.IncentiveInclude;

export type IncentiveListRecord = Prisma.IncentiveGetPayload<{ include: typeof incentiveListInclude }>;

export type IncentiveListFilters = {
  financialYear?: number;
  ownerId?: string;
  quarter?: 1 | 2 | 3 | 4;
  status?: IncentiveStatus;
};

type IncentiveQueryDb = {
  incentive: {
    findMany: (args: Prisma.IncentiveFindManyArgs) => Promise<IncentiveListRecord[]>;
  };
};

function buildBookedAtFilter(filters: IncentiveListFilters) {
  if (!filters.financialYear) {
    return undefined;
  }

  const startMonth = filters.quarter ? (filters.quarter - 1) * 3 : 0;
  const endMonth = filters.quarter ? startMonth + 2 : 11;

  return {
    gte: new Date(Date.UTC(filters.financialYear, startMonth, 1, 0, 0, 0, 0)),
    lte: new Date(Date.UTC(filters.financialYear, endMonth + 1, 0, 23, 59, 59, 999))
  };
}

export async function listIncentives(
  user: FinanceUser,
  filters: IncentiveListFilters = {},
  database: IncentiveQueryDb = db as unknown as IncentiveQueryDb
) {
  assertCanViewFinance(user);
  const bookedAt = buildBookedAtFilter(filters);
  const orderWhere = {
    ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
    ...(bookedAt ? { bookedAt } : {})
  };

  return database.incentive.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(Object.keys(orderWhere).length ? { order: orderWhere } : {})
    },
    orderBy: [{ updatedAt: "desc" }],
    include: incentiveListInclude
  });
}
