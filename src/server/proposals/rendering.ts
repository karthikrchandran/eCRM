import { createHash } from "node:crypto";
import type {
  ProposalTemplateDefinition,
  ValidatedProposalQuestionnaire
} from "./questionnaires";

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function renderText(source: string, bindings: Record<string, string>) {
  const rendered = source.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (_, key: string) => {
    const value = bindings[key];
    if (value === undefined) throw new Error(`Template binding is not approved: ${key}.`);
    return value;
  });
  if (rendered.includes("{{") || rendered.includes("}}")) {
    throw new Error("Template contains an invalid expression.");
  }
  return rendered;
}

export function renderProposalTemplate(
  template: ProposalTemplateDefinition,
  answers: ValidatedProposalQuestionnaire
) {
  if (template.clientAccountId !== answers.clientAccountId) {
    throw new Error("Template and questionnaire client scope must match.");
  }
  const bindings: Record<string, string> = {
    "client.displayName": answers.client.displayName,
    "client.legalName": answers.client.legalName,
    "brief.problemStatement": answers.brief.problemStatement,
    "commercial.currency": answers.commercial.currency,
    "commercial.paymentType": answers.commercial.paymentType,
    "commercial.grossSubtotalMinor": String(answers.calculated.grossSubtotalMinor),
    "commercial.discountMinor": String(answers.calculated.discountMinor),
    "commercial.subtotalMinor": String(answers.calculated.subtotalMinor),
    "commercial.taxMinor": String(answers.calculated.taxMinor),
    "commercial.totalMinor": String(answers.calculated.totalMinor)
  };
  const content = {
    locale: template.locale,
    sections: template.sections.map((section) => ({
      key: section.key,
      heading: renderText(section.heading, bindings),
      body: renderText(section.body, bindings)
    })),
    commercial: answers.calculated,
    clauses: answers.approvedContext.approvedClauseIds
  };
  const sources = {
    clientAccountId: answers.clientAccountId,
    priceBookVersion: answers.approvedContext.priceBookVersion,
    templateVersionId: template.templateVersionId,
    questionnaireVersionId: template.questionnaireVersionId,
    rendererVersion: template.rendererVersion,
    clauseIds: answers.approvedContext.approvedClauseIds
  };
  return {
    content,
    sources,
    sourceDigest: digest(sources),
    contentDigest: digest(content)
  };
}
