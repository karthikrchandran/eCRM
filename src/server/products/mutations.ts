import type { Prisma } from "@prisma/client";
import { tenantBoundary as db } from "@/server/organizations/tenant-boundary";
import { withOrganization } from "@/server/organizations/with-organization";
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
    findFirst: (args: Prisma.ProductServiceFindFirstArgs) => Promise<IdResult | null>;
    update: (args: Prisma.ProductServiceUpdateArgs) => Promise<IdResult>;
  };
};

async function assertProductExists(database: ProductUpdateDb, organizationId: string, productServiceId: string) {
  const product = await database.productService.findFirst({
    where: { id: productServiceId, organizationId },
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
): Promise<IdResult> {
  if (database === (db as unknown as ProductCreateDb)) return withOrganization(user.organizationId, (tx) => createProductService(user, input, tx as unknown as ProductCreateDb));
  assertCanManageProductServices(user);

  return database.productService.create({
    data: {
      organizationId: user.organizationId,
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
): Promise<IdResult> {
  if (database === (db as unknown as ProductUpdateDb)) return withOrganization(user.organizationId, (tx) => updateProductService(user, productServiceId, input, tx as unknown as ProductUpdateDb));
  assertCanManageProductServices(user);
  await assertProductExists(database, user.organizationId, productServiceId);

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
): Promise<IdResult> {
  if (database === (db as unknown as ProductUpdateDb)) return withOrganization(user.organizationId, (tx) => setProductServiceActive(user, productServiceId, active, tx as unknown as ProductUpdateDb));
  assertCanManageProductServices(user);
  await assertProductExists(database, user.organizationId, productServiceId);

  return database.productService.update({
    where: { id: productServiceId },
    data: { active, updatedById: user.id }
  });
}
