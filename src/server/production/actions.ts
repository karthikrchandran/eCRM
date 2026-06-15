import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current-user";
import { instantiateProductionForOrderLineItem, updateProductionStageStatus } from "./mutations";
import type { ActionState, ProductionFilters, ProductionStageStatusInput } from "./types";
import { productionFiltersSchema, productionStageStatusInputSchema } from "./validators";

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

export function parseProductionStageStatusFormForTest(formData: FormData): ParseResult<ProductionStageStatusInput> {
  const result = productionStageStatusInputSchema.safeParse({
    assignedToId: formData.get("assignedToId"),
    dueAt: formData.get("dueAt"),
    status: formData.get("status"),
    noteBody: formData.get("noteBody"),
    skippedReason: formData.get("skippedReason")
  });

  if (!result.success) {
    return fieldErrorState(result.error) as ParseResult<ProductionStageStatusInput>;
  }

  return { ok: true, data: result.data };
}

export function parseProductionFiltersForTest(input: Record<string, unknown>): ParseResult<ProductionFilters> {
  const result = productionFiltersSchema.safeParse(input);

  if (!result.success) {
    return fieldErrorState(result.error) as ParseResult<ProductionFilters>;
  }

  return { ok: true, data: result.data };
}

export async function instantiateProductionForOrderLineItemAction(orderId: string, orderLineItemId: string) {
  "use server";

  const user = await requireUser();
  await instantiateProductionForOrderLineItem(user, orderLineItemId);
  revalidatePath("/production");
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
}

export async function updateProductionStageStatusAction(
  workItemId: string,
  stageInstanceId: string,
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";

  const user = await requireUser();
  const parsed = parseProductionStageStatusFormForTest(formData);

  if (!parsed.ok) {
    return parsed;
  }

  await updateProductionStageStatus(user, stageInstanceId, parsed.data);
  revalidatePath("/production");
  revalidatePath(`/production/${workItemId}`);
  revalidatePath("/orders");
  return { ok: true, message: "Production stage updated." };
}
