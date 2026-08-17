import { describe, expect, it, vi } from "vitest";
import { publishTemplateBundle } from "./templates";
import { validateProposalQuestionnaire } from "./questionnaires";
import { renderProposalTemplate } from "./rendering";

const template = {
  clientAccountId: "client_ara",
  templateVersionId: "template_v1",
  questionnaireVersionId: "questionnaire_v1",
  locale: "en-IN",
  rendererVersion: "proposal-renderer.v1",
  sections: [
    { key: "title", heading: "Proposal for {{client.displayName}}", body: "{{brief.problemStatement}}" },
    { key: "commercial", heading: "Commercials", body: "Total {{commercial.currency}} {{commercial.totalMinor}}" },
    { key: "terms", heading: "Payment", body: "{{commercial.paymentType}}" }
  ],
  requiredFields: ["client.displayName", "brief.problemStatement", "commercial.paymentType"],
  requiredClauseIds: ["standard-payment-v1"]
};

const answers = {
  clientAccountId: "client_ara",
  client: { displayName: "ARA Global", legalName: "ARA Global Private Limited" },
  brief: { problemStatement: "Improve enterprise learning delivery" },
  commercial: {
    currency: "INR",
    paymentType: "MILESTONE",
    priceBookVersion: "ara-2026-08",
    discountBps: 500,
    lines: [{ productId: "consulting", quantity: 2, unitPriceMinor: 100_000, taxRateBps: 1800 }]
  },
  clauseIds: ["standard-payment-v1"]
};

const approved = {
  clientAccountId: "client_ara",
  priceBookVersion: "ara-2026-08",
  currency: "INR",
  maximumDiscountBps: 1000,
  approvedClauseIds: ["standard-payment-v1", "standard-confidentiality-v1"],
  products: {
    consulting: { unitPriceMinor: 100_000, taxRateBps: 1800, active: true }
  }
};

describe("proposal template generation", () => {
  it("rejects missing required commercial questionnaire fields", () => {
    expect(() => validateProposalQuestionnaire(template, {
      ...answers,
      commercial: { ...answers.commercial, paymentType: "" }
    }, approved)).toThrow("commercial.paymentType");
  });

  it("rejects stale price books, unapproved discount, tax, price, and clauses", () => {
    expect(() => validateProposalQuestionnaire(template, {
      ...answers,
      commercial: { ...answers.commercial, priceBookVersion: "ara-2025-01" }
    }, approved)).toThrow("stale price book");
    expect(() => validateProposalQuestionnaire(template, {
      ...answers,
      commercial: { ...answers.commercial, discountBps: 1500 }
    }, approved)).toThrow("discount");
    expect(() => validateProposalQuestionnaire(template, {
      ...answers,
      commercial: {
        ...answers.commercial,
        lines: [{ ...answers.commercial.lines[0], unitPriceMinor: 90_000, taxRateBps: 500 }]
      }
    }, approved)).toThrow("approved price");
    expect(() => validateProposalQuestionnaire(template, {
      ...answers,
      clauseIds: ["invented-legal-clause"]
    }, approved)).toThrow("approved clause");
  });

  it("rejects cross-client template or pricing context substitution", () => {
    expect(() => validateProposalQuestionnaire(
      { ...template, clientAccountId: "client_ai" }, answers, approved
    )).toThrow("client scope");
    expect(() => validateProposalQuestionnaire(
      template, answers, { ...approved, clientAccountId: "client_ai" }
    )).toThrow("client scope");
  });

  it("renders deterministic content and source digests", () => {
    const validated = validateProposalQuestionnaire(template, answers, approved);
    const first = renderProposalTemplate(template, validated);
    const second = renderProposalTemplate(template, validated);

    expect(first).toEqual(second);
    expect(first.contentDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(first.sourceDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(first.content.sections[0]?.heading).toBe("Proposal for ARA Global");
    expect(first.content.sections[1]?.body).toBe("Total INR 224200");
  });

  it("publishes immutable template and questionnaire versions with digests", async () => {
    const createTemplate = vi.fn().mockResolvedValue({ id: "template_1" });
    const createVersion = vi.fn().mockResolvedValue({ id: "template_v1" });
    const createQuestionnaire = vi.fn().mockResolvedValue({ id: "questionnaire_v1" });

    const published = await publishTemplateBundle(
      { id: "admin_1", organizationId: "org_test", role: "ADMIN" },
      "client_ara",
      "ARA Standard Proposal",
      template,
      {
        type: "object",
        required: ["client", "brief", "commercial"],
        properties: { client: { type: "object" }, brief: { type: "object" }, commercial: { type: "object" } }
      },
      {
        proposalTemplate: { create: createTemplate },
        proposalTemplateVersion: { create: createVersion },
        proposalQuestionnaireVersion: { create: createQuestionnaire }
      }
    );

    expect(published).toEqual({ templateId: "template_1", templateVersionId: "template_v1", questionnaireVersionId: "questionnaire_v1" });
    expect(createVersion).toHaveBeenCalledWith({ data: expect.objectContaining({ status: "PUBLISHED", contentDigest: expect.stringMatching(/^[a-f0-9]{64}$/) }) });
    expect(createQuestionnaire).toHaveBeenCalledWith({ data: expect.objectContaining({ contentDigest: expect.stringMatching(/^[a-f0-9]{64}$/), publishedAt: expect.any(Date) }) });
  });
});
