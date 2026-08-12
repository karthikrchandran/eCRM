import { db } from "@/server/db";
import { getServerEnv } from "@/server/env";
import {
  authorizeSupportAccess,
  SupportAccessDeniedError,
  supportCapabilities,
  type SupportCapability,
  type SupportGrantProjection
} from "@/server/cell-admin/support-access";

type Dependencies = {
  authorize(request: Request, capability: SupportCapability): Promise<unknown>;
  readConfiguration(): Promise<unknown>;
  readUsers(): Promise<unknown>;
};

export function createSupportAccessHandler(dependencies: Dependencies) {
  return async function GET(request: Request) {
    const capability = new URL(request.url).searchParams.get("capability") as SupportCapability | null;
    if (!capability || !supportCapabilities.includes(capability)) return Response.json({ error: "Invalid support capability." }, { status: 400 });
    try {
      await dependencies.authorize(request, capability);
      const result = capability === "configuration:read"
        ? await dependencies.readConfiguration()
        : await dependencies.readUsers();
      return Response.json({ result });
    } catch (error) {
      if (error instanceof SupportAccessDeniedError || error instanceof Error && error.message === "denied") {
        return Response.json({ error: "Forbidden." }, { status: 403 });
      }
      return Response.json({ error: "Support access failed." }, { status: 500 });
    }
  };
}

function projectedGrant(grantId: string): SupportGrantProjection | undefined {
  try {
    const rows = JSON.parse(process.env.SUPPORT_GRANTS_JSON ?? "[]") as Array<Record<string, unknown>>;
    const row = rows.find((entry) => entry.id === grantId);
    if (!row || typeof row.id !== "string" || typeof row.cellId !== "string" || typeof row.operatorId !== "string"
      || typeof row.caseReference !== "string" || !Array.isArray(row.capabilities)
      || typeof row.startsAt !== "string" || typeof row.expiresAt !== "string") return undefined;
    return {
      id: row.id, cellId: row.cellId, operatorId: row.operatorId, caseReference: row.caseReference,
      capabilities: row.capabilities.filter((value): value is string => typeof value === "string"),
      startsAt: new Date(row.startsAt), expiresAt: new Date(row.expiresAt),
      revokedAt: typeof row.revokedAt === "string" ? new Date(row.revokedAt) : undefined
    };
  } catch {
    return undefined;
  }
}

const GET = createSupportAccessHandler({
  authorize: (request, capability) => authorizeSupportAccess(request, capability, {
    runtime: getServerEnv().runtime,
    secret: process.env.SUPPORT_ACCESS_SECRET ?? "",
    findGrant: async (grantId) => projectedGrant(grantId),
    audit: async (event) => { await db.cellAuditEvent.create({ data: event }); }
  }),
  readConfiguration: () => db.cellConfiguration.findUnique({
    where: { id: "default" },
    select: { displayName: true, logoUrl: true, supportUrl: true, legalUrl: true, locale: true, timezone: true, defaultCurrency: true, enabledModules: true, planCode: true, revision: true }
  }),
  readUsers: () => db.user.findMany({
    orderBy: { name: "asc" }, select: { id: true, name: true, email: true, role: true, active: true }
  })
});

export { GET };
