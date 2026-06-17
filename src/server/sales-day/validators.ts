import { z } from "zod";

const taskTypes = ["CALL", "EMAIL", "FOLLOW_UP", "SEND_MATERIAL", "MEETING", "CRM_UPDATE", "CUSTOM"] as const;
const taskPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const reviewStatuses = ["DONE", "MOVE_TO_TOMORROW", "BLOCKED", "WAITING_ON_CUSTOMER", "CANCEL"] as const;

const trimmedString = z.string().transform((value) => value.trim());
const nullToUndefined = (value: unknown) => (value === null ? undefined : value);

const requiredTrimmedString = (message: string) =>
  trimmedString.pipe(z.string().min(1, message));

const optionalTrimmedString = z.preprocess(
  nullToUndefined,
  z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : undefined;
    })
);

const optionalDate = z.preprocess(
  nullToUndefined,
  z
    .union([z.string(), z.date()])
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      if (value instanceof Date) return value;
      const trimmed = value.trim();
      return trimmed ? new Date(trimmed) : undefined;
    })
    .refine((value) => value === undefined || !Number.isNaN(value.getTime()), "Choose a valid date.")
);

const optionalPositiveInteger = z.preprocess(
  nullToUndefined,
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === "") return undefined;
      const parsed = Number(value);
      return Number.isInteger(parsed) && parsed >= 0 ? parsed : Number.NaN;
    })
    .refine((value) => value === undefined || !Number.isNaN(value), "Enter a valid duration.")
);

export const salesTaskInputSchema = z.object({
  title: requiredTrimmedString("Enter a task title."),
  description: optionalTrimmedString,
  type: z.enum(taskTypes),
  priority: z.enum(taskPriorities).default("MEDIUM"),
  dueAt: optionalDate,
  leadCustomerId: optionalTrimmedString,
  opportunityId: optionalTrimmedString,
  proposalId: optionalTrimmedString,
  orderId: optionalTrimmedString
});

export const salesTaskUpdateSchema = z.object({
  title: optionalTrimmedString,
  description: optionalTrimmedString,
  type: z.enum(taskTypes).optional(),
  priority: z.enum(taskPriorities).optional(),
  dueAt: optionalDate,
  leadCustomerId: optionalTrimmedString,
  opportunityId: optionalTrimmedString,
  proposalId: optionalTrimmedString,
  orderId: optionalTrimmedString
});

export const salesVoiceNoteUploadMetadataSchema = z.object({
  taskId: optionalTrimmedString,
  leadCustomerId: optionalTrimmedString,
  opportunityId: optionalTrimmedString,
  proposalId: optionalTrimmedString,
  orderId: optionalTrimmedString,
  durationSeconds: optionalPositiveInteger
});

export const acceptSuggestedActionSchema = z.object({
  actionId: requiredTrimmedString("Choose a suggested action.")
});

export const rejectSuggestedActionSchema = acceptSuggestedActionSchema;

export const salesDayReviewSchema = z.object({
  reviewDate: optionalDate.pipe(z.date({ error: "Choose a review date." })),
  notes: optionalTrimmedString,
  items: z
    .array(
      z.object({
        taskId: requiredTrimmedString("Choose a task."),
        status: z.enum(reviewStatuses),
        note: optionalTrimmedString
      })
    )
    .min(1, "Review at least one task.")
});

export type SalesTaskInput = z.infer<typeof salesTaskInputSchema>;
export type SalesTaskUpdateInput = z.infer<typeof salesTaskUpdateSchema>;
export type SalesVoiceNoteUploadMetadata = z.infer<typeof salesVoiceNoteUploadMetadataSchema>;
export type SalesDayReviewInput = z.infer<typeof salesDayReviewSchema>;
