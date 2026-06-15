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

const optionalCode = z.preprocess((value) => {
  const normalized = emptyToUndefined(value);
  return typeof normalized === "string" ? normalized.toUpperCase() : normalized;
}, z.string().trim().optional());

const gstBasisPoints = z.preprocess(
  (value) => {
    const normalized = emptyToUndefined(value);
    return normalized === undefined ? 1800 : Number(normalized);
  },
  z
    .number("Enter GST basis points from 0 to 2800.")
    .int("Enter GST basis points from 0 to 2800.")
    .min(0, "Enter GST basis points from 0 to 2800.")
    .max(2800, "Enter GST basis points from 0 to 2800.")
);

const sortOrder = z.coerce
  .number()
  .int("Enter a sort order of 0 or greater.")
  .min(0, "Enter a sort order of 0 or greater.");

const checkboxBoolean = z.preprocess((value) => value === true || value === "on", z.boolean());

export const productServiceInputSchema = z.object({
  name: requiredTrimmedString("Enter a product or service name."),
  code: optionalCode,
  category: requiredTrimmedString("Enter a product or service category."),
  description: optionalTrimmedString,
  defaultGstRateBps: gstBasisPoints,
  defaultProductionTemplateKey: optionalTrimmedString,
  active: checkboxBoolean.default(false),
  sortOrder
});
