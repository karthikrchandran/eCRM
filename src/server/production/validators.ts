import { z } from "zod";

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

const optionalTrimmedString = z.preprocess(emptyToUndefined, z.string().trim().optional());

export const productionStageStatusSchema = z.enum(["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "DONE", "SKIPPED"]);

export const productionStageStatusInputSchema = z
  .object({
    status: productionStageStatusSchema,
    noteBody: optionalTrimmedString,
    skippedReason: optionalTrimmedString
  })
  .superRefine((value, context) => {
    if (value.status === "SKIPPED" && !value.skippedReason) {
      context.addIssue({
        code: "custom",
        path: ["skippedReason"],
        message: "Enter a skipped reason."
      });
    }
  });

export const productionFiltersSchema = z.object({
  status: z.preprocess(emptyToUndefined, productionStageStatusSchema.optional()),
  assignedToId: optionalTrimmedString,
  q: optionalTrimmedString
});
