import type { UserRole } from "@prisma/client";
import type { ReportCurrency } from "@/components/reports/report-formatters";

export type ReportsUser = {
  email: string;
  id: string;
  name: string;
  role: UserRole;
};

export type ReportsFilters = {
  currency?: ReportCurrency;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  ownerId?: string;
  productServiceId?: string;
  stageId?: string;
  status?: string;
};

export type ReportOption = {
  id: string;
  label?: string;
  name: string;
  email?: string;
};

export type ReportsFilterOptions = {
  currencies: ReportCurrency[];
  customers: ReportOption[];
  owners: ReportOption[];
  productServices: ReportOption[];
  stages: ReportOption[];
  statuses: string[];
};

export type DashboardMetric = {
  detail: string;
  label: string;
  value: string;
};

export type PipelineStageSummary = {
  count: number;
  stageId: string;
  stageName: string;
  valuePaisa: number;
  weightedValuePaisa?: number;
};

export type TopClientSummary = {
  bookedValuePaisa: number;
  clientId: string;
  clientName: string;
  orderCount: number;
};

export type TopProductSummary = {
  bookedValuePaisa: number;
  lineItemCount: number;
  orderCount: number;
  productName: string;
};

export type TopBillingSummary = {
  bookedValuePaisa: number;
  clientId: string;
  clientName: string;
  orderId: string;
  orderNumber: string;
  ownerId: string;
  ownerName: string;
  status: string;
};

export type CollectionSummary = {
  collectedPaisa: number;
  paymentCount: number;
  pendingReceivablePaisa: number;
};

export type PendingProductionSummary = {
  clientName: string;
  dueAt: Date | null;
  orderId: string;
  orderNumber: string;
  productName: string;
  status: string;
  workItemId: string;
};

export type UpcomingFollowUpSummary = {
  activityId: string;
  clientName: string;
  dueAt: Date | null;
  ownerName: string;
  subject: string;
};

export type CountValueSummary = {
  count: number;
  status?: string;
  totalPaisa?: number;
};

export type AgingBucketSummary = {
  bucket: string;
  invoiceCount?: number;
  opportunityCount?: number;
  outstandingPaisa?: number;
};

export type SalesReports = {
  followUpCompliance: {
    overdue: number;
    upcoming: number;
  };
  opportunityAging: AgingBucketSummary[];
  pipelineFunnel: PipelineStageSummary[];
  proposalConversion: {
    accepted: number;
    total: number;
  };
  weightedPipelinePaisa: number;
  winLoss: {
    lost: number;
    won: number;
  };
};

export type FinanceReports = {
  costLeakagePaisa: number;
  grossMargin: {
    approvedCostPaisa: number;
    grossMarginPaisa: number;
    revenuePaisa: number;
  };
  incentives: {
    approvedPaisa: number;
    paidPaisa: number;
    payablePaisa: number;
  };
  invoiceStatus: CountValueSummary[];
  receivablesAging: AgingBucketSummary[];
};

export type ProductionReports = {
  blockedCount: number;
  cycleTimeDays: number;
  overdueCount: number;
  pendingByStage: Array<{ count: number; stageName: string }>;
  workloadByAssignee: Array<{ assigneeId: string; assigneeName: string; count: number }>;
};

export type CustomerReports = {
  dormantCustomers: Array<{ clientId: string; clientName: string }>;
  repeatCustomers: Array<{ clientId: string; clientName: string; orderCount: number }>;
  topCustomers: TopClientSummary[];
};

export type ProductReports = {
  revenueAndMargin: Array<{ grossMarginPaisa: number; productName: string; revenuePaisa: number }>;
  topProducts: TopProductSummary[];
};

export type ReportsOverview = {
  collections: CollectionSummary;
  currency: ReportCurrency;
  customers: CustomerReports;
  dashboardMetrics: DashboardMetric[];
  filters: ReportsFilters;
  filterOptions: ReportsFilterOptions;
  finance: FinanceReports;
  pendingProduction: PendingProductionSummary[];
  pipelineByStage: PipelineStageSummary[];
  production: ProductionReports;
  products: ProductReports;
  recentOrders: TopBillingSummary[];
  sales: SalesReports;
  topBillings: TopBillingSummary[];
  topClients: TopClientSummary[];
  topProducts: TopProductSummary[];
  upcomingFollowUps: UpcomingFollowUpSummary[];
};
