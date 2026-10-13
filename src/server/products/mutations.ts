import type { Prisma } from "@prisma/client";
import { withOrganization } from "@/server/organizations/with-organization";
import { DEFAULT_PRODUCTION_TEMPLATE_KEY } from "@/server/production/constants";
import { assertCanManageProductServices } from "./permissions";
import type { ProductServiceInput, ProductUser } from "./types";

type IdResult = { id: string };

type ProductFlowDb = {
  productService: {
    update: (args: Prisma.ProductServiceUpdateArgs) => Promise<IdResult>;
  };
  productionTemplate: {
    deleteMany: (args: Prisma.ProductionTemplateDeleteManyArgs) => Promise<{ count: number }>;
    upsert: (args: Prisma.ProductionTemplateUpsertArgs) => Promise<IdResult>;
  };
  productionTemplateStage: {
    create: (args: Prisma.ProductionTemplateStageCreateArgs) => Promise<IdResult>;
    deleteMany: (args: Prisma.ProductionTemplateStageDeleteManyArgs) => Promise<{ count: number }>;
    findMany: (args: Prisma.ProductionTemplateStageFindManyArgs) => Promise<
      Array<{
        id: string;
        key: string;
        name: string;
        description: string | null;
        required: boolean;
        defaultDurationDays: number | null;
      }>
    >;
  };
};

type ProductCreateDb = ProductFlowDb & {
  productService: ProductFlowDb["productService"] & {
    create: (args: Prisma.ProductServiceCreateArgs) => Promise<IdResult>;
  };
};

type ProductUpdateDb = ProductFlowDb & {
  productService: {
    findFirst: (args: Prisma.ProductServiceFindFirstArgs) => Promise<(IdResult & { defaultProductionTemplateKey?: string | null }) | null>;
    update: (args: Prisma.ProductServiceUpdateArgs) => Promise<IdResult>;
  };
};

function productProductionTemplateKey(productServiceId: string) {
  return `product_${productServiceId}`;
}

function productData(input: ProductServiceInput) {
  const { productionStages: _productionStages, defaultProductionTemplateKey: _defaultProductionTemplateKey, ...data } = input;
  return data;
}

async function assertProductExists(database: ProductUpdateDb, organizationId: string, productServiceId: string) {
  const product = await database.productService.findFirst({
    where: { id: productServiceId, organizationId },
    select: { id: true, defaultProductionTemplateKey: true }
  });

  if (!product) {
    throw new Error("Product or service was not found.");
  }

  return product;
}

async function syncProductProductionStages(
  database: ProductFlowDb,
  user: ProductUser,
  productServiceId: string,
  productName: string,
  productionStages: ProductServiceInput["productionStages"]
) {
  const templateKey = productProductionTemplateKey(productServiceId);
  const orderedSelections = [...productionStages].sort((left, right) => left.sortOrder - right.sortOrder);

  if (orderedSelections.length === 0) {
    await database.productionTemplate.deleteMany({
      where: { organizationId: user.organizationId, key: templateKey }
    });
    await database.productService.update({
      where: { id: productServiceId },
      data: { defaultProductionTemplateKey: null, updatedById: user.id }
    });
    return;
  }

  const stageIds = orderedSelections.map((stage) => stage.stageId);
  const libraryStages = await database.productionTemplateStage.findMany({
    where: {
      id: { in: stageIds },
      organizationId: user.organizationId,
      template: { key: DEFAULT_PRODUCTION_TEMPLATE_KEY }
    },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      required: true,
      defaultDurationDays: true
    }
  });
  const stageById = new Map(libraryStages.map((stage) => [stage.id, stage]));

  if (stageById.size !== new Set(stageIds).size) {
    throw new Error("One or more production stages were not found.");
  }

  const template = await database.productionTemplate.upsert({
    where: { organizationId_key: { organizationId: user.organizationId, key: templateKey } },
    create: {
      organizationId: user.organizationId,
      key: templateKey,
      name: `${productName} production flow`,
      description: "Product-specific production stages.",
      active: true,
      sortOrder: 0
    },
    update: {
      name: `${productName} production flow`,
      active: true
    }
  });

  await database.productionTemplateStage.deleteMany({
    where: { organizationId: user.organizationId, templateId: template.id }
  });

  for (const [index, selection] of orderedSelections.entries()) {
    const stage = stageById.get(selection.stageId)!;
    await database.productionTemplateStage.create({
      data: {
        organizationId: user.organizationId,
        templateId: template.id,
        key: stage.key,
        name: stage.name,
        description: stage.description,
        required: stage.required,
        defaultDurationDays: stage.defaultDurationDays,
        sortOrder: selection.sortOrder || (index + 1) * 10
      }
    });
  }

  await database.productService.update({
    where: { id: productServiceId },
    data: { defaultProductionTemplateKey: templateKey, updatedById: user.id }
  });
}

export async function createProductService(
  user: ProductUser,
  input: ProductServiceInput,
  database?: ProductCreateDb
): Promise<IdResult> {
  if (!database) return withOrganization(user.organizationId, (tx) => createProductService(user, input, tx as unknown as ProductCreateDb));
  assertCanManageProductServices(user);

  const product = await database.productService.create({
    data: {
      organizationId: user.organizationId,
      ...productData(input),
      defaultProductionTemplateKey: null,
      createdById: user.id,
      updatedById: user.id
    }
  });
  await syncProductProductionStages(database, user, product.id, input.name, input.productionStages);
  return product;
}

export async function updateProductService(
  user: ProductUser,
  productServiceId: string,
  input: ProductServiceInput,
  database?: ProductUpdateDb
): Promise<IdResult> {
  if (!database) return withOrganization(user.organizationId, (tx) => updateProductService(user, productServiceId, input, tx as unknown as ProductUpdateDb));
  assertCanManageProductServices(user);
  await assertProductExists(database, user.organizationId, productServiceId);

  const product = await database.productService.update({
    where: { id: productServiceId },
    data: {
      ...productData(input),
      updatedById: user.id
    }
  });
  await syncProductProductionStages(database, user, productServiceId, input.name, input.productionStages);
  return product;
}

export async function setProductServiceActive(
  user: ProductUser,
  productServiceId: string,
  active: boolean,
  database?: ProductUpdateDb
): Promise<IdResult> {
  if (!database) return withOrganization(user.organizationId, (tx) => setProductServiceActive(user, productServiceId, active, tx as unknown as ProductUpdateDb));
  assertCanManageProductServices(user);
  await assertProductExists(database, user.organizationId, productServiceId);

  return database.productService.update({
    where: { id: productServiceId },
    data: { active, updatedById: user.id }
  });
}
