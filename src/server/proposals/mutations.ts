import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { isSafeExternalUrl } from "@/lib/safe-external-url";
import { withOrganization } from "@/server/organizations/with-organization";
import type { SupportedCurrency } from "@/server/settings/settings";
import { calculateProposalTotals } from "./calculations";
import { assertCanWriteProposals } from "./permissions";
import { assertProposalStatusTransition } from "./validators";
import type { ProposalInput, ProposalLineInput, ProposalPdfMetadataInput, ProposalStatusValue, ProposalUser } from "./types";

type ProductSnapshot = {
  id: string;
  name: string;
  category: string;
  defaultGstRateBps: number;
  active: boolean;
};

type ProposalCreateDb = {
  businessSettings?: {
    findUnique: (args: Prisma.BusinessSettingsFindUniqueArgs) => Promise<{ defaultCurrency: SupportedCurrency } | null>;
  };
  opportunity: {
    findFirst: (args: Prisma.OpportunityFindFirstArgs) => Promise<{
      id: string;
      leadCustomerId: string;
      stage: { kind: string; name: string };
    } | null>;
  };
  proposal: {
    count: (args: Prisma.ProposalCountArgs) => Promise<number>;
    create: (args: Prisma.ProposalCreateArgs) => Promise<{ id: string }>;
  };
  productService: {
    findMany: (args: Prisma.ProductServiceFindManyArgs) => Promise<ProductSnapshot[]>;
  };
};

type ProposalPdfDb = {
  proposal: {
    findFirst: (args: Prisma.ProposalFindFirstArgs) => Promise<{ id: string; opportunityId: string } | null>;
  };
  proposalPdfAttachment: {
    create: (args: Prisma.ProposalPdfAttachmentCreateArgs) => Promise<{ id: string }>;
  };
};

type ProposalStatusDb = {
  pipelineStage: {
    findFirst: (args: Prisma.PipelineStageFindFirstArgs) => Promise<{ id: string } | null>;
  };
  proposal: {
    findFirst: (args: Prisma.ProposalFindFirstArgs) => Promise<{
      id: string;
      opportunityId: string;
      status: ProposalStatusValue;
      lineItems: Array<{ id: string }>;
      pdfAttachments: Array<{ id: string; storageKey: string }>;
    } | null>;
    update: (args: Prisma.ProposalUpdateArgs) => Promise<{ id: string; status: ProposalStatusValue }>;
  };
  opportunity: {
    update: (args: Prisma.OpportunityUpdateArgs) => Promise<{ id: string }>;
  };
};

export type ProposalVersionSource = {
  mode: "MANUAL" | "TEMPLATE" | "GENERATIVE";
  sourceManifest: Record<string, unknown>;
  sourceDigest: string;
  templateVersionId?: string;
  questionnaireVersionId?: string;
  modelVersion?: string;
  promptVersion?: string;
};

type CreatedProposalVersion = { id: string; versionNumber: number };

type ProposalVersionDb = {
  $queryRaw: (query: Prisma.Sql) => Promise<unknown>;
  proposal: {
    findFirst: (args: Prisma.ProposalFindFirstArgs) => Promise<{
      id: string;
      clientAccountId: string;
      currentVersionId: string | null;
      currentVersionNumber: number;
      currency?: string;
    } | null>;
    update: (args: Prisma.ProposalUpdateArgs) => Promise<{ id: string }>;
  };
  proposalVersion: {
    create: (args: Prisma.ProposalVersionCreateArgs) => Promise<CreatedProposalVersion>;
  };
};

type ProposalVersionDatabase = {
  $transaction: (operation: (transaction: ProposalVersionDb) => Promise<CreatedProposalVersion>) => Promise<CreatedProposalVersion>;
};

function stableDigest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function createProposalVersion(
  user: ProposalUser,
  proposalId: string,
  clientAccountId: string,
  input: ProposalInput,
  lines: ProposalLineInput[],
  source: ProposalVersionSource,
  database?: ProposalVersionDatabase
): Promise<CreatedProposalVersion> {
  assertCanWriteProposals(user);
  if (lines.length < 1) throw new Error("Add at least one proposal line.");
  if (!/^[a-f0-9]{64}$/i.test(source.sourceDigest)) throw new Error("Enter a valid source digest.");

  const createInTransaction = async (transaction: ProposalVersionDb) => {
    await transaction.$queryRaw(
      Prisma.sql`SELECT id FROM "Proposal" WHERE "organizationId" = ${user.organizationId} AND id = ${proposalId} FOR UPDATE`
    );
    const proposal = await transaction.proposal.findFirst({
      where: { id: proposalId, organizationId: user.organizationId, clientAccountId },
      select: { id: true, clientAccountId: true, currentVersionId: true, currentVersionNumber: true }
    });
    if (!proposal) throw new Error("Proposal was not found for this client.");

    const versionNumber = proposal.currentVersionNumber + 1;
    const totals = calculateProposalTotals(lines);
    const contentDigest = stableDigest({ input, lines, source, versionNumber });
    const version = await transaction.proposalVersion.create({
      data: {
        organizationId: user.organizationId,
        proposalId,
        clientAccountId,
        versionNumber,
        supersedesVersionId: proposal.currentVersionId,
        status: source.mode === "GENERATIVE" ? "DRAFT_REVIEW_REQUIRED" : "DRAFT",
        creationMode: source.mode,
        title: input.title,
        validUntil: input.validUntil,
        commercialSummary: input.commercialSummary,
        assumptions: input.assumptions,
        inclusions: input.inclusions,
        exclusions: input.exclusions,
        paymentTerms: input.paymentTerms,
        deliveryTimeline: input.deliveryTimeline,
        internalNotes: input.internalNotes,
        subtotalPaisa: totals.subtotalPaisa,
        taxPaisa: totals.gstPaisa,
        totalPaisa: totals.totalPaisa,
        templateVersionId: source.templateVersionId,
        questionnaireVersionId: source.questionnaireVersionId,
        modelVersion: source.modelVersion,
        promptVersion: source.promptVersion,
        sourceManifest: source.sourceManifest as Prisma.InputJsonValue,
        sourceDigest: source.sourceDigest.toLowerCase(),
        contentDigest,
        createdById: user.id,
        lines: {
          create: lines.map((line, index) => ({
            organizationId: user.organizationId,
            productServiceId: line.productServiceId,
            description: line.description,
            quantity: line.quantity,
            unitPricePaisa: line.unitPricePaisa,
            taxRateBps: line.gstRateBps,
            taxOverrideReason: line.gstOverrideReason,
            lineSubtotalPaisa: totals.lines[index]!.lineSubtotalPaisa,
            lineTaxPaisa: totals.lines[index]!.lineGstPaisa,
            lineTotalPaisa: totals.lines[index]!.lineTotalPaisa,
            sortOrder: index
          }))
        }
      },
      select: { id: true, versionNumber: true }
    });

    await transaction.proposal.update({
      where: { organizationId_id: { organizationId: user.organizationId, id: proposalId } },
      data: {
        currentVersionId: version.id,
        currentVersionNumber: versionNumber,
        status: "DRAFT",
        title: input.title,
        versionLabel: `V${versionNumber}`,
        validUntil: input.validUntil,
        commercialSummary: input.commercialSummary,
        assumptions: input.assumptions,
        inclusions: input.inclusions,
        exclusions: input.exclusions,
        paymentTerms: input.paymentTerms,
        deliveryTimeline: input.deliveryTimeline,
        internalNotes: input.internalNotes,
        subtotalPaisa: totals.subtotalPaisa,
        gstPaisa: totals.gstPaisa,
        totalPaisa: totals.totalPaisa,
        updatedById: user.id
      }
    });
    return version;
  };

  if (!database) {
    return withOrganization(user.organizationId, (transaction) =>
      createInTransaction(transaction as unknown as ProposalVersionDb)
    );
  }
  return database.$transaction(createInTransaction);
}

async function assertOpenOpportunity(database: ProposalCreateDb, organizationId: string, opportunityId: string) {
  const opportunity = await database.opportunity.findFirst({
    where: { id: opportunityId, organizationId },
    select: { id: true, leadCustomerId: true, stage: { select: { kind: true, name: true } } }
  });

  if (!opportunity) {
    throw new Error("Opportunity was not found.");
  }

  if (opportunity.stage.kind !== "OPEN") {
    throw new Error("Create proposals only for open opportunities.");
  }
  return opportunity;
}

async function loadDefaultCurrency(database: ProposalCreateDb): Promise<SupportedCurrency> {
  const settings = await database.businessSettings?.findUnique({
    where: { id: "default" },
    select: { defaultCurrency: true }
  });

  return settings?.defaultCurrency ?? "INR";
}

async function loadProductSnapshots(database: ProposalCreateDb, organizationId: string, lines: ProposalLineInput[], currency: SupportedCurrency) {
  const productIds = [...new Set(lines.map((line) => line.productServiceId))];
  const products = await database.productService.findMany({
    where: { id: { in: productIds }, organizationId },
    select: { id: true, name: true, category: true, defaultGstRateBps: true, active: true }
  });
  const productsById = new Map(products.map((product) => [product.id, product]));

  for (const line of lines) {
    const product = productsById.get(line.productServiceId);

    if (!product?.active) {
      throw new Error("Choose an active product or service.");
    }

    if (currency === "USD" && line.manualTaxPaisa === undefined) {
      throw new Error("Enter manual tax for USD proposal lines.");
    }

    if (currency === "INR" && line.gstRateBps !== product.defaultGstRateBps && !line.gstOverrideReason) {
      throw new Error("Enter a GST override reason.");
    }
  }

  return productsById;
}

export async function createProposal(
  user: ProposalUser,
  input: ProposalInput,
  lines: ProposalLineInput[],
  database?: ProposalCreateDb
): Promise<{ id: string }> {
  if (!database) return withOrganization(user.organizationId, (tx) => createProposal(user, input, lines, tx as unknown as ProposalCreateDb));
  assertCanWriteProposals(user);

  if (lines.length < 1) {
    throw new Error("Add at least one proposal line.");
  }

  const opportunity = await assertOpenOpportunity(database, user.organizationId, input.opportunityId);
  const currency = await loadDefaultCurrency(database);
  const productsById = await loadProductSnapshots(database, user.organizationId, lines, currency);
  const sequenceNumber = (await database.proposal.count({ where: { opportunityId: input.opportunityId, organizationId: user.organizationId } })) + 1;
  const totals = calculateProposalTotals(lines);

  return database.proposal.create({
    data: {
      organizationId: user.organizationId,
      clientAccountId: opportunity.leadCustomerId,
      ...input,
      sequenceNumber,
      status: "DRAFT",
      currency,
      subtotalPaisa: totals.subtotalPaisa,
      gstPaisa: totals.gstPaisa,
      totalPaisa: totals.totalPaisa,
      createdById: user.id,
      updatedById: user.id,
      lineItems: {
        create: lines.map((line, index) => {
          const product = productsById.get(line.productServiceId);
          const calculated = totals.lines[index];

          if (!product || !calculated) {
            throw new Error("Choose an active product or service.");
          }

          return {
            productServiceId: line.productServiceId,
            productNameSnapshot: product.name,
            productCategorySnapshot: product.category,
            description: line.description,
            quantity: line.quantity,
            unitPricePaisa: line.unitPricePaisa,
            gstRateBps: line.gstRateBps,
            gstOverrideReason: line.gstOverrideReason,
            lineSubtotalPaisa: calculated.lineSubtotalPaisa,
            lineGstPaisa: calculated.lineGstPaisa,
            lineTotalPaisa: calculated.lineTotalPaisa,
            sortOrder: index
          };
        })
      }
    }
  });
}

export async function addProposalPdfMetadata(
  user: ProposalUser,
  proposalId: string,
  input: ProposalPdfMetadataInput,
  database?: ProposalPdfDb
): Promise<{ id: string }> {
  if (!database) return withOrganization(user.organizationId, (tx) => addProposalPdfMetadata(user, proposalId, input, tx as unknown as ProposalPdfDb));
  assertCanWriteProposals(user);
  const proposal = await database.proposal.findFirst({
    where: { id: proposalId, organizationId: user.organizationId },
    select: { id: true, opportunityId: true }
  });

  if (!proposal) {
    throw new Error("Proposal was not found.");
  }

  return database.proposalPdfAttachment.create({
    data: {
      organizationId: user.organizationId,
      proposalId,
      originalFileName: input.originalFileName,
      storedFileName: input.storedFileName,
      storageProvider: input.storageProvider,
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
      sha256: input.sha256,
      canvaDesignUrl: input.canvaDesignUrl,
      uploadedById: user.id
    }
  });
}

export async function changeProposalStatus(
  user: ProposalUser,
  proposalId: string,
  nextStatus: ProposalStatusValue,
  database?: ProposalStatusDb
): Promise<{ id: string; status: ProposalStatusValue }> {
  if (!database) return withOrganization(user.organizationId, (tx) => changeProposalStatus(user, proposalId, nextStatus, tx as unknown as ProposalStatusDb));
  assertCanWriteProposals(user);
  const proposal = await database.proposal.findFirst({
    where: { id: proposalId, organizationId: user.organizationId },
    select: {
      id: true,
      opportunityId: true,
      status: true,
      lineItems: { select: { id: true } },
      pdfAttachments: { where: { replacedAt: null }, select: { id: true, storageKey: true } }
    }
  });

  if (!proposal) {
    throw new Error("Proposal was not found.");
  }

  assertProposalStatusTransition(proposal.status, nextStatus, {
    lineItemCount: proposal.lineItems.length,
    activePdfCount: proposal.pdfAttachments.filter((attachment) => isSafeExternalUrl(attachment.storageKey)).length
  });

  const updated = await database.proposal.update({
    where: { id: proposalId },
    data: { status: nextStatus, updatedById: user.id }
  });

  if (nextStatus === "SENT") {
    const proposalSentStage = await database.pipelineStage.findFirst({
      where: { organizationId: user.organizationId, name: "Proposal Sent", active: true, kind: "OPEN" },
      select: { id: true }
    });

    if (proposalSentStage) {
      await database.opportunity.update({
        where: { id: proposal.opportunityId },
        data: { stageId: proposalSentStage.id, updatedById: user.id }
      });
    }
  }

  return updated;
}
