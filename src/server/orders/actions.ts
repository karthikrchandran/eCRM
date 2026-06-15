import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import { changeOrderStatus, createOrderFromAcceptedProposal, updateOrderPoMetadata } from "./mutations";
import type { ActionState, OrderBookingInput, OrderStatusValue, PoMetadataInput } from "./types";
import { orderBookingInputSchema, orderStatusTransitionSchema, poMetadataInputSchema } from "./validators";

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

export function parseOrderBookingFormForTest(formData: FormData): ParseResult<OrderBookingInput> {
  const result = orderBookingInputSchema.safeParse({
    deliveryDueAt: formData.get("deliveryDueAt"),
    poDate: formData.get("poDate"),
    poFileName: formData.get("poFileName"),
    poFileSizeBytes: formData.get("poFileSizeBytes"),
    poMimeType: formData.get("poMimeType"),
    poNumber: formData.get("poNumber"),
    poStorageKey: formData.get("poStorageKey"),
    proposalId: formData.get("proposalId")
  });

  if (!result.success) {
    return fieldErrorState(result.error) as ParseResult<OrderBookingInput>;
  }

  return { ok: true, data: result.data };
}

export function parsePoMetadataFormForTest(formData: FormData): ParseResult<PoMetadataInput> {
  const result = poMetadataInputSchema.safeParse({
    deliveryDueAt: formData.get("deliveryDueAt"),
    poDate: formData.get("poDate"),
    poFileName: formData.get("poFileName"),
    poFileSizeBytes: formData.get("poFileSizeBytes"),
    poMimeType: formData.get("poMimeType"),
    poNumber: formData.get("poNumber"),
    poStorageKey: formData.get("poStorageKey")
  });

  if (!result.success) {
    return fieldErrorState(result.error) as ParseResult<PoMetadataInput>;
  }

  return { ok: true, data: result.data };
}

export function parseOrderStatusFormForTest(formData: FormData): ParseResult<{ status: OrderStatusValue }> {
  const result = orderStatusTransitionSchema.safeParse({
    status: formData.get("status")
  });

  if (!result.success) {
    return fieldErrorState(result.error) as ParseResult<{ status: OrderStatusValue }>;
  }

  return { ok: true, data: result.data };
}

export async function bookOrderAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  "use server";

  const user = await requireUser();
  const parsed = parseOrderBookingFormForTest(formData);

  if (!parsed.ok) {
    return parsed;
  }

  const order = await createOrderFromAcceptedProposal(user, parsed.data);
  revalidatePath("/orders");
  revalidatePath(`/orders/${order.id}`);
  revalidatePath("/opportunities");
  redirect(`/orders/${order.id}`);
}

export async function updateOrderPoMetadataAction(
  orderId: string,
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";

  const user = await requireUser();
  const parsed = parsePoMetadataFormForTest(formData);

  if (!parsed.ok) {
    return parsed;
  }

  await updateOrderPoMetadata(user, orderId, parsed.data);
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  return { ok: true, message: "Order metadata saved." };
}

export async function changeOrderStatusAction(orderId: string, formData: FormData) {
  "use server";

  const user = await requireUser();
  const parsed = parseOrderStatusFormForTest(formData);

  if (!parsed.ok) {
    throw new Error("Choose a valid order status.");
  }

  await changeOrderStatus(user, orderId, parsed.data.status);
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
}
