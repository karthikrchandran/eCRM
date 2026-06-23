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

const optionalPositiveInt = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === "") {
      return undefined;
    }

    return Number(value);
  },
  z.number().int().positive().optional()
);

export const poMetadataInputSchema = z.object({
  deliveryDueAt: optionalDate,
  poDate: optionalDate,
  poFileName: optionalTrimmedString,
  poFileSizeBytes: optionalPositiveInt,
  poMimeType: optionalTrimmedString,
  poNumber: optionalTrimmedString,
  poStorageKey: optionalTrimmedString
});

export const orderBookingInputSchema = poMetadataInputSchema.extend({
  proposalId: z.preprocess((value) => value?.toString().trim(), z.string().min(1))
});

export const orderStatusTransitionSchema = z.object({
  status: z.enum(["DRAFT", "BOOKED", "IN_PRODUCTION", "READY_FOR_DELIVERY", "DELIVERED", "CANCELLED"])
});

export const orderListFilterSchema = z.object({
  financialYear: z.preprocess(
    (value) => {
      if (value === null || value === undefined || value === "") {
        return undefined;
      }

      return Number(value);
    },
    z.number().int().min(2020).max(2100).optional()
  ),
  quarter: z.preprocess(
    (value) => {
      if (value === null || value === undefined || value === "") {
        return undefined;
      }

      return Number(value);
    },
    z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional()
  ),
  status: z.preprocess(
    (value) => {
      if (value === null || value === undefined || value === "") {
        return undefined;
      }

      return value;
    },
    z.enum(["DRAFT", "BOOKED", "IN_PRODUCTION", "READY_FOR_DELIVERY", "DELIVERED", "CANCELLED"]).optional()
  )
});
