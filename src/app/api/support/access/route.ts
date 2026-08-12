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

const GET = createSupportAccessHandler({
  authorize: (request, capability) => authorizeSupportAccess(request, capability, {
    runtime: getServerEnv().runtime,
    secret: process.env.SUPPORT_ACCESS_SECRET ?? "",
    findControl: async (cellId) => (await db.cellControlProjection.findUnique({
      where: { cellId }, select: { cellId: true, lifecycleStatus: true }
    })) ?? undefined,
    findGrant: async (grantId): Promise<SupportGrantProjection | undefined> => {
      const grant = await db.cellSupportGrantProjection.findUnique({ where: { id: grantId } });
      return grant ? { ...grant, revokedAt: grant.revokedAt ?? undefined } : undefined;
    },
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
