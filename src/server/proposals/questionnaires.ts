import { z } from "zod";

export type ProposalTemplateDefinition = {
  clientAccountId: string;
  templateVersionId: string;
  questionnaireVersionId: string;
  locale: string;
  rendererVersion: string;
  sections: Array<{ key: string; heading: string; body: string }>;
  requiredFields: string[];
  requiredClauseIds: string[];
};

export type ApprovedCommercialContext = {
  clientAccountId: string;
  priceBookVersion: string;
  currency: string;
  maximumDiscountBps: number;
  approvedClauseIds: string[];
  products: Record<string, { unitPriceMinor: number; taxRateBps: number; active: boolean }>;
};

const answersSchema = z.object({
  clientAccountId: z.string().trim().min(1),
  client: z.object({
    displayName: z.string().trim().min(1),
    legalName: z.string().trim().min(1)
  }),
  brief: z.object({ problemStatement: z.string().trim().min(1) }),
  commercial: z.object({
    currency: z.string().trim().min(3).max(3),
    paymentType: z.string().trim().min(1),
    priceBookVersion: z.string().trim().min(1),
    discountBps: z.number().int().min(0).max(10_000),
    lines: z.array(z.object({
      productId: z.string().trim().min(1),
      quantity: z.number().int().positive(),
      unitPriceMinor: z.number().int().nonnegative(),
      taxRateBps: z.number().int().min(0).max(10_000)
    })).min(1)
  }),
  clauseIds: z.array(z.string().trim().min(1))
});

export type ProposalQuestionnaireAnswers = z.infer<typeof answersSchema>;

export type ValidatedProposalQuestionnaire = ProposalQuestionnaireAnswers & {
  calculated: {
    grossSubtotalMinor: number;
    discountMinor: number;
    subtotalMinor: number;
    taxMinor: number;
    totalMinor: number;
  };
  approvedContext: {
    priceBookVersion: string;
    approvedClauseIds: string[];
  };
};

function pathValue(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

export function validateProposalQuestionnaire(
  template: ProposalTemplateDefinition,
  rawAnswers: unknown,
  approved: ApprovedCommercialContext
): ValidatedProposalQuestionnaire {
  const parsed = answersSchema.safeParse(rawAnswers);
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path.join(".") || "questionnaire";
    throw new Error(`Complete required questionnaire field ${path}.`);
  }
  const answers = parsed.data;
  for (const required of template.requiredFields) {
    const value = pathValue(answers, required);
    if (value === undefined || value === null || value === "") {
      throw new Error(`Complete required questionnaire field ${required}.`);
    }
  }
  if (
    template.clientAccountId !== answers.clientAccountId ||
    approved.clientAccountId !== answers.clientAccountId
  ) {
    throw new Error("Template, questionnaire, and pricing client scope must match.");
  }
  if (answers.commercial.priceBookVersion !== approved.priceBookVersion) {
    throw new Error("The selected questionnaire uses a stale price book.");
  }
  if (answers.commercial.currency !== approved.currency) {
    throw new Error("Questionnaire currency is not approved for this price book.");
  }
  if (answers.commercial.discountBps > approved.maximumDiscountBps) {
    throw new Error("The requested discount exceeds the approved limit.");
  }
  for (const clauseId of [...template.requiredClauseIds, ...answers.clauseIds]) {
    if (!approved.approvedClauseIds.includes(clauseId)) {
      throw new Error(`Use an approved clause version: ${clauseId}.`);
    }
  }
  for (const requiredClause of template.requiredClauseIds) {
    if (!answers.clauseIds.includes(requiredClause)) {
      throw new Error(`Required approved clause is missing: ${requiredClause}.`);
    }
  }

  let grossSubtotalMinor = 0;
  let grossTaxMinor = 0;
  for (const line of answers.commercial.lines) {
    const product = approved.products[line.productId];
    if (
      !product?.active ||
      line.unitPriceMinor !== product.unitPriceMinor ||
      line.taxRateBps !== product.taxRateBps
    ) {
      throw new Error(`Use the approved price and tax for product ${line.productId}.`);
    }
    const lineGross = line.quantity * line.unitPriceMinor;
    grossSubtotalMinor += lineGross;
    grossTaxMinor += Math.round((lineGross * line.taxRateBps) / 10_000);
  }
  const discountMinor = Math.round(
    (grossSubtotalMinor * answers.commercial.discountBps) / 10_000
  );
  const subtotalMinor = grossSubtotalMinor - discountMinor;
  const taxMinor = grossSubtotalMinor === 0
    ? 0
    : Math.round((grossTaxMinor * subtotalMinor) / grossSubtotalMinor);
  return {
    ...answers,
    calculated: {
      grossSubtotalMinor,
      discountMinor,
      subtotalMinor,
      taxMinor,
      totalMinor: subtotalMinor + taxMinor
    },
    approvedContext: {
      priceBookVersion: approved.priceBookVersion,
      approvedClauseIds: [...new Set(answers.clauseIds)].sort()
    }
  };
}
