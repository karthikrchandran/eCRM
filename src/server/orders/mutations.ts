import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import type { AcceptedProposalForBookingDb } from "./queries";
import { loadAcceptedProposalForBooking } from "./queries";
import { assertCanWriteOrders } from "./permissions";
import type { OrderBookingInput, OrderStatusValue, OrderUser, PoMetadataInput } from "./types";

type OrderBookingTransaction = {
  order: {
    count: (args: Prisma.OrderCountArgs) => Promise<number>;
    create: (args: Prisma.OrderCreateArgs) => Promise<{ id: string; orderNumber: string }>;
    findUnique: (args: Prisma.OrderFindUniqueArgs) => Promise<{ id: string } | null>;
  };
} & AcceptedProposalForBookingDb;

type OrderBookingDb = {
  $transaction: <T>(callback: (transaction: OrderBookingTransaction) => Promise<T>) => Promise<T>;
};

type OrderUpdateDb = {
  order: {
    update: (args: Prisma.OrderUpdateArgs) => Promise<{ id: string }>;
  };
};

function generateOrderNumber(sequence: number, date = new Date()) {
  const year = date.getFullYear();
  return `ORD-${year}-${sequence.toString().padStart(4, "0")}`;
}

export async function createOrderFromAcceptedProposal(
  user: OrderUser,
  input: OrderBookingInput,
  database: OrderBookingDb = db as unknown as OrderBookingDb
) {
  assertCanWriteOrders(user);

  return database.$transaction(async (transaction) => {
    const proposal = await loadAcceptedProposalForBooking(user, input.proposalId, transaction);

    if (!proposal) {
      throw new Error("Accepted proposal was not found.");
    }

    const existingOrder = await transaction.order.findUnique({
      where: { proposalId: proposal.id },
      select: { id: true }
    });

    if (existingOrder) {
      throw new Error("This proposal already has an order.");
    }

    const sequence = (await transaction.order.count({})) + 1;

    return transaction.order.create({
      data: {
        bookedAt: new Date(),
        branchId: proposal.opportunity.branchId,
        createdById: user.id,
        currency: proposal.currency,
        deliveryDueAt: input.deliveryDueAt,
        gstPaisa: proposal.gstPaisa,
        leadCustomerId: proposal.opportunity.leadCustomerId,
        lineItems: {
          create: proposal.lineItems.map((line) => ({
            description: line.description,
            gstOverrideReason: line.gstOverrideReason,
            gstRateBps: line.gstRateBps,
            lineGstPaisa: line.lineGstPaisa,
            lineSubtotalPaisa: line.lineSubtotalPaisa,
            lineTotalPaisa: line.lineTotalPaisa,
            productCategorySnapshot: line.productCategorySnapshot,
            productNameSnapshot: line.productNameSnapshot,
            productServiceId: line.productServiceId,
            productionTemplateKeySnapshot: line.productService.defaultProductionTemplateKey,
            proposalLineItemId: line.id,
            quantity: line.quantity,
            sortOrder: line.sortOrder,
            unitPricePaisa: line.unitPricePaisa
          }))
        },
        opportunityId: proposal.opportunityId,
        orderNumber: generateOrderNumber(sequence),
        ownerId: proposal.opportunity.ownerId,
        poDate: input.poDate,
        poFileName: input.poFileName,
        poFileSizeBytes: input.poFileSizeBytes,
        poMimeType: input.poMimeType,
        poNumber: input.poNumber,
        poStorageKey: input.poStorageKey,
        proposalId: proposal.id,
        splitSnapshots: {
          create: proposal.opportunity.splits.map((split) => ({
            percent: split.percent,
            userId: split.userId
          }))
        },
        status: "BOOKED",
        subtotalPaisa: proposal.subtotalPaisa,
        totalPaisa: proposal.totalPaisa,
        updatedById: user.id
      }
    });
  });
}

export async function updateOrderPoMetadata(
  user: OrderUser,
  orderId: string,
  input: PoMetadataInput,
  database: OrderUpdateDb = db as unknown as OrderUpdateDb
) {
  assertCanWriteOrders(user);

  return database.order.update({
    where: { id: orderId },
    data: {
      deliveryDueAt: input.deliveryDueAt,
      poDate: input.poDate,
      poFileName: input.poFileName,
      poFileSizeBytes: input.poFileSizeBytes,
      poMimeType: input.poMimeType,
      poNumber: input.poNumber,
      poStorageKey: input.poStorageKey,
      updatedById: user.id
    }
  });
}

export async function changeOrderStatus(
  user: OrderUser,
  orderId: string,
  status: OrderStatusValue,
  database: OrderUpdateDb = db as unknown as OrderUpdateDb
) {
  assertCanWriteOrders(user);

  return database.order.update({
    where: { id: orderId },
    data: { status, updatedById: user.id }
  });
}
