import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import { createProductService, setProductServiceActive, updateProductService } from "./mutations";
import type { ActionState, ProductServiceInput } from "./types";
import { productServiceInputSchema } from "./validators";

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

export function parseProductServiceFormForTest(formData: FormData): ParseResult<ProductServiceInput> {
  const result = productServiceInputSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    category: formData.get("category"),
    description: formData.get("description"),
    defaultGstRateBps: formData.get("defaultGstRateBps"),
    defaultProductionTemplateKey: formData.get("defaultProductionTemplateKey"),
    active: formData.get("active"),
    sortOrder: formData.get("sortOrder")
  });

  if (!result.success) {
    return fieldErrorState(result.error) as ParseResult<ProductServiceInput>;
  }

  return { ok: true, data: result.data };
}

export async function createProductServiceAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";

  const user = await requireUser();
  const parsed = parseProductServiceFormForTest(formData);

  if (!parsed.ok) {
    return parsed;
  }

  await createProductService(user, parsed.data);
  revalidatePath("/admin/products");
  redirect("/admin/products");
}

export async function updateProductServiceAction(
  productServiceId: string,
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";

  const user = await requireUser();
  const parsed = parseProductServiceFormForTest(formData);

  if (!parsed.ok) {
    return parsed;
  }

  await updateProductService(user, productServiceId, parsed.data);
  revalidatePath("/admin/products");
  redirect("/admin/products");
}

export async function setProductServiceActiveAction(productServiceId: string, active: boolean) {
  "use server";

  const user = await requireUser();
  await setProductServiceActive(user, productServiceId, active);
  revalidatePath("/admin/products");
}
