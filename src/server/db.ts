import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  controlPlanePrisma?: PrismaClient;
};

export const controlPlaneDb =
  globalForPrisma.controlPlanePrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
  });

// Compatibility alias: authentication and organization-context call sites use
// the control-plane client while tenant business work switches in
// withOrganization.
export const db = controlPlaneDb;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.controlPlanePrisma = controlPlaneDb;
}
