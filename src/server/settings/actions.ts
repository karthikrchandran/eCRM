"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth/current-user";
import { getServerEnv } from "@/server/env";
import { updateBusinessSettings } from "./settings";

type SettingsActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

const settingsSchema = z.object({
  defaultCurrency: z.enum(["INR", "USD"])
});

function fieldErrorState(error: z.ZodError): SettingsActionState {
  const fieldErrors: Record<string, string[]> = {};

  for (const [field, messages] of Object.entries(error.flatten().fieldErrors)) {
    if (Array.isArray(messages) && messages.length > 0) {
      fieldErrors[field] = messages;
    }
  }

  return { ok: false, fieldErrors };
}

export async function updateBusinessSettingsAction(
  _previousState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  if (getServerEnv().runtime.mode !== "cell") notFound();
  const user = await requireUser();
  const result = settingsSchema.safeParse({
    defaultCurrency: formData.get("defaultCurrency")
  });

  if (!result.success) {
    return fieldErrorState(result.error);
  }

  try {
    await updateBusinessSettings(user, result.data, {
      correlationId: randomUUID(),
      reason: "Customer administrator changed the default currency"
    });
    revalidatePath("/admin/settings");
    revalidatePath("/opportunities");
    return { ok: true, message: "Business settings saved." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Something went wrong." };
  }
}
