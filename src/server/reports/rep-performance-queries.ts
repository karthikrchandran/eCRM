import type { Prisma, User } from "@prisma/client";
import { withOrganization } from "@/server/organizations/with-organization";
import { listOrganizationUserOptions } from "@/server/organizations/member-options";
import { calculateOrderPaymentSummary } from "@/server/finance/calculations";
import { canManageAdminSettings } from "@/server/auth/permissions";
import type { ReportsUser } from "./types";

function assertAdminOnly(user: ReportsUser) {
  if (!canManageAdminSettings(user.role)) {
    throw new Error("You do not have permission to view team performance.");
  }
}

export type RepPerformanceFilters = {
  financialYear?: number;
  ownerId?: string;
  quarter?: 1 | 2 | 3 | 4;
};

export type RepPerformanceSummary = {
  rep: { id: string; name: string; email: string };
  targetPaisa: number;
  bookedPaisa: number;
  collectedPaisa: number;
  pendingReceivablePaisa: number;
  incentivePayablePaisa: number;
  orderCount: number;
};

type RepUser = Pick<User, "id" | "name" | "email">;
export type SalesRepOption = RepUser;
type OrderSummaryRecord = {
  id: string;
  ownerId: string;
  status: string;
  totalPaisa: number;
  invoices: { totalPaisa: number }[];
  payments: { amountPaisa: number }[];
};
type TargetRecord = { ownerId: string; targetValueInr: unknown };
type IncentiveSummaryRecord = { payableAmountPaisa: number; order: { ownerId: string } };

export type RepPerformanceDb = {
  user: { findMany: (args: Prisma.UserFindManyArgs) => Promise<RepUser[]> };
  order: { findMany: (args: unknown) => Promise<OrderSummaryRecord[]> };
  salesTarget: { findMany: (args: unknown) => Promise<TargetRecord[]> };
  incentive: { findMany: (args: unknown) => Promise<IncentiveSummaryRecord[]> };
};

export async function listSalesRepOptions(
  user: ReportsUser,
  database?: RepPerformanceDb
): Promise<SalesRepOption[]> {
  if (!database) {
    assertAdminOnly(user);
    return listOrganizationUserOptions(user.organizationId, ["SALES"]);
  }
  assertAdminOnly(user);

  return database.user.findMany({
    where: { active: true, role: "SALES", memberships: { some: { organizationId: user.organizationId, status: "ACTIVE" } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true }
  });
}

function buildBookedAtFilter(filters: RepPerformanceFilters) {
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

export async function listRepPerformanceSummaries(
  user: ReportsUser,
  filters: RepPerformanceFilters = {},
  database?: RepPerformanceDb,
  preloadedReps?: SalesRepOption[]
): Promise<RepPerformanceSummary[]> {
  if (!database) {
    const reps = (await listOrganizationUserOptions(user.organizationId, ["SALES"]))
      .filter((rep) => !filters.ownerId || rep.id === filters.ownerId);
    return withOrganization(user.organizationId, (tx) => listRepPerformanceSummaries(user, filters, tx as unknown as RepPerformanceDb, reps));
  }
  assertAdminOnly(user);

  const bookedAt = buildBookedAtFilter(filters);

  const [reps, orders, targets, incentives] = await Promise.all([
    preloadedReps ? Promise.resolve(preloadedReps) : database.user.findMany({
      where: { active: true, role: "SALES", memberships: { some: { organizationId: user.organizationId, status: "ACTIVE" } }, ...(filters.ownerId ? { id: filters.ownerId } : {}) },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true }
    }),
    database.order.findMany({
      where: {
        organizationId: user.organizationId,
        status: { not: "CANCELLED" },
        ...(bookedAt ? { bookedAt } : {})
      },
      select: {
        id: true,
        ownerId: true,
        status: true,
        totalPaisa: true,
        invoices: { select: { totalPaisa: true } },
        payments: { select: { amountPaisa: true } }
      }
    }),
    database.salesTarget.findMany({
      where: {
        organizationId: user.organizationId,
        ...(filters.financialYear ? { financialYear: filters.financialYear } : {}),
        ...(filters.quarter ? { quarter: filters.quarter } : {})
      },
      select: { ownerId: true, targetValueInr: true }
    }),
    database.incentive.findMany({
      where: {
        organizationId: user.organizationId,
        ...(bookedAt ? { order: { bookedAt } } : {})
      },
      select: {
        payableAmountPaisa: true,
        order: { select: { ownerId: true } }
      }
    })
  ]);

  return reps.map((rep) => {
    const repOrders = orders.filter((o) => o.ownerId === rep.id);
    const repTargets = targets.filter((t) => t.ownerId === rep.id);
    const repIncentives = incentives.filter((i) => i.order.ownerId === rep.id);

    const targetPaisa = repTargets.reduce((total, t) => {
      const inr = Number(t.targetValueInr?.toString() ?? "0");
      return total + Math.round(inr * 100);
    }, 0);

    const orderTotals = repOrders.reduce(
      (acc, order) => {
        const summary = calculateOrderPaymentSummary(order.totalPaisa, order.invoices, order.payments);
        acc.bookedPaisa += order.totalPaisa;
        acc.collectedPaisa += summary.collectedPaisa;
        acc.pendingReceivablePaisa += summary.pendingReceivablePaisa;
        return acc;
      },
      { bookedPaisa: 0, collectedPaisa: 0, pendingReceivablePaisa: 0 }
    );

    const incentivePayablePaisa = repIncentives.reduce((total, i) => total + i.payableAmountPaisa, 0);

    return {
      rep: { id: rep.id, name: rep.name, email: rep.email },
      targetPaisa,
      bookedPaisa: orderTotals.bookedPaisa,
      collectedPaisa: orderTotals.collectedPaisa,
      pendingReceivablePaisa: orderTotals.pendingReceivablePaisa,
      incentivePayablePaisa,
      orderCount: repOrders.length
    };
  });
}
