import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current-user";
import { calculateInvoiceTotals } from "./calculations";
import { approveIncentive, createCostComponent, createInvoice, recordPayment } from "./mutations";
import type { ActionState, CostComponentInput, IncentiveApprovalInput, InvoiceInput, PaymentInput } from "./types";
import { costComponentInputSchema, incentiveApprovalInputSchema, invoiceInputSchema, paymentInputSchema } from "./validators";

type FieldErrorSource = {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
};

type ParseResult<T> = { ok: false; fieldErrors: Record<string, string[]> } | { ok: true; data: T };

function fieldErrorState(error: FieldErrorSource): ActionState {
  const fieldErrors = Object.fromEntries(
    Object.entries(error.flatten().fieldErrors).filter((entry): entry is [string, string[]] => Boolean(entry[1]?.length))
  );

  return { ok: false, fieldErrors };
}

function parseAllocations(value: FormDataEntryValue | null) {
  if (!value) {
    return [];
  }

  try {
    return JSON.parse(value.toString()) as unknown;
  } catch {
    return value;
  }
}

export function parseInvoiceFormForTest(formData: FormData): ParseResult<InvoiceInput & { totalPaisa: number }> {
  const result = invoiceInputSchema.safeParse({
    dueDate: formData.get("dueDate"),
    gstPaisa: formData.get("gstPaisa"),
    invoiceDate: formData.get("invoiceDate"),
    invoiceNumber: formData.get("invoiceNumber"),
    notes: formData.get("notes"),
    orderId: formData.get("orderId"),
    subtotalPaisa: formData.get("subtotalPaisa")
  });

  if (!result.success) {
    return fieldErrorState(result.error) as ParseResult<InvoiceInput & { totalPaisa: number }>;
  }

  return { ok: true, data: { ...result.data, totalPaisa: calculateInvoiceTotals(result.data.subtotalPaisa, 0).totalPaisa + result.data.gstPaisa } };
}

export function parsePaymentFormForTest(formData: FormData): ParseResult<PaymentInput> {
  const result = paymentInputSchema.safeParse({
    allocations: parseAllocations(formData.get("allocations")),
    amountPaisa: formData.get("amountPaisa"),
    mode: formData.get("mode"),
    notes: formData.get("notes"),
    orderId: formData.get("orderId"),
    overpaymentAcknowledged: formData.get("overpaymentAcknowledged"),
    paymentDate: formData.get("paymentDate"),
    reference: formData.get("reference")
  });

  if (!result.success) {
    return fieldErrorState(result.error) as ParseResult<PaymentInput>;
  }

  return { ok: true, data: result.data };
}

export function parseCostComponentFormForTest(formData: FormData): ParseResult<CostComponentInput> {
  const result = costComponentInputSchema.safeParse({
    amountPaisa: formData.get("amountPaisa"),
    category: formData.get("category"),
    description: formData.get("description"),
    orderId: formData.get("orderId"),
    orderLineItemId: formData.get("orderLineItemId")
  });

  if (!result.success) {
    return fieldErrorState(result.error) as ParseResult<CostComponentInput>;
  }

  return { ok: true, data: result.data };
}

export function parseIncentiveApprovalFormForTest(formData: FormData): ParseResult<IncentiveApprovalInput> {
  const result = incentiveApprovalInputSchema.safeParse({
    overrideAmountPaisa: formData.get("overrideAmountPaisa"),
    overrideReason: formData.get("overrideReason")
  });

  if (!result.success) {
    return fieldErrorState(result.error) as ParseResult<IncentiveApprovalInput>;
  }

  return { ok: true, data: result.data };
}

export async function createInvoiceAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  "use server";

  const user = await requireUser();
  const parsed = parseInvoiceFormForTest(formData);

  if (!parsed.ok) {
    return parsed;
  }

  await createInvoice(user, parsed.data);
  revalidatePath("/orders");
  revalidatePath(`/orders/${parsed.data.orderId}`);
  return { ok: true, message: "Invoice saved." };
}

export async function recordPaymentAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  "use server";

  const user = await requireUser();
  const parsed = parsePaymentFormForTest(formData);

  if (!parsed.ok) {
    return parsed;
  }

  await recordPayment(user, parsed.data);
  revalidatePath("/orders");
  revalidatePath(`/orders/${parsed.data.orderId}`);
  return { ok: true, message: "Payment recorded." };
}

export async function createCostComponentAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  "use server";

  const user = await requireUser();
  const parsed = parseCostComponentFormForTest(formData);

  if (!parsed.ok) {
    return parsed;
  }

  await createCostComponent(user, parsed.data);
  revalidatePath("/orders");
  revalidatePath(`/orders/${parsed.data.orderId}`);
  return { ok: true, message: "Cost component saved." };
}

export async function approveIncentiveAction(incentiveId: string, _previousState: ActionState, formData: FormData): Promise<ActionState> {
  "use server";

  const user = await requireUser();
  const parsed = parseIncentiveApprovalFormForTest(formData);

  if (!parsed.ok) {
    return parsed;
  }

  await approveIncentive(user, incentiveId, parsed.data);
  revalidatePath("/orders");
  return { ok: true, message: "Incentive approved." };
}
