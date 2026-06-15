import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import { createProposal } from "./mutations";
import type { ProposalInput, ProposalLineInput } from "./types";
import { proposalInputSchema, proposalLineInputSchema } from "./validators";

type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

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

export function parseProposalFormForTest(formData: FormData): ParseResult<ProposalInput> {
  const result = proposalInputSchema.safeParse({
    opportunityId: formData.get("opportunityId"),
    title: formData.get("title"),
    versionLabel: formData.get("versionLabel"),
    validUntil: formData.get("validUntil"),
    commercialSummary: formData.get("commercialSummary"),
    assumptions: formData.get("assumptions"),
    inclusions: formData.get("inclusions"),
    exclusions: formData.get("exclusions"),
    paymentTerms: formData.get("paymentTerms"),
    deliveryTimeline: formData.get("deliveryTimeline"),
    internalNotes: formData.get("internalNotes")
  });

  if (!result.success) {
    return fieldErrorState(result.error) as ParseResult<ProposalInput>;
  }

  return { ok: true, data: result.data };
}

export function parseProposalLinesFormForTest(formData: FormData): ProposalLineInput[] {
  const productIds = formData.getAll("productServiceId");
  const descriptions = formData.getAll("lineDescription");
  const quantities = formData.getAll("quantity");
  const unitPrices = formData.getAll("unitPricePaisa");
  const gstRates = formData.getAll("gstRateBps");
  const gstReasons = formData.getAll("gstOverrideReason");
  const lines: ProposalLineInput[] = [];

  for (let index = 0; index < productIds.length; index += 1) {
    const productServiceId = productIds[index]?.toString().trim();

    if (!productServiceId) {
      continue;
    }

    const result = proposalLineInputSchema.safeParse({
      productServiceId,
      description: descriptions[index],
      quantity: quantities[index],
      unitPricePaisa: unitPrices[index],
      gstRateBps: gstRates[index],
      gstOverrideReason: gstReasons[index]
    });

    if (result.success) {
      lines.push(result.data);
    }
  }

  return lines;
}

export async function createProposalAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  "use server";

  const user = await requireUser();
  const parsed = parseProposalFormForTest(formData);

  if (!parsed.ok) {
    return parsed;
  }

  const proposal = await createProposal(user, parsed.data, parseProposalLinesFormForTest(formData));
  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${parsed.data.opportunityId}`);
  redirect(`/opportunities/${parsed.data.opportunityId}/proposals/${proposal.id}`);
}
