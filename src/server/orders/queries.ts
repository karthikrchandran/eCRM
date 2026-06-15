import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { assertCanViewProposals } from "@/server/proposals/permissions";
import type { ProposalUser } from "@/server/proposals/types";
import { assertCanViewOrders } from "./permissions";
import type { OrderUser } from "./types";

const orderInclude = {
  branch: { select: { id: true, name: true, city: true, region: true } },
  leadCustomer: { select: { id: true, name: true, state: true } },
  lineItems: {
    orderBy: { sortOrder: "asc" },
    include: {
      productionWorkItems: { select: { id: true, status: true } }
    }
  },
  opportunity: { select: { id: true, title: true } },
  owner: { select: { id: true, name: true, email: true, role: true } },
  proposal: { select: { id: true, title: true, status: true, sequenceNumber: true, versionLabel: true } },
  splitSnapshots: {
    include: {
      user: { select: { id: true, name: true, email: true, role: true } }
    }
  }
} satisfies Prisma.OrderInclude;

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
export type OrderRecord = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export type AcceptedProposalForBookingDb = {
  proposal: {
    findFirst: (args: Prisma.ProposalFindFirstArgs) => Promise<AcceptedProposalForBooking | null>;
  };
};

type OrderQueryDb = AcceptedProposalForBookingDb & {
  order: {
    findMany: (args: Prisma.OrderFindManyArgs) => Promise<OrderRecord[]>;
    findUnique: (args: Prisma.OrderFindUniqueArgs) => Promise<OrderRecord | null>;
  };
};

export type OrderListFilters = {
  ownerId?: string;
  status?: Prisma.EnumOrderStatusFilter["equals"];
};

export async function listOrders(
  user: OrderUser,
  filters: OrderListFilters = {},
  database: OrderQueryDb = db as unknown as OrderQueryDb
) {
  assertCanViewOrders(user);

  return database.order.findMany({
    where: {
      ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
      ...(filters.status ? { status: filters.status } : {})
    },
    orderBy: [{ bookedAt: "desc" }],
    include: orderInclude
  });
}

export async function getOrderDetail(
  user: OrderUser,
  orderId: string,
  database: OrderQueryDb = db as unknown as OrderQueryDb
) {
  assertCanViewOrders(user);

  return database.order.findUnique({
    where: { id: orderId },
    include: orderInclude
  });
}

export async function loadAcceptedProposalForBooking(
  user: ProposalUser,
  proposalId: string,
  database: AcceptedProposalForBookingDb = db as unknown as AcceptedProposalForBookingDb
) {
  assertCanViewProposals(user);

  return database.proposal.findFirst({
    where: { id: proposalId, status: "ACCEPTED" },
    include: acceptedProposalForBookingInclude
  });
}
