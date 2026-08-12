import { z } from "zod";

import { authorizePlatformAdmin } from "@/server/platform/admin-auth";
import { getPlatformAdministrationService } from "@/server/platform/runtime";

const revokeSchema = z.object({ correlationId: z.string().trim().min(1), reason: z.string().trim().min(1) });
type RouteContext = { params: Promise<{ grantId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const administrator = authorizePlatformAdmin(request);
  if (administrator instanceof Response) return administrator;
  const { grantId } = await context.params;
  const service = getPlatformAdministrationService();
  const grant = await service.getSupportGrant(grantId);
  if (!grant) return Response.json({ error: "Support grant was not found." }, { status: 404 });
  return Response.json({ grant, active: service.isSupportGrantActive(grant) });
}

export async function DELETE(request: Request, context: RouteContext) {
  const administrator = authorizePlatformAdmin(request);
  if (administrator instanceof Response) return administrator;
  try {
    const body = revokeSchema.parse(await request.json());
    const { grantId } = await context.params;
    const grant = await getPlatformAdministrationService().revokeSupportGrant(grantId, { ...body, actor: administrator.actor });
    return Response.json({ grant });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Invalid revocation request." }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to revoke support grant." }, { status: 404 });
  }
}
