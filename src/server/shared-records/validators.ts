import { z } from "zod";
import { sharedRecordSourceApps, sharedRecordTypes } from "./types";

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

const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.string().trim().toLowerCase().email("Enter a valid email address.").optional()
);

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)])
);

const optionalLimit = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return value;
}, z.number().int().min(1).max(100).optional());

export const sharedRecordUpsertSchema = z
  .object({
    entityType: z.enum(sharedRecordTypes),
    displayName: requiredTrimmedString("Enter a display name."),
    status: requiredTrimmedString("Enter a status."),
    ownerId: optionalTrimmedString,
    parentId: optionalTrimmedString,
    relatedLeadId: optionalTrimmedString,
    relatedCustomerId: optionalTrimmedString,
    relatedContactId: optionalTrimmedString,
    relatedOpportunityId: optionalTrimmedString,
    sourceApp: z.preprocess((value) => (typeof value === "string" ? value.trim().toLowerCase() : value), z.enum(sharedRecordSourceApps)),
    ecrmLegacyId: optionalTrimmedString,
    emailVoiceLegacyId: optionalTrimmedString,
    externalKey: optionalTrimmedString,
    email: optionalEmail,
    phone: optionalTrimmedString,
    companyName: optionalTrimmedString,
    data: jsonValueSchema.default({})
  })
  .superRefine((value, context) => {
    if (!value.ecrmLegacyId && !value.emailVoiceLegacyId && !value.externalKey) {
      context.addIssue({
        code: "custom",
        message: "Provide ecrmLegacyId, emailVoiceLegacyId, or externalKey."
      });
    }
  });

export const sharedRecordListFilterSchema = z.object({
  entityType: z.preprocess(emptyToUndefined, z.enum(sharedRecordTypes).optional()),
  q: optionalTrimmedString,
  status: optionalTrimmedString,
  parentId: optionalTrimmedString,
  limit: optionalLimit
});
