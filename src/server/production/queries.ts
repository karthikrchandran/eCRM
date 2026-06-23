import type { Prisma, ProductionStageStatus, User } from "@prisma/client";
import { db } from "@/server/db";
import { assertCanManageProductionConfig, assertCanViewProductionRecords } from "./permissions";
import type { ProductionFilters, ProductionUser } from "./types";

const productionUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true
} satisfies Prisma.UserSelect;

const productionWorkItemInclude = {
  orderLineItem: {
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          deliveryDueAt: true,
          leadCustomer: { select: { id: true, name: true, state: true } },
          branch: { select: { id: true, name: true, city: true, region: true } },
          owner: { select: productionUserSelect }
        }
      }
    }
  },
  productionTemplate: { select: { id: true, key: true, name: true } },
  assignedTo: { select: productionUserSelect },
  stageInstances: {
    orderBy: { sortOrder: "asc" },
    include: {
      assignedTo: { select: productionUserSelect },
      completedBy: { select: productionUserSelect }
    }
  },
  notes: {
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: productionUserSelect }
    }
  }
} satisfies Prisma.ProductionWorkItemInclude;

const productionTemplateConfigInclude = {
  stages: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }
} satisfies Prisma.ProductionTemplateInclude;

const productionProductServiceSelect = {
  id: true,
  name: true,
  code: true,
  category: true,
  defaultProductionTemplateKey: true,
  active: true,
  sortOrder: true
} satisfies Prisma.ProductServiceSelect;

export const productionBoardStatuses = ["BLOCKED", "IN_PROGRESS", "NOT_STARTED", "DONE"] as const;

export type ProductionOwner = Pick<User, "id" | "name" | "email" | "role">;
export type ProductionWorkItemRecord = Prisma.ProductionWorkItemGetPayload<{ include: typeof productionWorkItemInclude }>;
export type ProductionTemplateConfigRecord = Prisma.ProductionTemplateGetPayload<{ include: typeof productionTemplateConfigInclude }>;
export type ProductionProductServiceConfigRecord = Prisma.ProductServiceGetPayload<{ select: typeof productionProductServiceSelect }>;

type ProductionQueryDb = {
  productionWorkItem: {
    findMany: (args: Prisma.ProductionWorkItemFindManyArgs) => Promise<ProductionWorkItemRecord[]>;
    findUnique?: (args: Prisma.ProductionWorkItemFindUniqueArgs) => Promise<ProductionWorkItemRecord | null>;
  };
  user?: {
    findMany: (args: Prisma.UserFindManyArgs) => Promise<ProductionOwner[]>;
  };
  productionTemplate?: {
    findMany: (args: Prisma.ProductionTemplateFindManyArgs) => Promise<ProductionTemplateConfigRecord[]>;
  };
  productService?: {
    findMany: (args: Prisma.ProductServiceFindManyArgs) => Promise<ProductionProductServiceConfigRecord[]>;
  };
};

function buildProductionWorkItemWhere(filters: ProductionFilters): Prisma.ProductionWorkItemWhereInput {
  const where: Prisma.ProductionWorkItemWhereInput = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.assignedToId) {
    where.assignedToId = filters.assignedToId;
  }

  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: "insensitive" } },
      { productNameSnapshot: { contains: filters.q, mode: "insensitive" } },
      { productCategorySnapshot: { contains: filters.q, mode: "insensitive" } },
      { orderLineItem: { order: { orderNumber: { contains: filters.q, mode: "insensitive" } } } },
      { orderLineItem: { order: { leadCustomer: { name: { contains: filters.q, mode: "insensitive" } } } } }
    ];
  }

  return where;
}

export async function listProductionBoard(
  user: ProductionUser,
  filters: ProductionFilters,
  database: ProductionQueryDb = db as unknown as ProductionQueryDb
) {
  assertCanViewProductionRecords(user);
  const workItems = await database.productionWorkItem.findMany({
    where: buildProductionWorkItemWhere(filters),
    orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }, { title: "asc" }],
    include: productionWorkItemInclude
  });
  const recordsByStatus: Record<ProductionStageStatus, ProductionWorkItemRecord[]> = {
    NOT_STARTED: [],
    IN_PROGRESS: [],
    BLOCKED: [],
    DONE: [],
    SKIPPED: []
  };

  for (const workItem of workItems) {
    recordsByStatus[workItem.status] = recordsByStatus[workItem.status] ?? [];
    recordsByStatus[workItem.status].push(workItem);
  }

  return { statuses: productionBoardStatuses, recordsByStatus };
}

export async function listProductionWorkItems(
  user: ProductionUser,
  filters: ProductionFilters = {},
  database: ProductionQueryDb = db as unknown as ProductionQueryDb
) {
  assertCanViewProductionRecords(user);

  return database.productionWorkItem.findMany({
    where: buildProductionWorkItemWhere(filters),
    orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
    include: productionWorkItemInclude
  });
}

export async function getProductionWorkItemDetail(
  user: ProductionUser,
  workItemId: string,
  database: ProductionQueryDb = db as unknown as ProductionQueryDb
) {
  assertCanViewProductionRecords(user);

  if (!database.productionWorkItem.findUnique) {
    throw new Error("Production work item detail query is unavailable.");
  }

  return database.productionWorkItem.findUnique({
    where: { id: workItemId },
    include: productionWorkItemInclude
  });
}

export async function listProductionFormOptions(database: ProductionQueryDb = db as unknown as ProductionQueryDb) {
  if (!database.user) {
    throw new Error("Production form options query is unavailable.");
  }

  const owners = await database.user.findMany({
    where: { active: true, role: { in: ["ADMIN", "SALES"] } },
    orderBy: { name: "asc" },
    select: productionUserSelect
  });

  return { owners };
}

export async function listProductionTemplateConfig(
  user: ProductionUser,
  database: ProductionQueryDb = db as unknown as ProductionQueryDb
) {
  assertCanManageProductionConfig(user);

  if (!database.productionTemplate || !database.productService) {
    throw new Error("Production template configuration query is unavailable.");
  }

  const [templates, productServices] = await Promise.all([
    database.productionTemplate.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: productionTemplateConfigInclude
    }),
    database.productService.findMany({
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: productionProductServiceSelect
    })
  ]);

  return { productServices, templates };
}
