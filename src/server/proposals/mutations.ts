import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { calculateProposalTotals } from "./calculations";
import { assertCanWriteProposals } from "./permissions";
import type { ProposalInput, ProposalLineInput, ProposalUser } from "./types";

type ProductSnapshot = {
  id: string;
  name: string;
  category: string;
  defaultGstRateBps: number;
  active: boolean;
};

type ProposalCreateDb = {
  opportunity: {
    findUnique: (args: Prisma.OpportunityFindUniqueArgs) => Promise<{ id: string; stage: { kind: string; name: string } } | null>;
  };
  proposal: {
    count: (args: Prisma.ProposalCountArgs) => Promise<number>;
    create: (args: Prisma.ProposalCreateArgs) => Promise<{ id: string }>;
  };
  productService: {
    findMany: (args: Prisma.ProductServiceFindManyArgs) => Promise<ProductSnapshot[]>;
  };
};

async function assertOpenOpportunity(database: ProposalCreateDb, opportunityId: string) {
  const opportunity = await database.opportunity.findUnique({
    where: { id: opportunityId },
    select: { id: true, stage: { select: { kind: true, name: true } } }
  });

  if (!opportunity) {
    throw new Error("Opportunity was not found.");
  }

  if (opportunity.stage.kind !== "OPEN") {
    throw new Error("Create proposals only for open opportunities.");
  }
}

async function loadProductSnapshots(database: ProposalCreateDb, lines: ProposalLineInput[]) {
  const productIds = [...new Set(lines.map((line) => line.productServiceId))];
  const products = await database.productService.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, category: true, defaultGstRateBps: true, active: true }
  });
  const productsById = new Map(products.map((product) => [product.id, product]));

  for (const line of lines) {
    const product = productsById.get(line.productServiceId);

    if (!product?.active) {
      throw new Error("Choose an active product or service.");
    }

    if (line.gstRateBps !== product.defaultGstRateBps && !line.gstOverrideReason) {
      throw new Error("Enter a GST override reason.");
    }
  }

  return productsById;
}

export async function createProposal(
  user: ProposalUser,
  input: ProposalInput,
  lines: ProposalLineInput[],
  database: ProposalCreateDb = db as unknown as ProposalCreateDb
) {
  assertCanWriteProposals(user);

  if (lines.length < 1) {
    throw new Error("Add at least one proposal line.");
  }

  await assertOpenOpportunity(database, input.opportunityId);
  const productsById = await loadProductSnapshots(database, lines);
  const sequenceNumber = (await database.proposal.count({ where: { opportunityId: input.opportunityId } })) + 1;
  const totals = calculateProposalTotals(lines);

  return database.proposal.create({
    data: {
      ...input,
      sequenceNumber,
      status: "DRAFT",
      currency: "INR",
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
