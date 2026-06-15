import type { PipelineStageKind } from "@prisma/client";

export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export type OpportunityInput = {
  leadCustomerId: string;
  branchId?: string;
  stageId: string;
  ownerId: string;
  title: string;
  productInterest?: string;
  estimatedValueInr?: string;
  probability?: number;
  lastReachAt?: Date;
  nextFollowUpAt?: Date;
  notes?: string;
};

export type PipelineStageInput = {
  name: string;
  sortOrder: number;
  kind: PipelineStageKind;
  active: boolean;
};

export type SalesTargetInput = {
  ownerId: string;
  financialYear: number;
  quarter: number;
  targetValueInr: string;
};

export type OpportunityFilters = {
  q?: string;
  ownerId?: string;
  stageId?: string;
  followUp?: "overdue" | "today" | "upcoming";
  view?: "list" | "board";
};
