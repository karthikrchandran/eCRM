import type { OrderStatus, ProductionStageStatus, UserRole } from "@prisma/client";

export type ProductionUser = {
  id: string;
  role: UserRole;
};

export type ProductionStatusValue = ProductionStageStatus;

export type ProductionStageStatusInput = {
  status: ProductionStatusValue;
  noteBody?: string;
  skippedReason?: string;
};

export type ProductionFilters = {
  status?: ProductionStatusValue;
  assignedToId?: string;
  q?: string;
};

export type ProductionOrderStatusValue = OrderStatus;

export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};
