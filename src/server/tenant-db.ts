import { Prisma, PrismaClient } from "@prisma/client";

type TenantClientFactory<T> = (options: Prisma.PrismaClientOptions) => T;

const globalForTenantPrisma = globalThis as unknown as {
  tenantPrisma?: PrismaClient;
};
let tenantPrisma = globalForTenantPrisma.tenantPrisma;

function tenantClientOptions(databaseUrl: string): Prisma.PrismaClientOptions {
  return {
    datasourceUrl: databaseUrl,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
  };
}

export function createTenantPrismaClient<T = PrismaClient>(
  databaseUrl = process.env.TENANT_DATABASE_URL,
  createClient: TenantClientFactory<T> = (options) => new PrismaClient(options) as T
): T {
  const normalizedDatabaseUrl = databaseUrl?.trim();

  if (!normalizedDatabaseUrl) {
    throw new Error("TENANT_DATABASE_URL is required for tenant business data access.");
  }

  return createClient(tenantClientOptions(normalizedDatabaseUrl));
}

export function getTenantDb(): PrismaClient {
  if (tenantPrisma) {
    return tenantPrisma;
  }

  tenantPrisma = createTenantPrismaClient<PrismaClient>();

  if (process.env.NODE_ENV !== "production") {
    globalForTenantPrisma.tenantPrisma = tenantPrisma;
  }

  return tenantPrisma;
}
