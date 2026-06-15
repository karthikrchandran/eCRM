import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import type {
  ActionState,
  OpportunityInput,
  OpportunitySplitInput,
  PipelineStageInput,
  SalesTargetInput
} from "./types";
import {
  opportunityInputSchema,
  pipelineStageInputSchema,
  salesTargetInputSchema
} from "./validators";
import {
  createOpportunity,
  moveOpportunityStage,
  updateOpportunity,
  upsertPipelineStage,
  upsertSalesTarget
} from "./mutations";

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

export function parseOpportunityFormForTest(formData: FormData): ParseResult<OpportunityInput> {
  const result = opportunityInputSchema.safeParse({
    leadCustomerId: formData.get("leadCustomerId"),
    branchId: formData.get("branchId"),
    stageId: formData.get("stageId"),
    ownerId: formData.get("ownerId"),
    title: formData.get("title"),
    productInterest: formData.get("productInterest"),
    estimatedValueInr: formData.get("estimatedValueInr"),
    probability: formData.get("probability"),
    lastReachAt: formData.get("lastReachAt"),
    nextFollowUpAt: formData.get("nextFollowUpAt"),
    notes: formData.get("notes")
  });

  if (!result.success) {
    return fieldErrorState(result.error) as ParseResult<OpportunityInput>;
  }

  return { ok: true, data: result.data };
}

export function parseSplitsFormForTest(formData: FormData): OpportunitySplitInput[] {
  const userIds = formData.getAll("splitUserId").map((value) => value.toString().trim());
  const percents = formData.getAll("splitPercent").map((value) => value.toString().trim());
  const splits: OpportunitySplitInput[] = [];

  for (let index = 0; index < Math.max(userIds.length, percents.length); index += 1) {
    const userId = userIds[index] ?? "";
    const percent = Number(percents[index] ?? "");

    if (!userId && !percents[index]) {
      continue;
    }

    if (userId && Number.isInteger(percent)) {
      splits.push({ userId, percent });
    }
  }

  return splits;
}

export function parsePipelineStageFormForTest(formData: FormData): ParseResult<PipelineStageInput> {
  const result = pipelineStageInputSchema.safeParse({
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder"),
    kind: formData.get("kind"),
    active: formData.get("active")
  });

  if (!result.success) {
    return fieldErrorState(result.error) as ParseResult<PipelineStageInput>;
  }

  return { ok: true, data: result.data };
}

export function parseSalesTargetFormForTest(formData: FormData): ParseResult<SalesTargetInput> {
  const result = salesTargetInputSchema.safeParse({
    ownerId: formData.get("ownerId"),
    financialYear: formData.get("financialYear"),
    quarter: formData.get("quarter"),
    targetValueInr: formData.get("targetValueInr")
  });

  if (!result.success) {
    return fieldErrorState(result.error) as ParseResult<SalesTargetInput>;
  }

  return { ok: true, data: result.data };
}

export async function createOpportunityAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  "use server";

  const user = await requireUser();
  const parsed = parseOpportunityFormForTest(formData);

  if (!parsed.ok) {
    return parsed;
  }

  const opportunity = await createOpportunity(user, parsed.data, parseSplitsFormForTest(formData));
  revalidatePath("/opportunities");
  redirect(`/opportunities/${opportunity.id}`);
}

export async function updateOpportunityAction(
  opportunityId: string,
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";

  const user = await requireUser();
  const parsed = parseOpportunityFormForTest(formData);

  if (!parsed.ok) {
    return parsed;
  }

  await updateOpportunity(user, opportunityId, parsed.data, parseSplitsFormForTest(formData));
  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${opportunityId}`);
  redirect(`/opportunities/${opportunityId}`);
}

export async function moveOpportunityStageAction(opportunityId: string, formData: FormData) {
  "use server";

  const user = await requireUser();
  const stageId = formData.get("stageId")?.toString() ?? "";
  await moveOpportunityStage(user, opportunityId, stageId);
  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${opportunityId}`);
}

export async function upsertPipelineStageAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  "use server";

  const user = await requireUser();
  const parsed = parsePipelineStageFormForTest(formData);

  if (!parsed.ok) {
    return parsed;
  }

  await upsertPipelineStage(user, parsed.data);
  revalidatePath("/opportunities");
  revalidatePath("/opportunities/stages");
  return { ok: true, message: "Pipeline stage saved." };
}

export async function upsertSalesTargetAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  "use server";

  const user = await requireUser();
  const parsed = parseSalesTargetFormForTest(formData);

  if (!parsed.ok) {
    return parsed;
  }

  await upsertSalesTarget(user, parsed.data);
  revalidatePath("/opportunities/targets");
  return { ok: true, message: "Sales target saved." };
}
