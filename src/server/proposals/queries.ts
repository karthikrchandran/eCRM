import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { assertCanViewProposals } from "./permissions";
import type { ProposalUser } from "./types";

const proposalInclude = {
  opportunity: {
    include: {
      leadCustomer: { select: { id: true, name: true, state: true } },
      branch: { select: { id: true, name: true, city: true, region: true } },
      owner: { select: { id: true, name: true, email: true, role: true } },
      stage: { select: { id: true, name: true, kind: true, sortOrder: true } }
    }
  },
  lineItems: {
    orderBy: { sortOrder: "asc" },
    include: {
      productService: { select: { id: true, name: true, category: true, active: true } }
    }
  },
  pdfAttachments: {
    where: { replacedAt: null },
    orderBy: { uploadedAt: "desc" },
    include: {
      uploadedBy: { select: { id: true, name: true, email: true, role: true } }
    }
  },
  createdBy: { select: { id: true, name: true, email: true, role: true } },
  updatedBy: { select: { id: true, name: true, email: true, role: true } }
} satisfies Prisma.ProposalInclude;

export type ProposalDetailRecord = Prisma.ProposalGetPayload<{ include: typeof proposalInclude }>;

type ProposalQueryDb = {
  proposal: {
    findMany: (args: Prisma.ProposalFindManyArgs) => Promise<ProposalDetailRecord[]>;
    findUnique: (args: Prisma.ProposalFindUniqueArgs) => Promise<ProposalDetailRecord | null>;
  };
};

export async function listProposalsForOpportunity(
  user: ProposalUser,
  opportunityId: string,
  database: ProposalQueryDb = db as unknown as ProposalQueryDb
) {
  assertCanViewProposals(user);

  return database.proposal.findMany({
    where: { opportunityId },
    orderBy: [{ sequenceNumber: "desc" }],
    include: proposalInclude
  });
}

export async function getProposalDetail(
  user: ProposalUser,
  proposalId: string,
  database: ProposalQueryDb = db as unknown as ProposalQueryDb
) {
  assertCanViewProposals(user);

  return database.proposal.findUnique({
    where: { id: proposalId },
    include: proposalInclude
  });
}
