import type { Prisma } from "@prisma/client";
import { calculateOrderPaymentSummary } from "@/server/finance/calculations";
import { db } from "@/server/db";
import { assertCanViewReports } from "./permissions";
import type {
  DashboardMetric,
  PendingProductionSummary,
  PipelineStageSummary,
  ReportsOverview,
  ReportsUser,
  TopBillingSummary,
  TopClientSummary,
  TopProductSummary,
  UpcomingFollowUpSummary
} from "./types";

const reportsUserSelect = {
  id: true,
  name: true
} satisfies Prisma.UserSelect;

const opportunityInclude = {
  stage: { select: { id: true, kind: true, name: true, sortOrder: true } }
} satisfies Prisma.OpportunityInclude;

const orderInclude = {
  invoices: { select: { id: true, totalPaisa: true } },
  leadCustomer: { select: { id: true, name: true } },
  lineItems: { select: { id: true, lineSubtotalPaisa: true, productNameSnapshot: true } },
  owner: { select: reportsUserSelect },
  payments: { select: { id: true, amountPaisa: true } }
} satisfies Prisma.OrderInclude;

const productionWorkItemInclude = {
  orderLineItem: {
    include: {
      order: {
        select: {
          orderNumber: true,
          leadCustomer: { select: { id: true, name: true } }
        }
      }
    }
  }
} satisfies Prisma.ProductionWorkItemInclude;

const activityInclude = {
  leadCustomer: { select: { id: true, name: true } },
  owner: { select: reportsUserSelect }
} satisfies Prisma.ActivityInclude;

type OpportunityRecord = Prisma.OpportunityGetPayload<{ include: typeof opportunityInclude }>;
type OrderRecord = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
type PaymentRecord = Pick<Prisma.PaymentGetPayload<Record<string, never>>, "amountPaisa" | "id" | "paymentDate">;
type ProductionWorkItemRecord = Prisma.ProductionWorkItemGetPayload<{ include: typeof productionWorkItemInclude }>;
type ActivityRecord = Prisma.ActivityGetPayload<{ include: typeof activityInclude }>;

type ReportsQueryDb = {
  activity: {
    findMany: (args: Prisma.ActivityFindManyArgs) => Promise<ActivityRecord[]>;
  };
  opportunity: {
    findMany: (args: Prisma.OpportunityFindManyArgs) => Promise<OpportunityRecord[]>;
  };
  order: {
    findMany: (args: Prisma.OrderFindManyArgs) => Promise<OrderRecord[]>;
  };
  payment: {
    findMany: (args: Prisma.PaymentFindManyArgs) => Promise<PaymentRecord[]>;
  };
  productionWorkItem: {
    findMany: (args: Prisma.ProductionWorkItemFindManyArgs) => Promise<ProductionWorkItemRecord[]>;
  };
};

function decimalInrToPaisa(value: unknown): number {
  if (!value) {
    return 0;
  }

  return Math.round(Number(value) * 100);
}

function formatInrPaisa(value: number) {
  return `INR ${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(value / 100)}`;
}

function isCurrentOrder(status: string) {
  return status !== "CANCELLED";
}

function isPendingProduction(status: string) {
  return status !== "DONE" && status !== "SKIPPED";
}

function toBillingSummary(order: OrderRecord): TopBillingSummary {
  return {
    bookedValuePaisa: order.subtotalPaisa,
    clientName: order.leadCustomer.name,
    orderId: order.id,
    orderNumber: order.orderNumber,
    ownerName: order.owner.name,
    status: order.status
  };
}

function buildPipelineByStage(opportunities: OpportunityRecord[]): PipelineStageSummary[] {
  const summaries = new Map<string, PipelineStageSummary & { sortOrder: number }>();

  for (const opportunity of opportunities) {
    if (opportunity.stage.kind !== "OPEN") {
      continue;
    }

    const existing = summaries.get(opportunity.stage.id) ?? {
      count: 0,
      sortOrder: opportunity.stage.sortOrder,
      stageId: opportunity.stage.id,
      stageName: opportunity.stage.name,
      valuePaisa: 0
    };

    existing.count += 1;
    existing.valuePaisa += decimalInrToPaisa(opportunity.estimatedValueInr);
    summaries.set(opportunity.stage.id, existing);
  }

  return Array.from(summaries.values())
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map(({ sortOrder: _sortOrder, ...summary }) => summary);
}

function buildTopClients(orders: OrderRecord[]): TopClientSummary[] {
  const summaries = new Map<string, TopClientSummary>();

  for (const order of orders) {
    const existing = summaries.get(order.leadCustomer.id) ?? {
      bookedValuePaisa: 0,
      clientId: order.leadCustomer.id,
      clientName: order.leadCustomer.name,
      orderCount: 0
    };

    existing.bookedValuePaisa += order.subtotalPaisa;
    existing.orderCount += 1;
    summaries.set(order.leadCustomer.id, existing);
  }

  return Array.from(summaries.values())
    .sort((left, right) => right.bookedValuePaisa - left.bookedValuePaisa || left.clientName.localeCompare(right.clientName))
    .slice(0, 5);
}

function buildTopProducts(orders: OrderRecord[]): TopProductSummary[] {
  const summaries = new Map<string, TopProductSummary & { orderIds: Set<string> }>();

  for (const order of orders) {
    for (const lineItem of order.lineItems) {
      const existing = summaries.get(lineItem.productNameSnapshot) ?? {
        bookedValuePaisa: 0,
        lineItemCount: 0,
        orderCount: 0,
        orderIds: new Set<string>(),
        productName: lineItem.productNameSnapshot
      };

      existing.bookedValuePaisa += lineItem.lineSubtotalPaisa;
      existing.lineItemCount += 1;
      existing.orderIds.add(order.id);
      existing.orderCount = existing.orderIds.size;
      summaries.set(lineItem.productNameSnapshot, existing);
    }
  }

  return Array.from(summaries.values())
    .sort((left, right) => right.bookedValuePaisa - left.bookedValuePaisa || left.productName.localeCompare(right.productName))
    .slice(0, 5)
    .map(({ orderIds: _orderIds, ...summary }) => summary);
}

function buildCollections(orders: OrderRecord[], payments: PaymentRecord[]) {
  const pendingReceivablePaisa = orders.reduce((total, order) => {
    const summary = calculateOrderPaymentSummary(order.totalPaisa, order.invoices, order.payments);
    return total + summary.pendingReceivablePaisa;
  }, 0);

  return {
    collectedPaisa: payments.reduce((total, payment) => total + payment.amountPaisa, 0),
    paymentCount: payments.length,
    pendingReceivablePaisa
  };
}

function buildPendingProduction(workItems: ProductionWorkItemRecord[]): PendingProductionSummary[] {
  return workItems
    .filter((workItem) => isPendingProduction(workItem.status))
    .slice(0, 5)
    .map((workItem) => ({
      clientName: workItem.orderLineItem.order.leadCustomer.name,
      dueAt: workItem.dueAt,
      orderNumber: workItem.orderLineItem.order.orderNumber,
      productName: workItem.productNameSnapshot,
      status: workItem.status,
      workItemId: workItem.id
    }));
}

function buildUpcomingFollowUps(activities: ActivityRecord[]): UpcomingFollowUpSummary[] {
  return activities.slice(0, 5).map((activity) => ({
    activityId: activity.id,
    clientName: activity.leadCustomer.name,
    dueAt: activity.dueAt,
    ownerName: activity.owner.name,
    subject: activity.subject
  }));
}

function buildDashboardMetrics({
  collections,
  openOpportunityCount,
  pendingProductionCount,
  pipelineValuePaisa,
  upcomingFollowUpCount,
  orders
}: {
  collections: { collectedPaisa: number; pendingReceivablePaisa: number };
  openOpportunityCount: number;
  orders: OrderRecord[];
  pendingProductionCount: number;
  pipelineValuePaisa: number;
  upcomingFollowUpCount: number;
}): DashboardMetric[] {
  return [
    { detail: "Opportunities in open stages", label: "Open opportunities", value: String(openOpportunityCount) },
    { detail: "Open estimated value", label: "Pipeline value", value: formatInrPaisa(pipelineValuePaisa) },
    {
      detail: "Excludes GST",
      label: "Booked value excl. GST",
      value: formatInrPaisa(orders.reduce((total, order) => total + order.subtotalPaisa, 0))
    },
    {
      detail: "Outstanding against order totals",
      label: "Pending receivables",
      value: formatInrPaisa(collections.pendingReceivablePaisa)
    },
    { detail: "Actual payment records", label: "Collected payments", value: formatInrPaisa(collections.collectedPaisa) },
    { detail: "Work not done or skipped", label: "Production pending", value: String(pendingProductionCount) },
    { detail: "Open future-dated activities", label: "Upcoming follow-ups", value: String(upcomingFollowUpCount) }
  ];
}

export async function getReportsOverview(user: ReportsUser, database: ReportsQueryDb = db as unknown as ReportsQueryDb): Promise<ReportsOverview> {
  assertCanViewReports(user);

  const now = new Date();
  const [opportunities, orders, payments, productionWorkItems, upcomingActivities] = await Promise.all([
    database.opportunity.findMany({
      orderBy: [{ updatedAt: "desc" }],
      include: opportunityInclude
    }),
    database.order.findMany({
      orderBy: [{ bookedAt: "desc" }],
      include: orderInclude
    }),
    database.payment.findMany({
      orderBy: [{ paymentDate: "desc" }],
      select: { amountPaisa: true, id: true, paymentDate: true }
    }),
    database.productionWorkItem.findMany({
      orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
      include: productionWorkItemInclude
    }),
    database.activity.findMany({
      where: { dueAt: { gte: now }, status: "OPEN" },
      orderBy: [{ dueAt: "asc" }],
      include: activityInclude
    })
  ]);

  const currentOrders = orders.filter((order) => isCurrentOrder(order.status));
  const pipelineByStage = buildPipelineByStage(opportunities);
  const collections = buildCollections(currentOrders, payments);
  const pendingProduction = buildPendingProduction(productionWorkItems);
  const upcomingFollowUps = buildUpcomingFollowUps(upcomingActivities);
  const topBillings = currentOrders
    .map(toBillingSummary)
    .sort((left, right) => right.bookedValuePaisa - left.bookedValuePaisa || left.orderNumber.localeCompare(right.orderNumber))
    .slice(0, 5);
  const recentOrders = [...currentOrders].slice(0, 5).map(toBillingSummary);
  const pipelineValuePaisa = pipelineByStage.reduce((total, stage) => total + stage.valuePaisa, 0);
  const openOpportunityCount = pipelineByStage.reduce((total, stage) => total + stage.count, 0);

  return {
    collections,
    dashboardMetrics: buildDashboardMetrics({
      collections,
      openOpportunityCount,
      orders: currentOrders,
      pendingProductionCount: pendingProduction.length,
      pipelineValuePaisa,
      upcomingFollowUpCount: upcomingFollowUps.length
    }),
    pendingProduction,
    pipelineByStage,
    recentOrders,
    topBillings,
    topClients: buildTopClients(currentOrders),
    topProducts: buildTopProducts(currentOrders),
    upcomingFollowUps
  };
}
