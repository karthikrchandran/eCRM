import { db } from "@/server/db";
import { IntegrationCredentialService, type IntegrationCapability } from "@/server/integration-delivery/credentials";
import { PrismaIntegrationCredentialRepository } from "@/server/integration-delivery/prisma-credentials";
import { isConfiguredCellRuntimeActive, parseConfiguredRuntimeConfig } from "@/server/runtime/cell-config";

export async function requireSharedDataApiToken(
  request: Request,
  capability: IntegrationCapability = "SHARED_RECORDS_READ"
): Promise<Response | null> {
  return requireIntegrationCapability(request, capability);
}

export async function requireIntegrationCapability(
  request: Request,
  capability: IntegrationCapability,
  dependencies: {
    isCellActive(): Promise<boolean>;
    authenticate(secret: string | undefined, capability: IntegrationCapability): Promise<unknown>;
  } = defaultDependencies()
): Promise<Response | null> {
  if (!await dependencies.isCellActive()) return Response.json({ error: "Customer cell is not active." }, { status: 423 });
  const secret = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  try {
    await dependencies.authenticate(secret, capability);
    return null;
  } catch {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
}

function defaultDependencies() {
  const runtime = parseConfiguredRuntimeConfig();
  const service = new IntegrationCredentialService(new PrismaIntegrationCredentialRepository(db), { runtime });
  return {
    isCellActive: () => isConfiguredCellRuntimeActive(),
    authenticate: (secret: string | undefined, capability: IntegrationCapability) => service.authenticate(secret, capability)
  };
}

export function getSharedDataOrganizationId(): string | null {
  const organizationId = process.env.SHARED_DATA_ORGANIZATION_ID?.trim();
  return organizationId || null;
}
