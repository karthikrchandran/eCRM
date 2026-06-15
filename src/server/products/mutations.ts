import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { assertCanManageProductServices } from "./permissions";
import type { ProductServiceInput, ProductUser } from "./types";

type IdResult = { id: string };

type ProductCreateDb = {
  productService: {
    create: (args: Prisma.ProductServiceCreateArgs) => Promise<IdResult>;
  };
};

type ProductUpdateDb = {
  productService: {
    findUnique: (args: Prisma.ProductServiceFindUniqueArgs) => Promise<IdResult | null>;
    update: (args: Prisma.ProductServiceUpdateArgs) => Promise<IdResult>;
  };
};

async function assertProductExists(database: ProductUpdateDb, productServiceId: string) {
  const product = await database.productService.findUnique({
    where: { id: productServiceId },
    select: { id: true }
  });

  if (!product) {
    throw new Error("Product or service was not found.");
  }
}

export async function createProductService(
  user: ProductUser,
  input: ProductServiceInput,
  database: ProductCreateDb = db as unknown as ProductCreateDb
) {
  assertCanManageProductServices(user);

  return database.productService.create({
    data: {
      ...input,
      createdById: user.id,
      updatedById: user.id
    }
  });
}

export async function updateProductService(
  user: ProductUser,
  productServiceId: string,
  input: ProductServiceInput,
  database: ProductUpdateDb = db as unknown as ProductUpdateDb
) {
  assertCanManageProductServices(user);
  await assertProductExists(database, productServiceId);

  return database.productService.update({
    where: { id: productServiceId },
    data: {
      ...input,
      updatedById: user.id
    }
  });
}

export async function setProductServiceActive(
  user: ProductUser,
  productServiceId: string,
  active: boolean,
  database: ProductUpdateDb = db as unknown as ProductUpdateDb
) {
  assertCanManageProductServices(user);
  await assertProductExists(database, productServiceId);

  return database.productService.update({
    where: { id: productServiceId },
    data: { active, updatedById: user.id }
  });
}
