import { Prisma, PrismaClient } from "@prisma/client";

type ControlClientFactory<T> = (options: Prisma.PrismaClientOptions) => T;

const globalForPrisma = globalThis as unknown as {
  controlPlanePrisma?: PrismaClient;
};
let controlPlanePrisma = globalForPrisma.controlPlanePrisma;

export function createControlPlanePrismaClient<T = PrismaClient>(
  databaseUrl = process.env.CONTROL_PLANE_DATABASE_URL,
  createClient: ControlClientFactory<T> = (options) => new PrismaClient(options) as T
): T {
  const normalizedUrl = databaseUrl?.trim();
  if (!normalizedUrl) {
    throw new Error("CONTROL_PLANE_DATABASE_URL is required for runtime identity and organization access.");
  }
  return createClient({
    datasourceUrl: normalizedUrl,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
  });
}

export function getControlPlaneDb(): PrismaClient {
  if (!controlPlanePrisma) {
    controlPlanePrisma = createControlPlanePrismaClient();
    if (process.env.NODE_ENV !== "production") globalForPrisma.controlPlanePrisma = controlPlanePrisma;
  }
  return controlPlanePrisma!;
}
