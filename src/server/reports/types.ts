import type { UserRole } from "@prisma/client";

export type ReportsUser = {
  email: string;
  id: string;
  name: string;
  role: UserRole;
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
  clientName: string;
  orderId: string;
  orderNumber: string;
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

export type ReportsOverview = {
  collections: CollectionSummary;
  dashboardMetrics: DashboardMetric[];
  pendingProduction: PendingProductionSummary[];
  pipelineByStage: PipelineStageSummary[];
  recentOrders: TopBillingSummary[];
  topBillings: TopBillingSummary[];
  topClients: TopClientSummary[];
  topProducts: TopProductSummary[];
  upcomingFollowUps: UpcomingFollowUpSummary[];
};
