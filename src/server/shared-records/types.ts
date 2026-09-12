import type { Prisma } from "@prisma/client";

export const sharedRecordTypes = ["LEAD", "CUSTOMER", "CONTACT", "OPPORTUNITY", "ORDER"] as const;
export type SharedRecordType = (typeof sharedRecordTypes)[number];

export const sharedRecordSourceApps = ["ecrm", "emailvoice"] as const;
export type SharedRecordSourceApp = (typeof sharedRecordSourceApps)[number];

export type SharedBusinessRecordRow = {
  id: string;
  entityType: SharedRecordType;
  displayName: string;
  status: string;
  ownerId: string | null;
  parentId: string | null;
  relatedLeadId: string | null;
  relatedCustomerId: string | null;
  relatedContactId: string | null;
  relatedOpportunityId: string | null;
  sourceApp: string;
  ecrmLegacyId: string | null;
  emailVoiceLegacyId: string | null;
  externalKey: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  searchText: string;
  headVersion?: number;
  data: Prisma.JsonValue;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SharedBusinessRecordDto = Omit<SharedBusinessRecordRow, "archivedAt" | "createdAt" | "updatedAt"> & {
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SharedRecordUpsertInput = {
  entityType: SharedRecordType;
  displayName: string;
  status: string;
  ownerId?: string;
  parentId?: string;
  relatedLeadId?: string;
  relatedCustomerId?: string;
  relatedContactId?: string;
  relatedOpportunityId?: string;
  sourceApp: SharedRecordSourceApp;
  ecrmLegacyId?: string;
  emailVoiceLegacyId?: string;
  externalKey?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  data: Prisma.InputJsonValue;
};

export type SharedRecordListFilters = {
  entityType?: SharedRecordType;
  q?: string;
  status?: string;
  parentId?: string;
  limit?: number;
};

export type SharedRecordMutationResult = {
  record: SharedBusinessRecordDto;
  created: boolean;
};
