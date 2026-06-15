import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { assertCanViewProposals } from "@/server/proposals/permissions";
import type { ProposalUser } from "@/server/proposals/types";

const acceptedProposalForBookingInclude = {
  opportunity: {
    include: {
      leadCustomer: { select: { id: true, name: true, state: true } },
      branch: { select: { id: true, name: true, city: true, region: true } },
      owner: { select: { id: true, name: true, email: true, role: true } },
      stage: { select: { id: true, name: true, kind: true, sortOrder: true } },
      splits: {
        orderBy: { userId: "asc" },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } }
        }
      }
    }
  },
  lineItems: {
    orderBy: { sortOrder: "asc" },
    include: {
      productService: {
        select: {
          id: true,
          name: true,
          category: true,
          active: true,
          defaultProductionTemplateKey: true
        }
      }
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

export type AcceptedProposalForBooking = Prisma.ProposalGetPayload<{ include: typeof acceptedProposalForBookingInclude }>;

type OrderBookingQueryDb = {
  proposal: {
    findFirst: (args: Prisma.ProposalFindFirstArgs) => Promise<AcceptedProposalForBooking | null>;
  };
};

export async function loadAcceptedProposalForBooking(
  user: ProposalUser,
  proposalId: string,
  database: OrderBookingQueryDb = db as unknown as OrderBookingQueryDb
) {
  assertCanViewProposals(user);

  return database.proposal.findFirst({
    where: { id: proposalId, status: "ACCEPTED" },
    include: acceptedProposalForBookingInclude
  });
}
