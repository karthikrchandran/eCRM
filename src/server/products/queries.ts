import type { Prisma } from "@prisma/client";
import { withOrganization } from "@/server/organizations/with-organization";
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

type ProductQueryDb = {
  productService: {
    findMany: (args: Prisma.ProductServiceFindManyArgs) => Promise<ProductServiceRecord[]>;
    findFirst?: (args: Prisma.ProductServiceFindFirstArgs) => Promise<ProductServiceRecord | null>;
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
