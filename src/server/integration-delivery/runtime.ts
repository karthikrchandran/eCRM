import { db } from "@/server/db";
import { getServerEnv } from "@/server/env";
import { IntegrationCredentialService } from "./credentials";
import { PrismaIntegrationCredentialRepository } from "./prisma-credentials";
import { PrismaIntegrationDeliveryRepository } from "./prisma-outbox";

export function getIntegrationCredentialService() {
  return new IntegrationCredentialService(new PrismaIntegrationCredentialRepository(db), { runtime: getServerEnv().runtime });
}

export function getIntegrationDeliveryRepository() {
  return new PrismaIntegrationDeliveryRepository(db);
}
