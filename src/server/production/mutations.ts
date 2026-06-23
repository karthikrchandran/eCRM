import type { OrderStatus, Prisma, ProductionStageStatus } from "@prisma/client";
import { db } from "@/server/db";
import { assertCanManageProductionConfig, assertCanWriteProductionRecords } from "./permissions";
import type { ProductionStageStatusInput, ProductionTemplateInput, ProductionTemplateStageInput, ProductionUser } from "./types";

type ProductionMutationDb = {
  orderLineItem: {
    findUnique: (args: Prisma.OrderLineItemFindUniqueArgs) => Promise<{
      id: string;
      orderId: string;
      productNameSnapshot: string;
      productCategorySnapshot: string;
      productionTemplateKeySnapshot: string | null;
      order: { id: string; orderNumber: string; status: OrderStatus | string };
    } | null>;
  };
  productionTemplate: {
    findUnique: (args: Prisma.ProductionTemplateFindUniqueArgs) => Promise<{
      id: string;
      key: string;
      stages: Array<{
        id: string;
        name: string;
        description: string | null;
        required: boolean;
        sortOrder: number;
      }>;
    } | null>;
  };
  productionWorkItem: {
    findFirst: (args: Prisma.ProductionWorkItemFindFirstArgs) => Promise<{ id: string } | null>;
    create?: (args: Prisma.ProductionWorkItemCreateArgs) => Promise<{ id: string }>;
    findMany?: (args: Prisma.ProductionWorkItemFindManyArgs) => Promise<Array<{ id: string; status: ProductionStageStatus | string }>>;
  };
  order?: {
    update: (args: Prisma.OrderUpdateArgs) => Promise<{ id: string; status?: OrderStatus | string }>;
  };
  $transaction: <T>(callback: (transaction: ProductionTransactionDb) => Promise<T>) => Promise<T>;
};

type ProductionTransactionDb = {
  productionWorkItem?: {
    create?: (args: Prisma.ProductionWorkItemCreateArgs) => Promise<{ id: string }>;
    findMany: (args: Prisma.ProductionWorkItemFindManyArgs) => Promise<Array<{ id: string; status: ProductionStageStatus | string }>>;
    update?: (args: Prisma.ProductionWorkItemUpdateArgs) => Promise<{ id: string; status?: ProductionStageStatus | string }>;
  };
  productionStageInstance?: {
    update: (args: Prisma.ProductionStageInstanceUpdateArgs) => Promise<{ id: string; status: ProductionStageStatus | string }>;
    findMany: (args: Prisma.ProductionStageInstanceFindManyArgs) => Promise<
      Array<{
        id: string;
        status: ProductionStageStatus | string;
        startedAt: Date | null;
        completedAt: Date | null;
      }>
    >;
  };
  productionNote?: {
    create: (args: Prisma.ProductionNoteCreateArgs) => Promise<{ id: string }>;
  };
  order?: {
    update: (args: Prisma.OrderUpdateArgs) => Promise<{ id: string; status?: OrderStatus | string }>;
  };
};

type ProductionStageDb = {
  productionStageInstance: {
    findUnique: (args: Prisma.ProductionStageInstanceFindUniqueArgs) => Promise<{
      id: string;
      workItemId: string;
      status: ProductionStageStatus | string;
      startedAt: Date | null;
      workItem: {
        id: string;
        orderLineItem: {
          orderId: string;
          order: { id: string; status: OrderStatus | string };
        };
      };
    } | null>;
    update?: (args: Prisma.ProductionStageInstanceUpdateArgs) => Promise<{ id: string; status: ProductionStageStatus | string }>;
    findMany?: (args: Prisma.ProductionStageInstanceFindManyArgs) => Promise<
      Array<{
        id: string;
        status: ProductionStageStatus | string;
        startedAt: Date | null;
        completedAt: Date | null;
      }>
    >;
  };
  productionNote?: {
    create: (args: Prisma.ProductionNoteCreateArgs) => Promise<{ id: string }>;
  };
  productionWorkItem?: {
    update: (args: Prisma.ProductionWorkItemUpdateArgs) => Promise<{ id: string; status?: ProductionStageStatus | string }>;
    findMany: (args: Prisma.ProductionWorkItemFindManyArgs) => Promise<Array<{ id: string; status: ProductionStageStatus | string }>>;
  };
  order?: {
    update: (args: Prisma.OrderUpdateArgs) => Promise<{ id: string; status?: OrderStatus | string }>;
  };
  $transaction: <T>(callback: (transaction: ProductionTransactionDb) => Promise<T>) => Promise<T>;
  now?: () => Date;
};

type ProductionConfigDb = {
  productionTemplate: {
    create: (args: Prisma.ProductionTemplateCreateArgs) => Promise<{ id: string }>;
    update: (args: Prisma.ProductionTemplateUpdateArgs) => Promise<{ id: string }>;
    upsert: (args: Prisma.ProductionTemplateUpsertArgs) => Promise<{ id: string }>;
  };
  productionTemplateStage: {
    create: (args: Prisma.ProductionTemplateStageCreateArgs) => Promise<{ id: string }>;
    update: (args: Prisma.ProductionTemplateStageUpdateArgs) => Promise<{ id: string }>;
    upsert: (args: Prisma.ProductionTemplateStageUpsertArgs) => Promise<{ id: string }>;
  };
};

function deriveWorkItemStatus(stages: Array<{ status: ProductionStageStatus | string }>): ProductionStageStatus {
  if (stages.length > 0 && stages.every((stage) => stage.status === "DONE" || stage.status === "SKIPPED")) {
    return "DONE";
  }

  if (stages.some((stage) => stage.status === "BLOCKED")) {
    return "BLOCKED";
  }

  if (stages.some((stage) => stage.status === "IN_PROGRESS" || stage.status === "DONE" || stage.status === "SKIPPED")) {
    return "IN_PROGRESS";
  }

  return "NOT_STARTED";
}

function deriveOrderStatus(workItems: Array<{ status: ProductionStageStatus | string }>): OrderStatus {
  if (workItems.length > 0 && workItems.every((workItem) => workItem.status === "DONE" || workItem.status === "SKIPPED")) {
    return "READY_FOR_DELIVERY";
  }

  if (workItems.some((workItem) => workItem.status !== "NOT_STARTED")) {
    return "IN_PRODUCTION";
  }

  return "BOOKED";
}

function stageUpdateData(
  input: ProductionStageStatusInput,
  startedAt: Date | null,
  userId: string,
  now: Date
): Prisma.ProductionStageInstanceUpdateInput {
  switch (input.status) {
    case "DONE":
      return {
        completedAt: now,
        completedBy: { connect: { id: userId } },
        skippedReason: null,
        startedAt: startedAt ?? now,
        status: input.status
      };
    case "SKIPPED":
      return {
        completedAt: now,
        completedBy: { connect: { id: userId } },
        skippedReason: input.skippedReason ?? null,
        startedAt,
        status: input.status
      };
    case "BLOCKED":
    case "IN_PROGRESS":
      return {
        completedAt: null,
        completedBy: { disconnect: true },
        skippedReason: null,
        startedAt: startedAt ?? now,
        status: input.status
      };
    case "NOT_STARTED":
      return {
        completedAt: null,
        completedBy: { disconnect: true },
        skippedReason: null,
        startedAt: null,
        status: input.status
      };
  }
}

function stageUpdateDataForPrismaArgs(input: ProductionStageStatusInput, startedAt: Date | null, userId: string, now: Date) {
  const data = stageUpdateData(input, startedAt, userId, now);
  const updateData = {
    completedAt: data.completedAt,
    completedById: input.status === "DONE" || input.status === "SKIPPED" ? userId : null,
    skippedReason: data.skippedReason,
    startedAt: data.startedAt,
    status: input.status
  } satisfies Prisma.ProductionStageInstanceUncheckedUpdateInput;

  return {
    ...updateData,
    ...(input.assignedToId !== undefined ? { assignedToId: input.assignedToId || null } : {}),
    ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {})
  };
}

export async function instantiateProductionForOrderLineItem(
  user: ProductionUser,
  orderLineItemId: string,
  database: ProductionMutationDb = db as unknown as ProductionMutationDb
) {
  assertCanWriteProductionRecords(user);

  const existing = await database.productionWorkItem.findFirst({
    where: { orderLineItemId },
    select: { id: true }
  });

  if (existing) {
    return existing;
  }

  const orderLineItem = await database.orderLineItem.findUnique({
    where: { id: orderLineItemId },
    select: {
      id: true,
      orderId: true,
      productNameSnapshot: true,
      productCategorySnapshot: true,
      productionTemplateKeySnapshot: true,
      order: { select: { id: true, orderNumber: true, status: true } }
    }
  });

  if (!orderLineItem) {
    throw new Error("Order line item was not found.");
  }

  const productionTemplate = orderLineItem.productionTemplateKeySnapshot
    ? await database.productionTemplate.findUnique({
        where: { key: orderLineItem.productionTemplateKeySnapshot },
        select: {
          id: true,
          key: true,
          stages: {
            orderBy: { sortOrder: "asc" },
            select: { description: true, id: true, name: true, required: true, sortOrder: true }
          }
        }
      })
    : null;

  return database.$transaction(async (transaction) =>
    transaction.productionWorkItem!.create!({
      data: {
        createdById: user.id,
        orderLineItemId,
        productCategorySnapshot: orderLineItem.productCategorySnapshot,
        productNameSnapshot: orderLineItem.productNameSnapshot,
        productionTemplateId: productionTemplate?.id,
        stageInstances: {
          create:
            productionTemplate?.stages.map((stage) => ({
              description: stage.description,
              name: stage.name,
              required: stage.required,
              sortOrder: stage.sortOrder,
              status: "NOT_STARTED" as const,
              templateStageId: stage.id
            })) ?? []
        },
        status: "NOT_STARTED",
        title: `${orderLineItem.order.orderNumber} - ${orderLineItem.productNameSnapshot}`,
        updatedById: user.id
      }
    })
  );
}

export async function updateProductionStageStatus(
  user: ProductionUser,
  stageInstanceId: string,
  input: ProductionStageStatusInput,
  database: ProductionStageDb = db as unknown as ProductionStageDb
) {
  assertCanWriteProductionRecords(user);

  const stage = await database.productionStageInstance.findUnique({
    where: { id: stageInstanceId },
    select: {
      id: true,
      startedAt: true,
      status: true,
      workItemId: true,
      workItem: {
        select: {
          id: true,
          orderLineItem: {
            select: {
              orderId: true,
              order: { select: { id: true, status: true } }
            }
          }
        }
      }
    }
  });

  if (!stage) {
    throw new Error("Production stage was not found.");
  }

  const now = database.now?.() ?? new Date();
  const orderId = stage.workItem.orderLineItem.orderId;

  return database.$transaction(async (transaction) => {
    const updatedStage = await transaction.productionStageInstance!.update({
      where: { id: stageInstanceId },
      data: stageUpdateDataForPrismaArgs(input, stage.startedAt, user.id, now)
    });

    if (input.noteBody) {
      await transaction.productionNote!.create({
        data: {
          body: input.noteBody,
          createdById: user.id,
          stageInstanceId,
          workItemId: stage.workItemId
        }
      });
    }

    const stages = await transaction.productionStageInstance!.findMany({
      where: { workItemId: stage.workItemId },
      select: { completedAt: true, id: true, startedAt: true, status: true }
    });
    const workItemStatus = deriveWorkItemStatus(stages);
    await transaction.productionWorkItem!.update!({
      where: { id: stage.workItemId },
      data: {
        completedAt: workItemStatus === "DONE" ? now : null,
        startedAt: stages.some((item) => item.startedAt) ? now : null,
        status: workItemStatus,
        updatedById: user.id
      }
    });

    const workItems = await transaction.productionWorkItem!.findMany({
      where: { orderLineItem: { orderId } },
      select: { id: true, status: true }
    });
    await transaction.order!.update({
      where: { id: orderId },
      data: { status: deriveOrderStatus(workItems), updatedById: user.id }
    });

    return updatedStage;
  });
}

export async function saveProductionTemplate(
  user: ProductionUser,
  input: ProductionTemplateInput,
  database: ProductionConfigDb = db as unknown as ProductionConfigDb
) {
  assertCanManageProductionConfig(user);

  const data = {
    active: input.active,
    description: input.description ?? null,
    key: input.key,
    name: input.name,
    sortOrder: input.sortOrder
  };

  if (input.id) {
    return database.productionTemplate.update({
      where: { id: input.id },
      data
    });
  }

  return database.productionTemplate.upsert({
    where: { key: input.key },
    create: data,
    update: data
  });
}

export async function saveProductionTemplateStage(
  user: ProductionUser,
  input: ProductionTemplateStageInput,
  database: ProductionConfigDb = db as unknown as ProductionConfigDb
) {
  assertCanManageProductionConfig(user);

  const data = {
    defaultDurationDays: input.defaultDurationDays ?? null,
    description: input.description ?? null,
    key: input.key,
    name: input.name,
    required: input.required,
    sortOrder: input.sortOrder,
    templateId: input.templateId
  };

  if (input.stageId) {
    return database.productionTemplateStage.update({
      where: { id: input.stageId },
      data
    });
  }

  return database.productionTemplateStage.upsert({
    where: { templateId_key: { key: input.key, templateId: input.templateId } },
    create: data,
    update: data
  });
}
