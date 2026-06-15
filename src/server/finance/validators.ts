import { z } from "zod";

const optionalTrimmedString = z.preprocess(
  (value) => {
    if (value === null || value === undefined) {
      return undefined;
    }

    const trimmed = value.toString().trim();
    return trimmed.length ? trimmed : undefined;
  },
  z.string().optional()
);

const requiredTrimmedString = z.preprocess((value) => value?.toString().trim(), z.string().min(1));

const optionalDate = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === "") {
      return undefined;
    }

    const date = new Date(value.toString());
    return Number.isNaN(date.getTime()) ? value : date;
  },
  z.date().optional()
);

const requiredDate = z.preprocess((value) => {
  const date = new Date(value?.toString() ?? "");
  return Number.isNaN(date.getTime()) ? value : date;
}, z.date());

const positiveInt = z.preprocess((value) => Number(value), z.number().int().positive());
const nonNegativeInt = z.preprocess((value) => Number(value), z.number().int().nonnegative());
const optionalNonNegativeInt = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === "") {
      return undefined;
    }

    return Number(value);
  },
  z.number().int().nonnegative().optional()
);

const paymentAllocationSchema = z.object({
  amountPaisa: positiveInt,
  invoiceId: requiredTrimmedString
});

export const invoiceInputSchema = z.object({
  dueDate: optionalDate,
  gstPaisa: nonNegativeInt,
  invoiceDate: requiredDate,
  invoiceNumber: requiredTrimmedString,
  notes: optionalTrimmedString,
  orderId: requiredTrimmedString,
  subtotalPaisa: positiveInt
});

export const paymentInputSchema = z
  .object({
    allocations: z.array(paymentAllocationSchema).min(1),
    amountPaisa: positiveInt,
    mode: z.enum(["BANK_TRANSFER", "UPI", "CHEQUE", "CASH", "CARD", "OTHER"]),
    notes: optionalTrimmedString,
    orderId: requiredTrimmedString,
    overpaymentAcknowledged: z.coerce.boolean().optional(),
    paymentDate: requiredDate,
    reference: optionalTrimmedString
  })
  .refine((input) => input.allocations.reduce((total, allocation) => total + allocation.amountPaisa, 0) === input.amountPaisa, {
    message: "Payment allocations must equal the payment amount.",
    path: ["allocations"]
  });

export const costComponentInputSchema = z.object({
  amountPaisa: nonNegativeInt,
  category: requiredTrimmedString,
  description: requiredTrimmedString,
  orderId: requiredTrimmedString,
  orderLineItemId: optionalTrimmedString
});

export const costStatusInputSchema = z
  .object({
    reason: optionalTrimmedString,
    status: z.enum(["APPROVED", "REJECTED", "VOID"])
  })
  .refine((input) => input.status === "APPROVED" || Boolean(input.reason), {
    message: "Reason is required for rejection or void.",
    path: ["reason"]
  });

const incentiveSplitSchema = z.object({
  percent: z.preprocess((value) => Number(value), z.number().int().min(1).max(100)),
  userId: requiredTrimmedString
});

export const incentiveSplitInputSchema = z
  .object({
    splits: z.array(incentiveSplitSchema).min(1)
  })
  .refine((input) => input.splits.reduce((total, split) => total + split.percent, 0) === 100, {
    message: "Incentive splits must total exactly 100 percent.",
    path: ["splits"]
  });

export const incentiveApprovalInputSchema = z
  .object({
    overrideAmountPaisa: optionalNonNegativeInt,
    overrideReason: optionalTrimmedString
  })
  .refine((input) => input.overrideAmountPaisa === undefined || Boolean(input.overrideReason), {
    message: "Override reason is required when override amount is set.",
    path: ["overrideReason"]
  });
