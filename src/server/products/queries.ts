import type { Prisma } from "@prisma/client";
import { withOrganization } from "@/server/organizations/with-organization";
import { DEFAULT_PRODUCTION_TEMPLATE_KEY } from "@/server/production/constants";
import { assertCanManageProductServices, assertCanViewProductServices } from "./permissions";
import type { ProductUser } from "./types";

const productServiceSelect = {
  id: true,
  name: true,
  code: true,
  category: true,
  description: true,
  defaultGstRateBps: true,
  defaultProductionTemplateKey: true,
  active: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.ProductServiceSelect;

export type ProductServiceRecord = Prisma.ProductServiceGetPayload<{ select: typeof productServiceSelect }>;

const productStageSelect = {
  id: true,
  key: true,
  name: true,
  description: true,
  defaultDurationDays: true,
  required: true,
  sortOrder: true
} satisfies Prisma.ProductionTemplateStageSelect;

export type ProductStageOption = Prisma.ProductionTemplateStageGetPayload<{ select: typeof productStageSelect }>;

export type ProductStageSelection = {
  stageId: string;
  sortOrder: number;
};

type ProductQueryDb = {
  productService: {
    findMany: (args: Prisma.ProductServiceFindManyArgs) => Promise<ProductServiceRecord[]>;
    findFirst?: (args: Prisma.ProductServiceFindFirstArgs) => Promise<ProductServiceRecord | null>;
  };
  productionTemplate?: {
    findFirst: (args: Prisma.ProductionTemplateFindFirstArgs) => Promise<{
      stages: ProductStageOption[];
    } | null>;
  };
};

export async function listActiveProductServices(user: ProductUser, database?: ProductQueryDb): Promise<ProductServiceRecord[]> {
  if (!database) return withOrganization(user.organizationId, (tx) => listActiveProductServices(user, tx as unknown as ProductQueryDb));
  assertCanViewProductServices(user);

  return database.productService.findMany({
    where: { organizationId: user.organizationId, active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: productServiceSelect
  });
}

export async function listProductServicesForAdmin(
  user: ProductUser,
  database?: ProductQueryDb
): Promise<ProductServiceRecord[]> {
  if (!database) return withOrganization(user.organizationId, (tx) => listProductServicesForAdmin(user, tx as unknown as ProductQueryDb));
  assertCanManageProductServices(user);

  return database.productService.findMany({
    where: { organizationId: user.organizationId },
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: productServiceSelect
  });
}

export async function getProductServiceForAdmin(user: ProductUser, productServiceId: string, database?: ProductQueryDb): Promise<ProductServiceRecord | null> {
  if (!database) return withOrganization(user.organizationId, (tx) => getProductServiceForAdmin(user, productServiceId, tx as unknown as ProductQueryDb));
  assertCanManageProductServices(user);

  return database.productService.findFirst!({
    where: { id: productServiceId, organizationId: user.organizationId },
    select: productServiceSelect
  });
}

export async function getProductStageSetupForAdmin(
  user: ProductUser,
  productTemplateKey?: string | null,
  database?: ProductQueryDb
): Promise<{ stageOptions: ProductStageOption[]; selectedStages: ProductStageSelection[] }> {
  if (!database) return withOrganization(user.organizationId, (tx) => getProductStageSetupForAdmin(user, productTemplateKey, tx as unknown as ProductQueryDb));
  assertCanManageProductServices(user);

  if (!database.productionTemplate) {
    throw new Error("Product stage setup query is unavailable.");
  }

  const library = await database.productionTemplate.findFirst({
    where: { organizationId: user.organizationId, key: DEFAULT_PRODUCTION_TEMPLATE_KEY },
    select: {
      stages: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: productStageSelect
      }
    }
  });

  const stageOptions = library?.stages ?? [];
  if (!productTemplateKey || stageOptions.length === 0) {
    return { stageOptions, selectedStages: [] };
  }

  const productFlow = await database.productionTemplate.findFirst({
    where: { organizationId: user.organizationId, key: productTemplateKey },
    select: {
      stages: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: productStageSelect
      }
    }
  });
  const libraryStageIdByKey = new Map(stageOptions.map((stage) => [stage.key, stage.id]));
  const selectedStages =
    productFlow?.stages
      .map((stage) => {
        const stageId = libraryStageIdByKey.get(stage.key);
        return stageId ? { stageId, sortOrder: stage.sortOrder } : null;
      })
      .filter((stage): stage is ProductStageSelection => Boolean(stage)) ?? [];

  return { stageOptions, selectedStages };
}
