import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import { addProposalPdfMetadata, changeProposalStatus, createProposal } from "./mutations";
import type { ProposalInput, ProposalLineInput, ProposalPdfMetadataInput, ProposalStatusValue } from "./types";
import { proposalInputSchema, proposalLineInputSchema, proposalPdfMetadataInputSchema } from "./validators";

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

export function parseProposalPdfMetadataFormForTest(formData: FormData): ParseResult<ProposalPdfMetadataInput> {
  const result = proposalPdfMetadataInputSchema.safeParse({
    originalFileName: formData.get("originalFileName"),
    storedFileName: formData.get("storedFileName"),
    storageProvider: formData.get("storageProvider"),
    storageKey: formData.get("storageKey"),
    mimeType: formData.get("mimeType"),
    fileSizeBytes: formData.get("fileSizeBytes"),
    sha256: formData.get("sha256"),
    canvaDesignUrl: formData.get("canvaDesignUrl")
  });

  if (!result.success) {
    return fieldErrorState(result.error) as ParseResult<ProposalPdfMetadataInput>;
  }

  return { ok: true, data: result.data };
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

export async function addProposalPdfMetadataAction(
  opportunityId: string,
  proposalId: string,
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  "use server";

  const user = await requireUser();
  const parsed = parseProposalPdfMetadataFormForTest(formData);

  if (!parsed.ok) {
    return parsed;
  }

  await addProposalPdfMetadata(user, proposalId, parsed.data);
  revalidatePath(`/opportunities/${opportunityId}`);
  revalidatePath(`/opportunities/${opportunityId}/proposals/${proposalId}`);
  return { ok: true, message: "Proposal PDF metadata saved." };
}

export async function changeProposalStatusAction(opportunityId: string, proposalId: string, formData: FormData) {
  "use server";

  const user = await requireUser();
  const status = formData.get("status")?.toString() as ProposalStatusValue;

  await changeProposalStatus(user, proposalId, status);
  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${opportunityId}`);
  revalidatePath(`/opportunities/${opportunityId}/proposals/${proposalId}`);
}
