import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { withOrganization } from "@/server/organizations/with-organization";
import type { AcceptedProposalForBookingDb } from "./queries";
import { loadAcceptedProposalForBooking } from "./queries";
import { assertCanWriteOrders } from "./permissions";
import type { OrderBookingInput, OrderStatusValue, OrderUser, PoMetadataInput } from "./types";

type OrderBookingTransaction = {
  order: {
    count: (args: Prisma.OrderCountArgs) => Promise<number>;
    create: (args: Prisma.OrderCreateArgs) => Promise<{ id: string; orderNumber: string }>;
    findFirst: (args: Prisma.OrderFindFirstArgs) => Promise<{ id: string } | null>;
  };
} & AcceptedProposalForBookingDb;

type OrderBookingDb = Partial<OrderBookingTransaction> & {
  $transaction?: <T>(callback: (transaction: OrderBookingTransaction) => Promise<T>) => Promise<T>;
};

type OrderUpdateDb = {
  order: {
    findFirst: (args: Prisma.OrderFindFirstArgs) => Promise<{ id: string } | null>;
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
): Promise<{ id: string; orderNumber: string }> {
  if (database === (db as unknown as OrderBookingDb)) return withOrganization(user.organizationId, (tx) => createOrderFromAcceptedProposal(user, input, tx as unknown as OrderBookingDb));
  assertCanWriteOrders(user);

  const work = async (transaction: OrderBookingTransaction) => {
    const proposal = await loadAcceptedProposalForBooking(user, input.proposalId, transaction);

    if (!proposal) {
      throw new Error("Accepted proposal was not found.");
    }

    const existingOrder = await transaction.order.findFirst({
      where: { proposalId: proposal.id, organizationId: user.organizationId },
      select: { id: true }
    });

    if (existingOrder) {
      throw new Error("This proposal already has an order.");
    }

    const sequence = (await transaction.order.count({ where: { organizationId: user.organizationId } })) + 1;

    return transaction.order.create({
      data: {
        organizationId: user.organizationId,
        bookedAt: new Date(),
        branchId: proposal.opportunity.branchId,
        createdById: user.id,
        currency: proposal.currency,
        deliveryDueAt: input.deliveryDueAt,
        gstPaisa: proposal.gstPaisa,
        leadCustomerId: proposal.opportunity.leadCustomerId,
        lineItems: {
          create: proposal.lineItems.map((line) => ({
            organizationId: user.organizationId,
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
            organizationId: user.organizationId,
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
  };
  return database.$transaction ? database.$transaction(work) : work(database as OrderBookingTransaction);
}

export async function updateOrderPoMetadata(
  user: OrderUser,
  orderId: string,
  input: PoMetadataInput,
  database: OrderUpdateDb = db as unknown as OrderUpdateDb
): Promise<{ id: string }> {
  if (database === (db as unknown as OrderUpdateDb)) return withOrganization(user.organizationId, (tx) => updateOrderPoMetadata(user, orderId, input, tx as unknown as OrderUpdateDb));
  assertCanWriteOrders(user);

  const existing = await database.order.findFirst({ where: { id: orderId, organizationId: user.organizationId }, select: { id: true } });
  if (!existing) throw new Error("Order was not found.");

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
): Promise<{ id: string }> {
  if (database === (db as unknown as OrderUpdateDb)) return withOrganization(user.organizationId, (tx) => changeOrderStatus(user, orderId, status, tx as unknown as OrderUpdateDb));
  assertCanWriteOrders(user);

  const existing = await database.order.findFirst({ where: { id: orderId, organizationId: user.organizationId }, select: { id: true } });
  if (!existing) throw new Error("Order was not found.");

  return database.order.update({
    where: { id: orderId },
    data: { status, updatedById: user.id }
  });
}
