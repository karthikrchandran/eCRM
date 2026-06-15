import type { OrderStatus } from "@prisma/client";

export type OrderUser = {
  id: string;
  role: "ADMIN" | "SALES";
};

export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export type OrderBookingInput = {
  proposalId: string;
  poNumber?: string;
  poDate?: Date;
  poFileName?: string;
  poStorageKey?: string;
  poFileSizeBytes?: number;
  poMimeType?: string;
  deliveryDueAt?: Date;
};

export type PoMetadataInput = Omit<OrderBookingInput, "proposalId">;

export type OrderStatusValue =
  | OrderStatus
  | "DRAFT"
  | "BOOKED"
  | "IN_PRODUCTION"
  | "READY_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";
