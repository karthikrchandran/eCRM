import { z } from "zod";
import type { ProposalStatusContext, ProposalStatusValue } from "./types";

const maxPdfSizeBytes = 25 * 1024 * 1024;

const emptyToUndefined = (value: unknown) => {
  if (value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const requiredTrimmedString = (message: string) =>
  z
    .string({ error: message })
    .trim()
    .min(1, message);

const optionalTrimmedString = z.preprocess(emptyToUndefined, z.string().trim().optional());

const optionalDate = z.preprocess((value) => {
  const normalized = emptyToUndefined(value);

  if (normalized === undefined || normalized instanceof Date) {
    return normalized;
  }

  return new Date(String(normalized));
}, z.date("Enter a valid date.").optional());

const nonNegativeInt = (message: string) => z.coerce.number().int(message).min(0, message);
const positiveInt = (message: string) => z.coerce.number().int(message).min(1, message);

export const proposalInputSchema = z.object({
  opportunityId: requiredTrimmedString("Choose an opportunity."),
  title: requiredTrimmedString("Enter a proposal title."),
  versionLabel: optionalTrimmedString,
  validUntil: optionalDate,
  commercialSummary: optionalTrimmedString,
  assumptions: optionalTrimmedString,
  inclusions: optionalTrimmedString,
  exclusions: optionalTrimmedString,
  paymentTerms: optionalTrimmedString,
  deliveryTimeline: optionalTrimmedString,
  internalNotes: optionalTrimmedString
});

export const proposalLineInputSchema = z
  .object({
    productServiceId: requiredTrimmedString("Choose a product or service."),
    productDefaultGstRateBps: nonNegativeInt("Enter GST basis points from 0 to 2800.").max(
      2800,
      "Enter GST basis points from 0 to 2800."
    ).optional(),
    description: optionalTrimmedString,
    quantity: positiveInt("Enter a quantity of 1 or greater."),
    unitPricePaisa: nonNegativeInt("Enter a unit price of 0 or greater."),
    gstRateBps: nonNegativeInt("Enter GST basis points from 0 to 2800.").max(2800, "Enter GST basis points from 0 to 2800."),
    gstOverrideReason: optionalTrimmedString
  })
  .superRefine((value, context) => {
    if (
      value.productDefaultGstRateBps !== undefined &&
      value.gstRateBps !== value.productDefaultGstRateBps &&
      !value.gstOverrideReason
    ) {
      context.addIssue({
        code: "custom",
        path: ["gstOverrideReason"],
        message: "Enter a GST override reason."
      });
    }
  })
  .transform((value) => {
    const output = { ...value };
    delete output.productDefaultGstRateBps;
    return output;
  });

const hasSafeExternalScheme = (value: string) => {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "https:" || protocol === "http:";
  } catch {
    return true;
  }
};

const safeExternalUrl = (message: string) => z.string().trim().url(message).refine(hasSafeExternalScheme, message);
const proposalDocumentUrl = z.preprocess(emptyToUndefined, safeExternalUrl("Enter a valid proposal document URL.").optional());

export const proposalPdfMetadataInputSchema = z
  .object({
    originalFileName: requiredTrimmedString("Enter the proposal document name."),
    documentUrl: proposalDocumentUrl,
    storedFileName: optionalTrimmedString,
    storageProvider: z.preprocess(emptyToUndefined, z.string().trim().default("external")),
    storageKey: optionalTrimmedString,
    mimeType: z.preprocess(emptyToUndefined, z.literal("application/pdf").default("application/pdf")),
    fileSizeBytes: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(1).max(maxPdfSizeBytes, "PDF must be 25 MB or smaller.").default(1)
    ),
    sha256: optionalTrimmedString,
    canvaDesignUrl: z.preprocess(emptyToUndefined, safeExternalUrl("Enter a valid Canva URL.").optional())
  })
  .superRefine((value, context) => {
    if (!value.documentUrl && !value.storageKey) {
      context.addIssue({
        code: "custom",
        path: ["documentUrl"],
        message: "Enter a valid proposal document URL."
      });
    }
  })
  .transform((value) => ({
    originalFileName: value.originalFileName,
    storedFileName: value.storedFileName ?? value.originalFileName,
    storageProvider: value.storageProvider,
    storageKey: value.storageKey ?? value.documentUrl!,
    mimeType: value.mimeType,
    fileSizeBytes: value.fileSizeBytes,
    sha256: value.sha256,
    canvaDesignUrl: value.canvaDesignUrl
  }));

export function assertProposalStatusTransition(
  currentStatus: ProposalStatusValue,
  nextStatus: ProposalStatusValue,
  context: ProposalStatusContext
) {
  if (currentStatus === nextStatus) {
    return;
  }

  if (nextStatus === "SENT") {
    if (context.lineItemCount < 1) {
      throw new Error("Add at least one proposal line before sending.");
    }

    if (context.activePdfCount < 1) {
      throw new Error("Add a proposal document link before sending.");
    }
  }

  if (["REJECTED", "EXPIRED", "WITHDRAWN"].includes(String(currentStatus))) {
    throw new Error("Terminal proposal statuses cannot be changed.");
  }
}
