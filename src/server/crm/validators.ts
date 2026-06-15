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

const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.string().trim().toLowerCase().email("Enter a valid email address.").optional()
);

const optionalDate = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return new Date(trimmed);
}, z.date("Enter a valid date.").optional());

const checkboxBoolean = z.preprocess((value) => value === true || value === "on", z.boolean());

export const leadCustomerInputSchema = z.object({
  name: requiredTrimmedString("Enter a lead or customer name."),
  state: z.enum(["LEAD", "CUSTOMER", "DORMANT"]).default("LEAD"),
  industry: optionalTrimmedString,
  source: optionalTrimmedString,
  ownerId: requiredTrimmedString("Choose an owner."),
  notes: optionalTrimmedString
});

export const branchInputSchema = z.object({
  leadCustomerId: requiredTrimmedString("Choose a lead or customer."),
  name: requiredTrimmedString("Enter a branch name."),
  addressLine1: optionalTrimmedString,
  addressLine2: optionalTrimmedString,
  city: optionalTrimmedString,
  region: optionalTrimmedString,
  postalCode: optionalTrimmedString,
  country: z.preprocess((value) => {
    if (typeof value !== "string" || value.trim().length === 0) {
      return "India";
    }
    return value.trim();
  }, z.string().min(1)),
  gstin: optionalTrimmedString,
  locationHint: optionalTrimmedString,
  salesContext: optionalTrimmedString,
  notes: optionalTrimmedString
});

export const contactInputSchema = z.object({
  leadCustomerId: requiredTrimmedString("Choose a lead or customer."),
  branchId: optionalTrimmedString,
  name: requiredTrimmedString("Enter a contact name."),
  designation: optionalTrimmedString,
  email: optionalEmail,
  phone: optionalTrimmedString,
  isPrimary: checkboxBoolean.default(false),
  notes: optionalTrimmedString
});

export const activityInputSchema = z
  .object({
    leadCustomerId: requiredTrimmedString("Choose a lead or customer."),
    branchId: optionalTrimmedString,
    contactId: optionalTrimmedString,
    ownerId: requiredTrimmedString("Choose an owner."),
    type: z.enum(["CALL", "EMAIL", "MEETING", "NOTE", "FOLLOW_UP"]),
    status: z.enum(["OPEN", "COMPLETED", "CANCELLED"]).default("OPEN"),
    subject: requiredTrimmedString("Enter an activity subject."),
    body: optionalTrimmedString,
    occurredAt: optionalDate,
    dueAt: optionalDate
  })
  .superRefine((value, context) => {
    if (value.type === "FOLLOW_UP" && value.status === "OPEN" && !value.dueAt) {
      context.addIssue({
        code: "custom",
        path: ["dueAt"],
        message: "Choose a follow-up date."
      });
    }
  });

export const leadFilterSchema = z.object({
  q: optionalTrimmedString,
  ownerId: optionalTrimmedString,
  state: z.preprocess(emptyToUndefined, z.enum(["LEAD", "CUSTOMER", "DORMANT"]).optional()),
  followUp: z.preprocess(emptyToUndefined, z.enum(["overdue", "today", "upcoming"]).optional())
});

export const reassignmentInputSchema = z.object({
  leadCustomerId: requiredTrimmedString("Choose a lead or customer."),
  toOwnerId: requiredTrimmedString("Choose the new owner."),
  reason: requiredTrimmedString("Enter a reassignment reason.")
});
