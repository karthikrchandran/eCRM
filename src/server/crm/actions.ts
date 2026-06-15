import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import type { LeadCustomerInput } from "./types";
import type { ActionState } from "./types";
import {
  activityInputSchema,
  branchInputSchema,
  contactInputSchema,
  leadCustomerInputSchema,
  reassignmentInputSchema
} from "./validators";
import {
  completeActivity,
  createActivity,
  createBranch,
  createContact,
  createLeadCustomer,
  reassignLeadOwner,
  updateLeadCustomer
} from "./mutations";

type FieldErrorSource = {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
};

type LeadCustomerParseResult = { ok: false; fieldErrors: Record<string, string[]> } | { ok: true; data: LeadCustomerInput };

function fieldErrorState(error: FieldErrorSource): ActionState {
  const fieldErrors = Object.fromEntries(
    Object.entries(error.flatten().fieldErrors).filter((entry): entry is [string, string[]] => Boolean(entry[1]?.length))
  );

  return { ok: false, fieldErrors };
}

export function parseLeadCustomerFormForTest(formData: FormData): LeadCustomerParseResult {
  const result = leadCustomerInputSchema.safeParse({
    name: formData.get("name"),
    state: formData.get("state"),
    industry: formData.get("industry"),
    source: formData.get("source"),
    ownerId: formData.get("ownerId"),
    notes: formData.get("notes")
  });

  if (!result.success) {
    return fieldErrorState(result.error) as LeadCustomerParseResult;
  }

  return { ok: true, data: result.data };
}

export async function createLeadCustomerAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  "use server";

  const user = await requireUser();
  const parsed = parseLeadCustomerFormForTest(formData);

  if (!parsed.ok) {
    return parsed;
  }

  const record = await createLeadCustomer(user, parsed.data);
  revalidatePath("/leads");
  redirect(`/leads/${record.id}`);
}

export async function updateLeadCustomerAction(
  leadCustomerId: string,
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";

  const user = await requireUser();
  const parsed = parseLeadCustomerFormForTest(formData);

  if (!parsed.ok) {
    return parsed;
  }

  await updateLeadCustomer(user, leadCustomerId, parsed.data);
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadCustomerId}`);
  redirect(`/leads/${leadCustomerId}`);
}

export async function createBranchAction(
  leadCustomerId: string,
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";

  const user = await requireUser();
  const result = branchInputSchema.safeParse({
    leadCustomerId,
    name: formData.get("name"),
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2"),
    city: formData.get("city"),
    region: formData.get("region"),
    postalCode: formData.get("postalCode"),
    country: formData.get("country"),
    gstin: formData.get("gstin"),
    locationHint: formData.get("locationHint"),
    salesContext: formData.get("salesContext"),
    notes: formData.get("notes")
  });

  if (!result.success) {
    return fieldErrorState(result.error);
  }

  await createBranch(user, result.data);
  revalidatePath(`/leads/${leadCustomerId}`);
  redirect(`/leads/${leadCustomerId}`);
}

export async function createContactAction(
  leadCustomerId: string,
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";

  const user = await requireUser();
  const result = contactInputSchema.safeParse({
    leadCustomerId,
    branchId: formData.get("branchId"),
    name: formData.get("name"),
    designation: formData.get("designation"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    isPrimary: formData.get("isPrimary"),
    notes: formData.get("notes")
  });

  if (!result.success) {
    return fieldErrorState(result.error);
  }

  await createContact(user, result.data);
  revalidatePath(`/leads/${leadCustomerId}`);
  redirect(`/leads/${leadCustomerId}`);
}

export async function createActivityAction(
  leadCustomerId: string,
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";

  const user = await requireUser();
  const result = activityInputSchema.safeParse({
    leadCustomerId,
    branchId: formData.get("branchId"),
    contactId: formData.get("contactId"),
    ownerId: formData.get("ownerId"),
    type: formData.get("type"),
    status: formData.get("status"),
    subject: formData.get("subject"),
    body: formData.get("body"),
    occurredAt: formData.get("occurredAt"),
    dueAt: formData.get("dueAt")
  });

  if (!result.success) {
    return fieldErrorState(result.error);
  }

  await createActivity(user, result.data);
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadCustomerId}`);
  redirect(`/leads/${leadCustomerId}`);
}

export async function completeActivityAction(leadCustomerId: string, activityId: string) {
  "use server";

  const user = await requireUser();
  await completeActivity(user, activityId);
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadCustomerId}`);
}

export async function reassignLeadOwnerAction(
  leadCustomerId: string,
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";

  const user = await requireUser();
  const result = reassignmentInputSchema.safeParse({
    leadCustomerId,
    toOwnerId: formData.get("toOwnerId"),
    reason: formData.get("reason")
  });

  if (!result.success) {
    return fieldErrorState(result.error);
  }

  await reassignLeadOwner(user, result.data);
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadCustomerId}`);
  return { ok: true, message: "Owner reassigned." };
}
