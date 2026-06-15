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

const requiredTrimmedString = (message: string) =>
  z
    .string({ error: message })
    .trim()
    .min(1, message);

const optionalTrimmedString = z.preprocess(emptyToUndefined, z.string().trim().optional());

const optionalDate = z.preprocess((value) => {
  if (value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return new Date(trimmed);
}, z.date("Enter a valid date.").optional());

function normalizeAmount(value: unknown) {
  const normalized = emptyToUndefined(value);

  if (normalized === undefined) {
    return undefined;
  }

  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount < 0) {
    return normalized;
  }

  return amount.toFixed(2);
}

const amountPattern = /^\d+(\.\d{2})$/;

const optionalAmount = z.preprocess(
  normalizeAmount,
  z.string().regex(amountPattern, "Enter a non-negative estimated value.").optional()
);

const requiredAmount = z.preprocess(
  normalizeAmount,
  z.string({ error: "Enter a non-negative target amount." }).regex(amountPattern, "Enter a non-negative target amount.")
);

const optionalProbability = z.preprocess(
  (value) => {
    const normalized = emptyToUndefined(value);
    return normalized === undefined ? undefined : Number(normalized);
  },
  z
    .number("Enter probability from 0 to 100.")
    .int("Enter probability from 0 to 100.")
    .min(0, "Enter probability from 0 to 100.")
    .max(100, "Enter probability from 0 to 100.")
    .optional()
);

const checkboxBoolean = z.preprocess((value) => value === true || value === "on", z.boolean());

export const opportunityInputSchema = z.object({
  leadCustomerId: requiredTrimmedString("Choose a lead or customer."),
  branchId: optionalTrimmedString,
  stageId: requiredTrimmedString("Choose a pipeline stage."),
  ownerId: requiredTrimmedString("Choose an owner."),
  title: requiredTrimmedString("Enter an opportunity title."),
  productInterest: optionalTrimmedString,
  estimatedValueInr: optionalAmount,
  probability: optionalProbability,
  lastReachAt: optionalDate,
  nextFollowUpAt: optionalDate,
  notes: optionalTrimmedString
});

export const pipelineStageInputSchema = z.object({
  name: requiredTrimmedString("Enter a stage name."),
  sortOrder: z.coerce.number().int().min(0),
  kind: z.enum(["OPEN", "WON", "LOST", "DORMANT"]),
  active: checkboxBoolean.default(false)
});

export const salesTargetInputSchema = z.object({
  ownerId: requiredTrimmedString("Choose an owner."),
  financialYear: z.coerce.number().int().min(2020).max(2100),
  quarter: z.coerce.number().int().min(1).max(4),
  targetValueInr: requiredAmount
});

export const opportunityFilterSchema = z.object({
  q: optionalTrimmedString,
  ownerId: optionalTrimmedString,
  stageId: optionalTrimmedString,
  followUp: z.preprocess(emptyToUndefined, z.enum(["overdue", "today", "upcoming"]).optional()),
  view: z.preprocess(emptyToUndefined, z.enum(["list", "board"]).default("list"))
});
