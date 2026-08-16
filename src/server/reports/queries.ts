import { formatCurrencyPaisa, type ReportCurrency } from "@/components/reports/report-formatters";
import { db } from "@/server/db";
import { calculateOrderPaymentSummary } from "@/server/finance/calculations";
import { assertCanViewReports } from "./permissions";
import type {
  AgingBucketSummary,
  CockpitReports,
  CollectionSummary,
  CountValueSummary,
  CustomerReports,
  DashboardMetric,
  DeliveryRiskSummary,
  FinanceReports,
  PendingProductionSummary,
  PipelineStageSummary,
  ProductReports,
  ProductionReports,
  ReportOption,
  ReportsFilterOptions,
  ReportsFilters,
  ReportsOverview,
  ReportsUser,
  SalesReports,
  TopBillingSummary,
  TopClientSummary,
  TopProductSummary,
  UpcomingFollowUpSummary
} from "./types";

type BasicUser = { id: string; name: string; email?: string };
type LeadCustomerRef = { id: string; name: string };
type OpportunityRecord = {
  id: string;
  createdAt: Date;
  estimatedValueInr: unknown;
  leadCustomer: LeadCustomerRef;
  owner: BasicUser;
  probability?: number | null;
  proposals?: Array<{ id: string; status: string }>;
  stage: { id: string; kind: string; name: string; sortOrder: number };
  title: string;
};
type OrderRecord = {
  id: string;
  bookedAt: Date;
  currency: string;
  costComponents?: Array<{ amountPaisa: number; orderLineItemId: string | null; status: string }>;
  invoices: Array<{ id: string; totalPaisa: number }>;
  leadCustomer: LeadCustomerRef;
  lineItems: Array<{ id: string; lineSubtotalPaisa: number; productNameSnapshot: string; productServiceId?: string | null }>;
  orderNumber: string;
  owner: BasicUser;
  payments: Array<{ id: string; amountPaisa: number }>;
  status: string;
  subtotalPaisa: number;
  totalPaisa: number;
};
type PaymentRecord = { amountPaisa: number; id: string; paymentDate: Date; order: Pick<OrderRecord, "currency" | "status"> };
type ActivityRecord = { dueAt: Date | null; id: string; leadCustomer: LeadCustomerRef; owner: BasicUser; subject: string };
type ProductionWorkItemRecord = {
  assignedTo: BasicUser | null;
  dueAt: Date | null;
  id: string;
  orderLineItem: { order: { id: string; orderNumber: string; leadCustomer: LeadCustomerRef } };
  productNameSnapshot: string;
  stageInstances: Array<{
    assignedTo: BasicUser | null;
    completedAt: Date | null;
    dueAt: Date | null;
    name: string;
    startedAt: Date | null;
    status: string;
  }>;
  status: string;
};
type InvoiceRecord = {
  dueDate: Date | null;
  id: string;
  invoiceNumber: string;
  status: string;
  totalPaisa: number;
  order: { id: string; currency: string; leadCustomer: LeadCustomerRef; orderNumber: string; payments: Array<{ amountPaisa: number; id: string }> };
};
type CostRecord = {
  amountPaisa: number;
  category: string;
  id: string;
  orderLineItemId?: string | null;
  status: string;
  order: { id: string; currency: string; leadCustomer: LeadCustomerRef; orderNumber: string };
};
type IncentiveRecord = {
  id: string;
  payableAmountPaisa: number;
  status: string;
  order: { id: string; currency: string; leadCustomer: LeadCustomerRef; orderNumber: string };
};
type ProductServiceRecord = { id: string; name: string };

type ReportsQueryDb = {
  activity: { findMany: (args: unknown) => Promise<ActivityRecord[]> };
  cellConfiguration?: { findUnique: (args: unknown) => Promise<{ defaultCurrency: ReportCurrency } | null> };
  businessSettings?: { findUnique: (args: unknown) => Promise<{ defaultCurrency: ReportCurrency } | null> };
  costComponent?: { findMany: (args: unknown) => Promise<CostRecord[]> };
  incentive?: { findMany: (args: unknown) => Promise<IncentiveRecord[]> };
  invoice?: { findMany: (args: unknown) => Promise<InvoiceRecord[]> };
  opportunity: { findMany: (args: unknown) => Promise<OpportunityRecord[]> };
  order: { findMany: (args: unknown) => Promise<OrderRecord[]> };
  payment: { findMany: (args: unknown) => Promise<PaymentRecord[]> };
  productionWorkItem: { findMany: (args: unknown) => Promise<ProductionWorkItemRecord[]> };
  productService?: { findMany: (args: unknown) => Promise<ProductServiceRecord[]> };
  user?: { findMany: (args: unknown) => Promise<BasicUser[]> };
};

function decimalToPaisa(value: unknown) {
  const amount = Number(value?.toString() ?? "0");
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function dateRangeWhere(filters: ReportsFilters) {
  if (!filters.dateFrom && !filters.dateTo) {
    return undefined;
  }

  return {
    ...(filters.dateFrom ? { gte: new Date(`${filters.dateFrom}T00:00:00.000Z`) } : {}),
    ...(filters.dateTo ? { lte: new Date(`${filters.dateTo}T23:59:59.999Z`) } : {})
  };
}

function buildOrderWhere(filters: ReportsFilters) {
  return {
    ...(dateRangeWhere(filters) ? { bookedAt: dateRangeWhere(filters) } : {}),
    ...(filters.currency ? { currency: filters.currency } : {}),
    ...(filters.customerId ? { leadCustomerId: filters.customerId } : {}),
    ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
    ...(filters.productServiceId ? { lineItems: { some: { productServiceId: filters.productServiceId } } } : {}),
    ...(filters.status ? { status: filters.status } : {})
  };
}

function buildOpportunityWhere(filters: ReportsFilters) {
  return {
    ...(filters.customerId ? { leadCustomerId: filters.customerId } : {}),
    ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
    ...(filters.stageId ? { stageId: filters.stageId } : {})
  };
}

function isCurrentOrder(order: OrderRecord) {
  return order.status !== "CANCELLED";
}

function isPendingProduction(status: string) {
  return status !== "DONE" && status !== "SKIPPED";
}

function followUpBucket(activity: ActivityRecord, now: Date) {
  return activity.dueAt && activity.dueAt < now ? "overdue" : "upcoming";
}

function toBillingSummary(order: OrderRecord): TopBillingSummary {
  return {
    bookedValuePaisa: order.subtotalPaisa,
    clientId: order.leadCustomer.id,
    clientName: order.leadCustomer.name,
    orderId: order.id,
    orderNumber: order.orderNumber,
    ownerId: order.owner.id,
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

    const valuePaisa = decimalToPaisa(opportunity.estimatedValueInr);
    existing.count += 1;
    existing.valuePaisa += valuePaisa;
    summaries.set(opportunity.stage.id, existing);
  }

  return Array.from(summaries.values())
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((summary) => ({
      count: summary.count,
      stageId: summary.stageId,
      stageName: summary.stageName,
      valuePaisa: summary.valuePaisa
    }));
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

  return Array.from(summaries.values()).sort((left, right) => right.bookedValuePaisa - left.bookedValuePaisa || left.clientName.localeCompare(right.clientName));
}

function buildTopProducts(orders: OrderRecord[], productNameFilter?: string): TopProductSummary[] {
  const summaries = new Map<string, TopProductSummary & { orderIds: Set<string> }>();

  for (const order of orders) {
    for (const lineItem of order.lineItems) {
      if (productNameFilter && lineItem.productNameSnapshot !== productNameFilter) {
        continue;
      }
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

  return Array.from(summaries.values()).map((summary) => ({
    bookedValuePaisa: summary.bookedValuePaisa,
    lineItemCount: summary.lineItemCount,
    orderCount: summary.orderCount,
    productName: summary.productName
  }));
}

function buildCollections(orders: OrderRecord[], payments: PaymentRecord[]): CollectionSummary {
  return {
    collectedPaisa: payments.reduce((total, payment) => total + payment.amountPaisa, 0),
    paymentCount: payments.length,
    pendingReceivablePaisa: orders.reduce((total, order) => {
      const summary = calculateOrderPaymentSummary(order.totalPaisa, order.invoices, order.payments);
      return total + summary.pendingReceivablePaisa;
    }, 0)
  };
}

function buildPendingProduction(workItems: ProductionWorkItemRecord[]): PendingProductionSummary[] {
  return workItems.filter((workItem) => isPendingProduction(workItem.status)).map((workItem) => ({
    clientName: workItem.orderLineItem.order.leadCustomer.name,
    dueAt: workItem.dueAt,
    orderId: workItem.orderLineItem.order.id,
    orderNumber: workItem.orderLineItem.order.orderNumber,
    productName: workItem.productNameSnapshot,
    status: workItem.status,
    workItemId: workItem.id
  }));
}

function utcMonthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function buildCockpitTrend(orders: OrderRecord[], payments: PaymentRecord[], currency: ReportCurrency, now: Date): CockpitReports["trend"] {
  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - index), 1));
    return { bookedPaisa: 0, collectedPaisa: 0, key: utcMonthKey(date), label: monthLabels[date.getUTCMonth()] };
  });
  const monthByKey = new Map(months.map((month) => [month.key, month]));

  for (const order of orders) {
    const month = monthByKey.get(utcMonthKey(order.bookedAt));
    if (month && isCurrentOrder(order)) month.bookedPaisa += order.totalPaisa;
  }
  for (const payment of payments) {
    const month = monthByKey.get(utcMonthKey(payment.paymentDate));
    if (month && payment.order.currency === currency && payment.order.status !== "CANCELLED") month.collectedPaisa += payment.amountPaisa;
  }

  const points = months.map(({ bookedPaisa, collectedPaisa, label }) => ({ bookedPaisa, collectedPaisa, label }));
  return {
    hasHistory: points.filter((month) => month.bookedPaisa !== 0 || month.collectedPaisa !== 0).length >= 2,
    months: points
  };
}

function buildDeliveryRisk(workItems: ProductionWorkItemRecord[], now: Date): DeliveryRiskSummary {
  let blockedCount = 0;
  let dueSoonCount = 0;
  let overdueCount = 0;
  let totalCount = 0;
  const dueSoonEnd = new Date(now.getTime() + 7 * 86_400_000);

  for (const workItem of workItems) {
    if (!isPendingProduction(workItem.status)) continue;

    const isBlocked = workItem.stageInstances.some((stage) => isPendingProduction(stage.status) && stage.status === "BLOCKED");
    const isOverdue = Boolean(workItem.dueAt && workItem.dueAt < now);
    const isDueSoon = Boolean(workItem.dueAt && workItem.dueAt >= now && workItem.dueAt <= dueSoonEnd);

    if (isBlocked) blockedCount += 1;
    if (isOverdue) overdueCount += 1;
    if (isDueSoon) dueSoonCount += 1;
    if (isBlocked || isOverdue || isDueSoon) totalCount += 1;
  }

  return { blockedCount, dueSoonCount, overdueCount, totalCount };
}

function buildCockpitReports(input: {
  activities: ActivityRecord[];
  orders: OrderRecord[];
  payments: PaymentRecord[];
  currency: ReportCurrency;
  workItems: ProductionWorkItemRecord[];
  now: Date;
}): CockpitReports {
  return {
    deliveryRisk: buildDeliveryRisk(input.workItems, input.now),
    followUpRisk: {
      overdueCount: input.activities.filter((activity) => followUpBucket(activity, input.now) === "overdue").length,
      upcomingCount: input.activities.filter((activity) => followUpBucket(activity, input.now) === "upcoming").length
    },
    trend: buildCockpitTrend(input.orders, input.payments, input.currency, input.now)
  };
}

function buildUpcomingFollowUps(activities: ActivityRecord[], now: Date): UpcomingFollowUpSummary[] {
  return [...activities]
    .filter((activity) => followUpBucket(activity, now) === "upcoming")
    .sort((left, right) => (left.dueAt?.getTime() ?? 0) - (right.dueAt?.getTime() ?? 0))
    .slice(0, 5)
    .map((activity) => ({
      activityId: activity.id,
      clientName: activity.leadCustomer.name,
      dueAt: activity.dueAt,
      ownerName: activity.owner.name,
      subject: activity.subject
    }));
}

function buildDashboardMetrics(currency: ReportCurrency, data: {
  collections: CollectionSummary;
  currentOrders: OrderRecord[];
  pendingProduction: PendingProductionSummary[];
  pipelineByStage: PipelineStageSummary[];
  upcomingFollowUpCount: number;
}): DashboardMetric[] {
  const openOpportunityCount = data.pipelineByStage.reduce((total, stage) => total + stage.count, 0);
  const pipelineValuePaisa = data.pipelineByStage.reduce((total, stage) => total + stage.valuePaisa, 0);

  return [
    { detail: "Opportunities in open stages", label: "Open opportunities", value: String(openOpportunityCount) },
    { detail: "Open estimated value", label: "Pipeline value", value: formatCurrencyPaisa(pipelineValuePaisa, currency) },
    {
      detail: "Booked orders",
      label: "Booked value",
      value: formatCurrencyPaisa(data.currentOrders.reduce((total, order) => total + order.subtotalPaisa, 0), currency)
    },
    {
      detail: "Outstanding against order totals",
      label: "Pending receivables",
      value: formatCurrencyPaisa(data.collections.pendingReceivablePaisa, currency)
    },
    { detail: "Actual payment records", label: "Collected payments", value: formatCurrencyPaisa(data.collections.collectedPaisa, currency) },
    { detail: "Work not done or skipped", label: "Production pending", value: String(data.pendingProduction.length) },
    { detail: "Open future-dated activities", label: "Upcoming follow-ups", value: String(data.upcomingFollowUpCount) }
  ];
}

function buildSalesReports(opportunities: OpportunityRecord[], activities: ActivityRecord[], pipelineByStage: PipelineStageSummary[], now: Date): SalesReports {
  return {
    followUpCompliance: {
      overdue: activities.filter((activity) => followUpBucket(activity, now) === "overdue").length,
      upcoming: activities.filter((activity) => followUpBucket(activity, now) === "upcoming").length
    },
    opportunityAging: [],
    pipelineFunnel: pipelineByStage,
    proposalConversion: {
      accepted: opportunities.flatMap((opportunity) => opportunity.proposals ?? []).filter((proposal) => proposal.status === "ACCEPTED").length,
      total: opportunities.flatMap((opportunity) => opportunity.proposals ?? []).length
    },
    weightedPipelinePaisa: opportunities
      .filter((opportunity) => opportunity.stage.kind === "OPEN")
      .reduce((total, opportunity) => total + Math.round(decimalToPaisa(opportunity.estimatedValueInr) * ((opportunity.probability ?? 0) / 100)), 0),
    winLoss: {
      lost: opportunities.filter((opportunity) => opportunity.stage.kind === "LOST").length,
      won: opportunities.filter((opportunity) => opportunity.stage.kind === "WON").length
    }
  };
}

function agingBucket(days: number) {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

function buildFinanceReports(orders: OrderRecord[], invoices: InvoiceRecord[], costs: CostRecord[], incentives: IncentiveRecord[], now: Date): FinanceReports {
  const receivables = new Map<string, AgingBucketSummary>();
  for (const invoice of invoices) {
    const collected = invoice.order.payments.reduce((total, payment) => total + payment.amountPaisa, 0);
    const outstanding = Math.max(0, invoice.totalPaisa - collected);
    if (outstanding === 0) continue;
    const days = invoice.dueDate ? Math.max(0, Math.floor((now.getTime() - invoice.dueDate.getTime()) / 86_400_000)) : 0;
    const bucket = agingBucket(days);
    const existing = receivables.get(bucket) ?? { bucket, invoiceCount: 0, outstandingPaisa: 0 };
    existing.invoiceCount = (existing.invoiceCount ?? 0) + 1;
    existing.outstandingPaisa = (existing.outstandingPaisa ?? 0) + outstanding;
    receivables.set(bucket, existing);
  }

  const invoiceStatus = new Map<string, CountValueSummary>();
  for (const invoice of invoices) {
    const existing = invoiceStatus.get(invoice.status) ?? { count: 0, status: invoice.status, totalPaisa: 0 };
    existing.count += 1;
    existing.totalPaisa = (existing.totalPaisa ?? 0) + invoice.totalPaisa;
    invoiceStatus.set(invoice.status, existing);
  }

  const revenuePaisa = orders.reduce((total, order) => total + order.subtotalPaisa, 0);
  const approvedCostPaisa = costs.filter((cost) => cost.status === "APPROVED").reduce((total, cost) => total + cost.amountPaisa, 0);

  return {
    costLeakagePaisa: costs.filter((cost) => cost.status !== "APPROVED").reduce((total, cost) => total + cost.amountPaisa, 0),
    grossMargin: { approvedCostPaisa, grossMarginPaisa: revenuePaisa - approvedCostPaisa, revenuePaisa },
    incentives: {
      approvedPaisa: incentives.filter((incentive) => incentive.status === "APPROVED").reduce((total, incentive) => total + incentive.payableAmountPaisa, 0),
      paidPaisa: incentives.filter((incentive) => incentive.status === "PAID").reduce((total, incentive) => total + incentive.payableAmountPaisa, 0),
      payablePaisa: incentives.filter((incentive) => incentive.status === "READY_FOR_REVIEW").reduce((total, incentive) => total + incentive.payableAmountPaisa, 0)
    },
    invoiceStatus: Array.from(invoiceStatus.values()),
    receivablesAging: Array.from(receivables.values())
  };
}

function buildProductionReports(workItems: ProductionWorkItemRecord[], now: Date): ProductionReports {
  const pendingStages = new Map<string, number>();
  const assignees = new Map<string, { assigneeId: string; assigneeName: string; count: number }>();
  let blockedCount = 0;
  let overdueCount = 0;
  let maxCycleDays = 0;

  for (const workItem of workItems) {
    if (isPendingProduction(workItem.status) && workItem.dueAt && workItem.dueAt < now) {
      overdueCount += 1;
    }
    for (const stage of workItem.stageInstances) {
      if (stage.status === "BLOCKED") blockedCount += 1;
      if (isPendingProduction(stage.status)) {
        pendingStages.set(stage.name, (pendingStages.get(stage.name) ?? 0) + 1);
        if (stage.assignedTo) {
          const existing = assignees.get(stage.assignedTo.id) ?? { assigneeId: stage.assignedTo.id, assigneeName: stage.assignedTo.name, count: 0 };
          existing.count += 1;
          assignees.set(stage.assignedTo.id, existing);
        }
        if (stage.startedAt) {
          maxCycleDays = Math.max(maxCycleDays, Math.floor((now.getTime() - stage.startedAt.getTime()) / 86_400_000));
        }
      }
    }
  }

  return {
    blockedCount,
    cycleTimeDays: maxCycleDays,
    overdueCount,
    pendingByStage: Array.from(pendingStages.entries()).map(([stageName, count]) => ({ count, stageName })),
    workloadByAssignee: Array.from(assignees.values())
  };
}

function buildCustomerReports(orders: OrderRecord[], filters: ReportsFilters): CustomerReports {
  const scopedOrders = filters.customerId ? orders.filter((order) => order.leadCustomer.id === filters.customerId) : orders;

  return {
    dormantCustomers: [],
    repeatCustomers: buildTopClients(scopedOrders)
      .filter((client) => client.orderCount >= 1)
      .map((client) => ({ clientId: client.clientId, clientName: client.clientName, orderCount: client.orderCount })),
    topCustomers: buildTopClients(orders)
  };
}

function buildProductReports(orders: OrderRecord[], costs: CostRecord[], productNameFilter?: string): ProductReports {
  const rows = buildTopProducts(orders, productNameFilter).map((product) => {
    const orderLineIds = new Set(
      orders.flatMap((order) => order.lineItems.filter((line) => line.productNameSnapshot === product.productName).map((line) => line.id))
    );
    const approvedCostPaisa = costs
      .filter((cost) => cost.status === "APPROVED" && (!cost.orderLineItemId || orderLineIds.has(cost.orderLineItemId)))
      .reduce((total, cost) => total + cost.amountPaisa, 0);
    return {
      grossMarginPaisa: product.bookedValuePaisa - approvedCostPaisa,
      productName: product.productName,
      revenuePaisa: product.bookedValuePaisa
    };
  });

  return { revenueAndMargin: rows, topProducts: buildTopProducts(orders) };
}

function optionsFromCustomers(orders: OrderRecord[], opportunities: OpportunityRecord[]): ReportOption[] {
  const customers = new Map<string, ReportOption>();
  for (const order of orders) customers.set(order.leadCustomer.id, { id: order.leadCustomer.id, name: order.leadCustomer.name });
  for (const opportunity of opportunities) customers.set(opportunity.leadCustomer.id, { id: opportunity.leadCustomer.id, name: opportunity.leadCustomer.name });
  return Array.from(customers.values()).sort((left, right) => left.name.localeCompare(right.name));
}

async function loadFilterOptions(database: ReportsQueryDb, orders: OrderRecord[], opportunities: OpportunityRecord[], products: ProductServiceRecord[]): Promise<ReportsFilterOptions> {
  const owners = database.user
    ? await database.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } })
    : [];
  const stageMap = new Map<string, ReportOption>();
  for (const opportunity of opportunities) stageMap.set(opportunity.stage.id, { id: opportunity.stage.id, name: opportunity.stage.name });

  return {
    currencies: ["INR", "USD"],
    customers: optionsFromCustomers(orders, opportunities),
    owners: owners.map((owner) => ({ id: owner.id, name: owner.name, email: owner.email })),
    productServices: products.map((product) => ({ id: product.id, name: product.name })),
    stages: Array.from(stageMap.values()),
    statuses: Array.from(new Set(orders.map((order) => order.status))).sort()
  };
}

export async function getReportsOverview(
  user: ReportsUser,
  database: ReportsQueryDb = db as unknown as ReportsQueryDb,
  filters: ReportsFilters = {},
  now = new Date()
): Promise<ReportsOverview> {
  assertCanViewReports(user);

  const configuration = database.cellConfiguration
    ? await database.cellConfiguration.findUnique({ where: { id: "default" }, select: { defaultCurrency: true } })
    : null;
  const settings = configuration ?? (database.businessSettings
    ? await database.businessSettings.findUnique({ where: { id: "default" }, select: { defaultCurrency: true } })
    : null);
  const currency = filters.currency ?? settings?.defaultCurrency ?? "INR";
  const orderWhere = buildOrderWhere({ ...filters, currency });
  const opportunityWhere = buildOpportunityWhere(filters);
  const activityWhere = {
    status: "OPEN",
    ...(dateRangeWhere(filters) ? { dueAt: dateRangeWhere(filters) } : {}),
    ...(filters.customerId ? { leadCustomerId: filters.customerId } : {}),
    ...(filters.ownerId ? { ownerId: filters.ownerId } : {})
  };

  const [opportunities, orders, payments, productionWorkItems, activities, invoices, costs, incentives, products] = await Promise.all([
    database.opportunity.findMany({
      where: opportunityWhere,
      orderBy: [{ updatedAt: "desc" }],
      include: {
        leadCustomer: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } },
        proposals: { select: { id: true, status: true } },
        stage: { select: { id: true, kind: true, name: true, sortOrder: true } }
      }
    }),
    database.order.findMany({
      where: orderWhere,
      orderBy: [{ bookedAt: "desc" }],
      include: {
        costComponents: { select: { amountPaisa: true, orderLineItemId: true, status: true } },
        invoices: { select: { id: true, totalPaisa: true } },
        leadCustomer: { select: { id: true, name: true } },
        lineItems: { select: { id: true, lineSubtotalPaisa: true, productNameSnapshot: true, productServiceId: true } },
        owner: { select: { id: true, name: true } },
        payments: { select: { id: true, amountPaisa: true } }
      }
    }),
    database.payment.findMany({
      where: { order: orderWhere },
      orderBy: [{ paymentDate: "desc" }],
      select: { amountPaisa: true, id: true, paymentDate: true, order: { select: { currency: true, status: true } } }
    }),
    database.productionWorkItem.findMany({
      where: { orderLineItem: { order: orderWhere } },
      orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
      include: {
        assignedTo: { select: { id: true, name: true } },
        orderLineItem: {
          include: {
            order: { select: { id: true, orderNumber: true, leadCustomer: { select: { id: true, name: true } } } }
          }
        },
        stageInstances: {
          select: {
            assignedTo: { select: { id: true, name: true } },
            completedAt: true,
            dueAt: true,
            name: true,
            startedAt: true,
            status: true
          }
        }
      }
    }),
    database.activity.findMany({
      where: activityWhere,
      orderBy: [{ dueAt: "asc" }],
      include: { leadCustomer: { select: { id: true, name: true } }, owner: { select: { id: true, name: true } } }
    }),
    database.invoice?.findMany({
      orderBy: [{ invoiceDate: "desc" }],
      include: {
        order: {
          select: {
            id: true,
            currency: true,
            leadCustomer: { select: { id: true, name: true } },
            orderNumber: true,
            payments: { select: { amountPaisa: true, id: true } }
          }
        }
      }
    }) ?? Promise.resolve([]),
    database.costComponent?.findMany({
      orderBy: [{ id: "asc" }],
      include: {
        order: { select: { id: true, currency: true, leadCustomer: { select: { id: true, name: true } }, orderNumber: true } }
      }
    }) ?? Promise.resolve([]),
    database.incentive?.findMany({
      orderBy: [{ id: "asc" }],
      include: {
        order: { select: { id: true, currency: true, leadCustomer: { select: { id: true, name: true } }, orderNumber: true } }
      }
    }) ?? Promise.resolve([]),
    database.productService?.findMany({ orderBy: [{ name: "asc" }], select: { id: true, name: true } }) ?? Promise.resolve([])
  ]);

  const currentOrders = orders.filter(isCurrentOrder);
  const selectedProductName = products.find((product) => product.id === filters.productServiceId)?.name;
  const pipelineByStage = buildPipelineByStage(opportunities);
  const collections = buildCollections(currentOrders, payments);
  const pendingProduction = buildPendingProduction(productionWorkItems);
  const upcomingFollowUps = buildUpcomingFollowUps(activities, now);
  const topBillings = currentOrders.map(toBillingSummary).sort((left, right) => right.bookedValuePaisa - left.bookedValuePaisa);
  const recentOrders = [...currentOrders]
    .sort((left, right) => right.bookedAt.getTime() - left.bookedAt.getTime() || left.orderNumber.localeCompare(right.orderNumber) || left.id.localeCompare(right.id))
    .map(toBillingSummary)
    .slice(0, 5);
  const filterOptions = await loadFilterOptions(database, currentOrders, opportunities, products);
  const cockpit = buildCockpitReports({ activities, currency, orders, payments, workItems: productionWorkItems, now });

  return {
    cockpit,
    collections,
    currency,
    customers: buildCustomerReports(currentOrders, filters),
    dashboardMetrics: buildDashboardMetrics(currency, {
      collections,
      currentOrders,
      pendingProduction,
      pipelineByStage,
      upcomingFollowUpCount: upcomingFollowUps.length
    }),
    filterOptions,
    filters,
    finance: buildFinanceReports(currentOrders, invoices, costs, incentives, now),
    pendingProduction,
    pipelineByStage,
    production: buildProductionReports(productionWorkItems, now),
    products: buildProductReports(currentOrders, costs, selectedProductName),
    recentOrders,
    sales: buildSalesReports(opportunities, activities, pipelineByStage, now),
    topBillings: topBillings.slice(0, 5),
    topClients: buildTopClients(currentOrders).slice(0, 5),
    topProducts: buildTopProducts(currentOrders).slice(0, 5),
    upcomingFollowUps
  };
}
