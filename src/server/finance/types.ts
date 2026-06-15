import type { CostComponentStatus, InvoiceStatus, PaymentMode } from "@prisma/client";

export type FinanceUser = {
  id: string;
  role: "ADMIN" | "SALES";
};

export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export type InvoiceInput = {
  orderId: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate?: Date;
  subtotalPaisa: number;
  gstPaisa: number;
  notes?: string;
};

export type PaymentInput = {
  orderId: string;
  paymentDate: Date;
  amountPaisa: number;
  mode: PaymentMode;
  reference?: string;
  notes?: string;
  allocations: Array<{ invoiceId: string; amountPaisa: number }>;
  overpaymentAcknowledged?: boolean;
};

export type CostComponentInput = {
  orderId: string;
  orderLineItemId?: string;
  category: string;
  description: string;
  amountPaisa: number;
};

export type CostStatusInput = {
  status: CostComponentStatus | "APPROVED" | "REJECTED" | "VOID";
  reason?: string;
};

export type IncentiveApprovalInput = {
  overrideAmountPaisa?: number;
  overrideReason?: string;
};

export type InvoiceStatusValue = InvoiceStatus | "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "VOID";
