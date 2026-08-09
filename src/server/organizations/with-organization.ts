import type { Prisma, PrismaClient } from "@prisma/client";
import { getTenantDb } from "@/server/tenant-db";

type OrganizationTransactionDb = Pick<PrismaClient, "$transaction">;

export async function withOrganization<T>(
  organizationId: string,
  work: (transaction: Prisma.TransactionClient) => Promise<T>,
  database?: OrganizationTransactionDb
): Promise<T> {
  const tenantId = organizationId.trim();

  if (!tenantId) {
    throw new Error("Organization context is required.");
  }

  const tenantDatabase = database ?? getTenantDb();

  return tenantDatabase.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT set_config('app.organization_id', ${tenantId}, true)`;
    return work(transaction);
  });
}
