import { createHash } from "node:crypto";
import type { ProposalUser } from "./types";
import type { ProposalTemplateDefinition } from "./questionnaires";

type JsonSchema = {
  type: string;
  required?: string[];
  properties?: Record<string, unknown>;
};

type TemplatePublicationDb = {
  $transaction?: <T>(operation: (transaction: TemplatePublicationDb) => Promise<T>) => Promise<T>;
  proposalTemplate: { create: (args: unknown) => Promise<{ id: string }> };
  proposalTemplateVersion: { create: (args: unknown) => Promise<{ id: string }> };
  proposalQuestionnaireVersion: { create: (args: unknown) => Promise<{ id: string }> };
};

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

function validatePublication(
  clientAccountId: string,
  template: ProposalTemplateDefinition,
  questionnaireSchema: JsonSchema
) {
  if (template.clientAccountId !== clientAccountId) {
    throw new Error("Template client scope must match publication scope.");
  }
  if (!template.sections.length || new Set(template.sections.map(({ key }) => key)).size !== template.sections.length) {
    throw new Error("Template sections must be non-empty and uniquely keyed.");
  }
  if (questionnaireSchema.type !== "object") {
    throw new Error("Questionnaire must publish an object JSON schema.");
  }
  const required = new Set(questionnaireSchema.required ?? []);
  for (const key of ["client", "brief", "commercial"]) {
    if (!required.has(key) || !questionnaireSchema.properties?.[key]) {
      throw new Error(`Questionnaire schema must require ${key}.`);
    }
  }
}

export async function publishTemplateBundle(
  user: ProposalUser,
  clientAccountId: string,
  name: string,
  template: ProposalTemplateDefinition,
  questionnaireSchema: JsonSchema,
  database: TemplatePublicationDb
) {
  if (user.role !== "ADMIN") throw new Error("Only administrators can publish proposal templates.");
  validatePublication(clientAccountId, template, questionnaireSchema);
  const publish = async (transaction: TemplatePublicationDb) => {
    const family = await transaction.proposalTemplate.create({
      data: { organizationId: user.organizationId, clientAccountId, name: name.trim() }
    });
    const publishedAt = new Date();
    const version = await transaction.proposalTemplateVersion.create({
      data: {
        organizationId: user.organizationId,
        templateId: family.id,
        versionNumber: 1,
        status: "PUBLISHED",
        locale: template.locale,
        sectionSchema: template.sections,
        bindingSchema: { requiredFields: template.requiredFields },
        calculationRules: { arithmetic: "minor-unit-v1" },
        requiredClauseIds: template.requiredClauseIds,
        optionalClauseIds: [],
        rendererVersion: template.rendererVersion,
        allowedSourceVersions: {},
        contentDigest: digest(template),
        approvedById: user.id,
        approvedAt: publishedAt
      }
    });
    const questionnaire = await transaction.proposalQuestionnaireVersion.create({
      data: {
        organizationId: user.organizationId,
        templateVersionId: version.id,
        versionNumber: 1,
        jsonSchema: questionnaireSchema,
        uiHints: {},
        defaults: {},
        validationRules: {},
        fieldMappings: { requiredFields: template.requiredFields },
        contentDigest: digest(questionnaireSchema),
        publishedAt
      }
    });
    return {
      templateId: family.id,
      templateVersionId: version.id,
      questionnaireVersionId: questionnaire.id
    };
  };
  return database.$transaction ? database.$transaction(publish) : publish(database);
}
