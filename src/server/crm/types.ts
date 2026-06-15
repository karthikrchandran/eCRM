import type { ActivityStatus, ActivityType, LeadState } from "@prisma/client";

export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export type LeadCustomerInput = {
  name: string;
  state: LeadState;
  industry?: string;
  source?: string;
  ownerId: string;
  notes?: string;
};

export type BranchInput = {
  leadCustomerId: string;
  name: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country: string;
  gstin?: string;
  locationHint?: string;
  salesContext?: string;
  notes?: string;
};

export type ContactInput = {
  leadCustomerId: string;
  branchId?: string;
  name: string;
  designation?: string;
  email?: string;
  phone?: string;
  isPrimary: boolean;
  notes?: string;
};

export type ActivityInput = {
  leadCustomerId: string;
  branchId?: string;
  contactId?: string;
  ownerId: string;
  type: ActivityType;
  status: ActivityStatus;
  subject: string;
  body?: string;
  occurredAt?: Date;
  dueAt?: Date;
};

export type LeadFilters = {
  q?: string;
  ownerId?: string;
  state?: LeadState;
  followUp?: "overdue" | "today" | "upcoming";
};

export type ReassignmentInput = {
  leadCustomerId: string;
  toOwnerId: string;
  reason: string;
};
