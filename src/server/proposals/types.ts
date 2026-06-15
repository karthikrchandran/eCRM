import type { ProposalStatus } from "@prisma/client";

export type ProposalUser = {
  id: string;
  role: "ADMIN" | "SALES";
};

export type ProposalInput = {
  opportunityId: string;
  title: string;
  versionLabel?: string;
  validUntil?: Date;
  commercialSummary?: string;
  assumptions?: string;
  inclusions?: string;
  exclusions?: string;
  paymentTerms?: string;
  deliveryTimeline?: string;
  internalNotes?: string;
};

export type ProposalLineInput = {
  productServiceId: string;
  description?: string;
  quantity: number;
  unitPricePaisa: number;
  gstRateBps: number;
  gstOverrideReason?: string;
};

export type ProposalPdfMetadataInput = {
  originalFileName: string;
  storedFileName: string;
  storageProvider: string;
  storageKey: string;
  mimeType: "application/pdf";
  fileSizeBytes: number;
  sha256?: string;
  canvaDesignUrl?: string;
};

export type ProposalStatusContext = {
  lineItemCount: number;
  activePdfCount: number;
};

export type ProposalStatusValue = ProposalStatus | "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "WITHDRAWN";
