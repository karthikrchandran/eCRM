import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
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
    findUnique?: (args: Prisma.ProductServiceFindUniqueArgs) => Promise<ProductServiceRecord | null>;
  };
};

export async function listActiveProductServices(user: ProductUser, database: ProductQueryDb = db as unknown as ProductQueryDb) {
  assertCanViewProductServices(user);

  return database.productService.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: productServiceSelect
  });
}

export async function listProductServicesForAdmin(
  user: ProductUser,
  database: ProductQueryDb = db as unknown as ProductQueryDb
) {
  assertCanManageProductServices(user);

  return database.productService.findMany({
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: productServiceSelect
  });
}

export async function getProductServiceForAdmin(user: ProductUser, productServiceId: string) {
  assertCanManageProductServices(user);

  return db.productService.findUnique({
    where: { id: productServiceId },
    select: productServiceSelect
  });
}
