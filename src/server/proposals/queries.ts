import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { withOrganization } from "@/server/organizations/with-organization";
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
  order: { select: { id: true, orderNumber: true } },
  createdBy: { select: { id: true, name: true, email: true, role: true } },
  updatedBy: { select: { id: true, name: true, email: true, role: true } }
} satisfies Prisma.ProposalInclude;

export type ProposalDetailRecord = Prisma.ProposalGetPayload<{ include: typeof proposalInclude }>;

type ProposalQueryDb = {
  proposal: {
    findMany: (args: Prisma.ProposalFindManyArgs) => Promise<ProposalDetailRecord[]>;
    findFirst: (args: Prisma.ProposalFindFirstArgs) => Promise<ProposalDetailRecord | null>;
  };
};

export async function listProposalsForOpportunity(
  user: ProposalUser,
  opportunityId: string,
  database: ProposalQueryDb = db as unknown as ProposalQueryDb
): Promise<ProposalDetailRecord[]> {
  if (database === (db as unknown as ProposalQueryDb)) return withOrganization(user.organizationId, (tx) => listProposalsForOpportunity(user, opportunityId, tx as unknown as ProposalQueryDb));
  assertCanViewProposals(user);

  return database.proposal.findMany({
    where: { opportunityId, organizationId: user.organizationId },
    orderBy: [{ sequenceNumber: "desc" }],
    include: proposalInclude
  });
}

export async function getProposalDetail(
  user: ProposalUser,
  proposalId: string,
  database: ProposalQueryDb = db as unknown as ProposalQueryDb
): Promise<ProposalDetailRecord | null> {
  if (database === (db as unknown as ProposalQueryDb)) return withOrganization(user.organizationId, (tx) => getProposalDetail(user, proposalId, tx as unknown as ProposalQueryDb));
  assertCanViewProposals(user);

  return database.proposal.findFirst({
    where: { id: proposalId, organizationId: user.organizationId },
    include: proposalInclude
  });
}
