import type { OrderStatus, ProductionStageStatus, UserRole } from "@prisma/client";

export type ProductionUser = {
  id: string;
  role: UserRole;
};

export type ProductionStatusValue = ProductionStageStatus;

export type ProductionStageStatusInput = {
  assignedToId?: string;
  dueAt?: Date;
  status: ProductionStatusValue;
  noteBody?: string;
  skippedReason?: string;
};

export type ProductionTemplateInput = {
  id?: string;
  key: string;
  name: string;
  description?: string;
  active: boolean;
  sortOrder: number;
};

export type ProductionTemplateStageInput = {
  templateId: string;
  stageId?: string;
  key: string;
  name: string;
  description?: string;
  required: boolean;
  defaultDurationDays?: number;
  sortOrder: number;
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
